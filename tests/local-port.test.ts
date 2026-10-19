import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer, type AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listenWithFallback, portFallbackMessage, portInUseMessage, preferredPort } from '../src/local-port.js';
import { openLocalServer } from '../src/server.js';
const { resetEnvWarnings } = createRequire(resolve('desktop/env.cjs'))('./env.cjs') as { resetEnvWarnings: () => void };

function hold(port = 0) {
  const server = createServer();
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = (server.address() as AddressInfo).port;
      resolve({ port: actual, close: () => new Promise((res, rej) => server.close(error => error ? rej(error) : res())) });
    });
  });
}

test('Porta preferida continua válida e, se ocupada, a próxima livre é usada', async () => {
  const quiet = () => {};
  assert.equal(preferredPort({} as NodeJS.ProcessEnv), 4317);
  assert.equal(preferredPort({ COLMEIA_PORT: '4400' } as NodeJS.ProcessEnv, undefined, quiet), 4400);
  for (const raw of ['0', '65536', '4317a', '8080 ', '']) {
    if (raw === '') { assert.equal(preferredPort({ COLMEIA_PORT: '' } as NodeJS.ProcessEnv, undefined, quiet), 4317); continue; }
    assert.throws(() => preferredPort({ COLMEIA_PORT: raw } as NodeJS.ProcessEnv, undefined, quiet), /COLMEIA_PORT inválida/);
  }
  resetEnvWarnings();
  const warnings: string[] = [];
  assert.equal(preferredPort({ LOCALNEURON_PORT: '4500', COLMEIA_PORT: '4400' } as NodeJS.ProcessEnv, undefined, message => warnings.push(message)), 4500);
  assert.equal(warnings.length, 0);
  assert.equal(preferredPort({ COLMEIA_PORT: '4400' } as NodeJS.ProcessEnv, undefined, message => warnings.push(message)), 4400);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /COLMEIA_PORT está descontinuada\. Use LOCALNEURON_PORT/);
  assert.equal(warnings[0].includes('4400'), false);
  assert.throws(() => preferredPort({ LOCALNEURON_PORT: 'zero', COLMEIA_PORT: '4317' } as NodeJS.ProcessEnv, undefined, quiet), /LOCALNEURON_PORT inválida/);
  const blocker = await hold();
  const probe = await hold();
  const free = probe.port;
  await probe.close();
  const held: { close: () => Promise<void> }[] = [];
  try {
    const same = await listenWithFallback(free, async port => { held.push(await hold(port)); }, 1);
    assert.equal(same.port, free);
    assert.equal(same.fallback, false);
    assert.equal(same.message, null);
    assert.equal(same.origin, `http://127.0.0.1:${same.port}`);
    const moved = await listenWithFallback(blocker.port, async port => { held.push(await hold(port)); }, 5);
    assert.ok(moved.port > blocker.port);
    assert.equal(moved.fallback, true);
    assert.equal(moved.message, portFallbackMessage(blocker.port, moved.port));
    await assert.rejects(listenWithFallback(blocker.port, async () => {
      const error = new Error('ocupada') as NodeJS.ErrnoException;
      error.code = 'EADDRINUSE';
      throw error;
    }, 3), (error: Error) => error.message === portInUseMessage(blocker.port));
    await assert.rejects(listenWithFallback(blocker.port + 30, async () => { throw new Error('falha distinta'); }, 3), /falha distinta/);
  } finally {
    await Promise.all([blocker.close(), ...held.map(server => server.close())]);
  }
});

test('Servidor grava a porta real e CSP, Minha API e EXO seguem essa origem', async () => {
  const blocker = await hold();
  const dir = mkdtempSync(join(tmpdir(), 'neuron-port-'));
  let started: Awaited<ReturnType<typeof openLocalServer>> | undefined;
  try {
    started = await openLocalServer(dir, process.cwd(), { COLMEIA_PORT: String(blocker.port) } as NodeJS.ProcessEnv);
    const { session, app, token } = started;
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'session.json'), 'utf8')).port, session.port);
    assert.ok(session.port > blocker.port);
    assert.equal(session.fallback, true);
    assert.equal(session.preferred_port, blocker.port);
    assert.equal(session.url, `http://127.0.0.1:${session.port}/#session=${token}`);
    assert.equal(session.message, portFallbackMessage(blocker.port, session.port));
    const host = `127.0.0.1:${session.port}`;
    const origin = `http://127.0.0.1:${session.port}`;
    const page = await app.inject({ method: 'GET', url: '/', headers: { host, origin } });
    assert.equal(page.statusCode, 200);
    assert.match(String(page.headers['content-security-policy']), /default-src 'self'/);
    assert.match(String(page.headers['content-security-policy']), /connect-src 'self'/);
    const wrongHost = await app.inject({ method: 'GET', url: '/', headers: { host: `127.0.0.1:${blocker.port}` } });
    assert.equal(wrongHost.statusCode, 403);
    assert.match(wrongHost.json().error, /Host recusado/);
    const wrongOrigin = await app.inject({ method: 'GET', url: '/', headers: { host, origin: 'http://127.0.0.1:4317' } });
    assert.equal(wrongOrigin.statusCode, 403);
    assert.match(wrongOrigin.json().error, /Origem recusada/);
    const headers = { host, origin, authorization: 'Bearer ' + token };
    for (const url of ['/v1/sharing', '/v1/exo']) {
      assert.equal((await app.inject({ method: 'GET', url, headers })).statusCode, 423);
      assert.equal((await app.inject({ method: 'GET', url, headers: { ...headers, host: `127.0.0.1:${blocker.port}`, origin: `http://127.0.0.1:${blocker.port}` } })).statusCode, 403);
      if (session.port !== 4317) assert.equal((await app.inject({ method: 'GET', url, headers: { ...headers, host: '127.0.0.1:4317', origin: 'http://127.0.0.1:4317' } })).statusCode, 403);
    }
  } finally {
    await started?.app.close().catch(() => {});
    await started?.core.close().catch(() => {});
    started?.releaseLock();
    await blocker.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
