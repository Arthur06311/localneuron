import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:net';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Core } from '../src/core.js';
import { openLocalServer } from '../src/server.js';
import { Vault } from '../src/vault.js';

const password = 'senha-antiga-do-cofre';

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function started(dir: string) {
  const port = await freePort();
  return openLocalServer(dir, process.cwd(), { LOCALNEURON_PORT: String(port) } as NodeJS.ProcessEnv);
}

function legacyName(dir: string) {
  return readdirSync(dir).find(name => name.startsWith('vault.enc.json.legacy-'));
}

test('primeira execução abre o Chat sem senha e rejeita origem estranha ou sessão ausente', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startup-new-'));
  const launched = await started(dir);
  try {
    const { app, token, session, core } = launched;
    assert.equal(session.url.startsWith('http://127.0.0.1:'), true);
    assert.equal(session.url.includes(`#session=${token}`), true);
    assert.equal(core.vault.locked, false);
    assert.equal(legacyName(dir), undefined);
    const host = `127.0.0.1:${session.port}`;
    const origin = `http://127.0.0.1:${session.port}`;
    const headers = { host, origin, authorization: 'Bearer ' + token };
    const page = await app.inject({ method: 'GET', url: '/', headers: { host, origin } });
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /data-page="chat"/);
    assert.match(page.body, /aria-current="page"/);
    assert.equal(page.body.includes('Confirme a senha atual'), false);
    const script = await app.inject({ method: 'GET', url: '/app.js', headers: { host, origin } });
    assert.equal(script.statusCode, 200);
    assert.equal(script.body.includes('Confirme a senha atual'), false);
    assert.equal(script.body.includes('migrate-password'), false);
    assert.match(script.body, /page='chat'/);
    const status = await app.inject({ method: 'GET', url: '/v1/status', headers });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().locked, false);
    assert.equal(status.json().needs_migration, false);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/workspace', headers })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/chats', headers })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/experience', headers })).statusCode, 200);
    const foreign = await app.inject({ method: 'GET', url: '/v1/chats', headers: { ...headers, origin: 'https://evil.example' } });
    assert.equal(foreign.statusCode, 403);
    assert.match(foreign.json().error, /Origem recusada/);
    const crossSite = await app.inject({ method: 'GET', url: '/v1/workspace', headers: { ...headers, 'sec-fetch-site': 'cross-site' } });
    assert.equal(crossSite.statusCode, 403);
    assert.match(crossSite.json().error, /Origem externa recusada/);
    const wrongHost = await app.inject({ method: 'GET', url: '/v1/chats', headers: { ...headers, host: 'evil.example' } });
    assert.equal(wrongHost.statusCode, 403);
    assert.match(wrongHost.json().error, /Host recusado/);
    const anonymous = await app.inject({ method: 'GET', url: '/v1/chats', headers: { host, origin } });
    assert.equal(anonymous.statusCode, 401);
    assert.match(anonymous.json().error, /autenticar esta sessão/);
    const foreignAnonymous = await app.inject({ method: 'POST', url: '/v1/chats', headers: { host, origin: 'https://evil.example' }, payload: {} });
    assert.equal(foreignAnonymous.statusCode, 403);
  } finally {
    await launched.app.close();
    await launched.core.close();
    launched.releaseLock();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualização com cofre antigo abre o Chat, guarda a cópia e a segunda inicialização não pede senha', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startup-legacy-'));
  const prepared = new Core(dir, process.cwd());
  await prepared.init();
  await prepared.setup(password);
  const space = prepared.vault.spaceId;
  prepared.vault.lock();
  const before = readFileSync(prepared.vault.path);
  await prepared.close();
  let launched: Awaited<ReturnType<typeof started>> | undefined;
  let again: Awaited<ReturnType<typeof started>> | undefined;
  try {
  launched = await started(dir);
  try {
    const { app, token, session, core } = launched;
    assert.equal(core.vault.locked, false);
    assert.equal(session.url.includes(`#session=${token}`), true);
    assert.equal(new URL(session.url).hostname, '127.0.0.1');
    const backup = legacyName(dir);
    assert.equal(typeof backup, 'string');
    const backupFile = join(dir, backup!);
    assert.ok(readFileSync(backupFile).equals(before));
    assert.equal(JSON.parse(readFileSync(backupFile, 'utf8')).space_id, space);
    Vault.openSealed(backupFile, password);
    assert.throws(() => Vault.openSealed(core.vault.path, password), /incorreta/);
    const postgres = readdirSync(dir).filter(name => name.startsWith('postgres.legacy-'));
    assert.equal(postgres.length, 1);
    const host = `127.0.0.1:${session.port}`;
    const origin = `http://127.0.0.1:${session.port}`;
    const headers = { host, origin, authorization: 'Bearer ' + token };
    const status = await app.inject({ method: 'GET', url: '/v1/status', headers });
    assert.equal(status.json().locked, false);
    assert.equal(status.json().needs_migration, false);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/workspace', headers })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/chats', headers })).statusCode, 200);
    const listed = await app.inject({ method: 'GET', url: '/v1/vault/legacy', headers });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().backups.length, 1);
    assert.equal(listed.json().backups[0].postgres, true);
    assert.equal(listed.body.includes(password), false);
    const missing = await app.inject({ method: 'GET', url: '/v1/chats', headers: { host, origin } });
    assert.equal(missing.statusCode, 401);
    const foreign = await app.inject({ method: 'GET', url: '/v1/workspace', headers: { host, origin: 'http://evil.example', authorization: 'Bearer ' + token } });
    assert.equal(foreign.statusCode, 403);
  } finally {
    await launched.app.close();
    await launched.core.close();
    launched.releaseLock();
  }
  again = await started(dir);
  try {
    assert.equal(again.core.vault.locked, false);
    assert.equal(readdirSync(dir).filter(name => name.startsWith('vault.enc.json.legacy-')).length, 1);
    assert.ok(readFileSync(join(dir, legacyName(dir)!)).equals(before));
    const host = `127.0.0.1:${again.session.port}`;
    const headers = { host, origin: `http://127.0.0.1:${again.session.port}`, authorization: 'Bearer ' + again.token };
    const status = await again.app.inject({ method: 'GET', url: '/v1/status', headers });
    assert.equal(status.json().locked, false);
    assert.equal(status.json().needs_migration, false);
    assert.equal((await again.app.inject({ method: 'GET', url: '/v1/chats', headers })).statusCode, 200);
  } finally {
    await again.app.close();
    await again.core.close();
    again.releaseLock();
  }
  } finally {
    await launched?.app.close().catch(() => {});
    await launched?.core.close().catch(() => {});
    launched?.releaseLock();
    await again?.app.close().catch(() => {});
    await again?.core.close().catch(() => {});
    again?.releaseLock();
    rmSync(dir, { recursive: true, force: true });
  }
});
