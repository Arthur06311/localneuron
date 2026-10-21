import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Vault } from '../src/vault.js';
import { Core } from '../src/core.js';
import { createApp } from '../src/server.js';
import { abortVaultMigration, commitVaultMigration, discardUnkeyedMigration, migrationPath, prepareVaultMigration, resumeVaultMigration } from '../src/vault-migration.js';
import { beginFreshDeviceSpace } from '../src/vault-fresh.js';
import { adoptDeviceVault } from '../src/vault-device.js';

const { loadKey, storeKey } = createRequire(resolve('desktop/vault-key.cjs'))('./vault-key.cjs') as {
  loadKey: (input: { directory: string; safeStorage: null }) => string | null;
  storeKey: (input: { directory: string; secret: string; safeStorage: null; warn?: (message: string) => void }) => string;
};
const password = 'senha-antiga-do-cofre';
const secret = 'chave-nova-do-dispositivo-teste';

function freshVault() {
  const dir = mkdtempSync(join(tmpdir(), 'vault-mig-'));
  const vault = new Vault(dir);
  vault.initialize(password);
  const space = vault.spaceId;
  vault.lock();
  return { dir, vault, space, before: readFileSync(vault.path) };
}

test('senha errada não altera o cofre nem deixa cópia', () => {
  const { dir, vault, before } = freshVault();
  try {
    assert.throws(() => prepareVaultMigration(vault, 'senha-errada-demais', secret), /incorreta/);
    assert.ok(readFileSync(vault.path).equals(before));
    assert.equal(existsSync(migrationPath(vault.path)), false);
    assert.equal(existsSync(vault.path + '.commit'), false);
    vault.unlock(password);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migração interrompida preserva o cofre antigo e a conclusão troca só a chave', () => {
  const { dir, vault, space, before } = freshVault();
  try {
    prepareVaultMigration(vault, password, secret);
    assert.ok(readFileSync(vault.path).equals(before));
    assert.equal(existsSync(migrationPath(vault.path)), true);
    assert.equal(vault.locked, true);
    Vault.openSealed(vault.path, password);
    assert.throws(() => Vault.openSealed(vault.path, secret), /incorreta|danificado/);
    discardUnkeyedMigration(vault);
    assert.equal(existsSync(migrationPath(vault.path)), false);
    assert.ok(readFileSync(vault.path).equals(before));
    vault.unlock(password);
    vault.lock();

    prepareVaultMigration(vault, password, secret);
    writeFileSync(migrationPath(vault.path), '{"version":1,"salt":"00","iv":"00","tag":"00","data":"AAAA"}');
    assert.equal(resumeVaultMigration(vault, secret), false);
    assert.equal(existsSync(migrationPath(vault.path)), false);
    assert.ok(readFileSync(vault.path).equals(before));
    vault.unlock(password);
    vault.lock();

    prepareVaultMigration(vault, password, secret);
    assert.equal(resumeVaultMigration(vault, secret), true);
    assert.equal(existsSync(migrationPath(vault.path)), false);
    assert.throws(() => Vault.openSealed(vault.path, password), /incorreta/);
    const opened = Vault.openSealed(vault.path, secret);
    assert.equal(typeof opened.organization, 'string');
    assert.equal(JSON.parse(readFileSync(vault.path, 'utf8')).space_id, space);
    abortVaultMigration(vault);
    assert.throws(() => commitVaultMigration(vault), /preparada/);
    Vault.openSealed(vault.path, secret);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('rotas locais migram sem devolver a chave e recusam troca incompleta', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-http-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await core.setup(password);
  const space = core.vault.spaceId;
  core.vault.lock();
  const before = readFileSync(core.vault.path);
  writeFileSync(join(dir, 'device-access.bin'), 'senha-lembrada', { mode: 0o600 });
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => { warnings.push(String(message ?? '')); };
  const { app } = await createApp(core, 'mig-token');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer mig-token' };
  try {
    const status = await app.inject({ method: 'GET', url: '/v1/status', headers });
    assert.equal(status.json().needs_migration, true);
    const wrong = await app.inject({ method: 'POST', url: '/v1/vault/migrate', headers, payload: { password: 'senha-errada-demais' } });
    assert.equal(wrong.statusCode, 400);
    assert.ok(readFileSync(core.vault.path).equals(before));
    assert.equal(existsSync(migrationPath(core.vault.path)), false);
    assert.equal(existsSync(join(dir, 'device-access.bin')), true);
    const denied = await app.inject({ method: 'POST', url: '/v1/vault/device-migrate', headers, payload: { password, secret } });
    assert.equal(denied.statusCode, 403);
    assert.ok(readFileSync(core.vault.path).equals(before));
    const migrated = await app.inject({ method: 'POST', url: '/v1/vault/migrate', headers, payload: { password } });
    assert.equal(migrated.statusCode, 200);
    assert.deepEqual(migrated.json(), { ok: true });
    const stored = loadKey({ directory: dir, safeStorage: null });
    assert.equal(typeof stored, 'string');
    assert.equal(migrated.body.includes(stored!), false);
    assert.equal(warnings.some(message => message.includes(stored!)), false);
    assert.ok(warnings.some(message => message.includes('arquivo só deste usuário')));
    assert.throws(() => Vault.openSealed(core.vault.path, password), /incorreta/);
    assert.equal(Vault.openSealed(core.vault.path, stored!).organization.length > 0, true);
    assert.equal(JSON.parse(readFileSync(core.vault.path, 'utf8')).space_id, space);
    assert.equal(existsSync(join(dir, 'device-access.bin')), false);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/status', headers })).json().needs_migration, false);
  } finally {
    console.warn = originalWarn;
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('o processo principal conclui uma migração já conferida e o renderer não recebe a chave', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-device-http-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await core.setup(password);
  core.vault.lock();
  const before = readFileSync(core.vault.path);
  const nonce = 'nonce-dispositivo-teste';
  const { app } = await createApp(core, 'device-token', 'http://127.0.0.1:4317', undefined, undefined, nonce);
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer device-token', 'x-localneuron-device': nonce };
  try {
    const blocked = await app.inject({ method: 'POST', url: '/v1/vault/migrate', headers, payload: { password } });
    assert.equal(blocked.statusCode, 400);
    assert.match(blocked.json().error, /aplicativo/);
    assert.ok(readFileSync(core.vault.path).equals(before));
    const wrong = await app.inject({ method: 'POST', url: '/v1/vault/device-migrate', headers, payload: { password: 'senha-errada-demais', secret } });
    assert.equal(wrong.statusCode, 400);
    assert.ok(readFileSync(core.vault.path).equals(before));
    assert.equal(existsSync(migrationPath(core.vault.path)), false);
    const prepared = await app.inject({ method: 'POST', url: '/v1/vault/device-migrate', headers, payload: { password, secret } });
    assert.equal(prepared.statusCode, 200);
    assert.deepEqual(prepared.json(), { prepared: true });
    assert.equal(prepared.body.includes(secret), false);
    assert.ok(readFileSync(core.vault.path).equals(before));
    assert.equal(core.vault.locked, true);
    storeKey({ directory: dir, secret, safeStorage: null, warn() {} });
    const opened = await app.inject({ method: 'POST', url: '/v1/vault/device-open', headers, payload: { secret } });
    assert.equal(opened.statusCode, 200);
    assert.deepEqual(opened.json(), { ok: true });
    assert.equal(opened.body.includes(secret), false);
    assert.equal(existsSync(migrationPath(core.vault.path)), false);
    assert.throws(() => Vault.openSealed(core.vault.path, password), /incorreta/);
    Vault.openSealed(core.vault.path, secret);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

function legacyVault(dir: string) {
  const name = readdirSync(dir).find(item => item.startsWith('vault.enc.json.legacy-'));
  if (!name) throw new Error('cópia ausente');
  return join(dir, name);
}

test('perfil novo não pede migração nem cria cópia', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-fresh-profile-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await adoptDeviceVault(core, () => {});
  const { app } = await createApp(core, 'new-token');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer new-token' };
  try {
    const status = await app.inject({ method: 'GET', url: '/v1/status', headers });
    assert.equal(status.json().needs_migration, false);
    assert.equal(status.json().locked, false);
    assert.equal(status.json().vault_exists, true);
    assert.equal(readdirSync(dir).some(name => name.startsWith('vault.enc.json.legacy-')), false);
    const skipped = await app.inject({ method: 'POST', url: '/v1/vault/skip-legacy', headers, payload: {} });
    assert.equal(skipped.statusCode, 400);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('data de cópia repetida não substitui o cofre antigo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-fresh-stamp-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await core.setup(password);
  core.vault.lock();
  const before = readFileSync(core.vault.path);
  const stamp = '20261020T102833123Z-ab12';
  writeFileSync(core.vault.path + '.legacy-' + stamp, 'nao-tocar', { mode: 0o600 });
  try {
    await assert.rejects(() => beginFreshDeviceSpace(core, secret, stamp), /cópia desta data/);
    assert.ok(readFileSync(core.vault.path).equals(before));
    assert.equal(readFileSync(core.vault.path + '.legacy-' + stamp, 'utf8'), 'nao-tocar');
    core.vault.unlock(password);
  } finally {
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('começar sem o cofre antigo guarda a cópia, abre o cofre novo e a segunda inicialização não pede senha', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-skip-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await core.setup(password);
  const space = core.vault.spaceId;
  core.vault.lock();
  const before = readFileSync(core.vault.path);
  writeFileSync(join(dir, 'device-access.bin'), 'senha-lembrada', { mode: 0o600 });
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => { warnings.push(String(message ?? '')); };
  const { app } = await createApp(core, 'skip-token');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer skip-token' };
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/status', headers })).json().needs_migration, true);
    const denied = await app.inject({ method: 'POST', url: '/v1/vault/device-fresh', headers, payload: { secret } });
    assert.equal(denied.statusCode, 403);
    assert.ok(readFileSync(core.vault.path).equals(before));
    const skipped = await app.inject({ method: 'POST', url: '/v1/vault/skip-legacy', headers, payload: {} });
    assert.equal(skipped.statusCode, 200, skipped.body);
    assert.deepEqual(skipped.json(), { ok: true });
    const stored = loadKey({ directory: dir, safeStorage: null });
    assert.equal(typeof stored, 'string');
    assert.equal(skipped.body.includes(stored!), false);
    assert.equal(warnings.some(message => message.includes(stored!)), false);
    const backup = legacyVault(dir);
    assert.ok(readFileSync(backup).equals(before));
    assert.equal(JSON.parse(readFileSync(backup, 'utf8')).space_id, space);
    assert.ok(existsSync(core.vault.path));
    assert.equal(readFileSync(core.vault.path).equals(before), false);
    Vault.openSealed(backup, password);
    assert.throws(() => Vault.openSealed(core.vault.path, password), /incorreta/);
    assert.equal(Vault.openSealed(core.vault.path, stored!).organization.length > 0, true);
    const postgresBackup = readdirSync(dir).find(name => name.startsWith('postgres.legacy-'));
    assert.equal(typeof postgresBackup, 'string');
    assert.equal(statSync(join(dir, postgresBackup!)).isDirectory(), true);
    assert.equal(existsSync(join(dir, 'device-access.bin')), true);
    const status = (await app.inject({ method: 'GET', url: '/v1/status', headers })).json();
    assert.equal(status.needs_migration, false);
    assert.equal(status.locked, false);
    const listed = await app.inject({ method: 'GET', url: '/v1/vault/legacy', headers });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().backups.length, 1);
    assert.equal(listed.json().backups[0].postgres, true);
    assert.equal(listed.body.includes(stored!), false);
    const backupName = listed.json().backups[0].name;
    const wrong = await app.inject({ method: 'POST', url: '/v1/vault/legacy/import', headers, payload: { name: backupName, password: 'senha-errada-demais' } });
    assert.equal(wrong.statusCode, 400);
    assert.ok(readFileSync(backup).equals(before));
    assert.equal(readFileSync(core.vault.path).equals(before), false);
    Vault.openSealed(core.vault.path, stored!);
  } finally {
    console.warn = originalWarn;
    await app.close();
    await core.close();
  }
  const core2 = new Core(dir, process.cwd());
  try {
    await core2.init();
    const { app: app2 } = await createApp(core2, 'skip-token-2');
    const headers2 = { host: '127.0.0.1:4317', authorization: 'Bearer skip-token-2' };
    const status = await app2.inject({ method: 'GET', url: '/v1/status', headers: headers2 });
    assert.equal(status.json().needs_migration, false);
    assert.equal(status.json().vault_exists, true);
    assert.equal(status.json().locked, true);
    await app2.close();
    await adoptDeviceVault(core2, () => {});
    assert.equal((await core2.status()).locked, false);
    assert.ok(readFileSync(legacyVault(dir)).equals(before));
    const stored = loadKey({ directory: dir, safeStorage: null });
    const { app: app3 } = await createApp(core2, 'skip-token-3');
    const headers3 = { host: '127.0.0.1:4317', authorization: 'Bearer skip-token-3' };
    const backupName = (await app3.inject({ method: 'GET', url: '/v1/vault/legacy', headers: headers3 })).json().backups[0].name;
    const imported = await app3.inject({ method: 'POST', url: '/v1/vault/legacy/import', headers: headers3, payload: { name: backupName, password } });
    assert.equal(imported.statusCode, 200, imported.body);
    assert.deepEqual(imported.json(), { ok: true });
    assert.equal(imported.body.includes(stored!), false);
    assert.ok(readFileSync(legacyVault(dir)).equals(before));
    Vault.openSealed(legacyVault(dir), password);
    assert.throws(() => Vault.openSealed(core2.vault.path, password), /incorreta/);
    assert.equal(Vault.openSealed(core2.vault.path, stored!).organization.length > 0, true);
    assert.equal(JSON.parse(readFileSync(core2.vault.path, 'utf8')).space_id, space);
    assert.equal((await app3.inject({ method: 'GET', url: '/v1/status', headers: headers3 })).json().needs_migration, false);
    assert.equal((await app3.inject({ method: 'GET', url: '/v1/workspace', headers: headers3 })).statusCode, 200);
    await app3.close();
  } finally {
    await core2.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
