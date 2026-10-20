import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Vault } from '../src/vault.js';
import { Core } from '../src/core.js';
import { createApp } from '../src/server.js';
import { abortVaultMigration, commitVaultMigration, discardUnkeyedMigration, migrationPath, prepareVaultMigration, resumeVaultMigration } from '../src/vault-migration.js';

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
