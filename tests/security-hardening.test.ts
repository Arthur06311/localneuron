import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decideOAuthOrigin } from '../src/connections.js';
import { classifyHost } from '../src/crew-policy.js';
import { assertLocalExecutable } from '../src/local-command.js';
import { redactSensitive } from '../src/redact-log.js';
import { LOCAL_REQUESTS_PER_MINUTE, createApp, localRateLimitError } from '../src/server.js';
import { exoPreviewPath } from '../src/server-gateway.js';
import { startupMessage } from '../src/startup-errors.js';
import { Core } from '../src/core.js';

const { hostClass, isLoopbackPeer, isPublicHttpUrl, isAgentRequestUrl } = createRequire(import.meta.url)(
  resolve('desktop/public-url.cjs'),
) as {
  hostClass: (hostname: string) => string;
  isLoopbackPeer: (ip: string) => boolean;
  isPublicHttpUrl: (value: string) => boolean;
  isAgentRequestUrl: (value: string) => boolean;
};

test('Classificação de host é a mesma no desktop e no servidor', () => {
  const cases: Array<[string, string]> = [
    ['127.0.0.1', 'loopback'],
    ['127.0.0.2', 'loopback'],
    ['localhost', 'loopback'],
    ['::1', 'loopback'],
    ['::ffff:127.0.0.1', 'loopback'],
    ['10.1.1.1', 'private'],
    ['192.168.0.8', 'private'],
    ['100.64.0.1', 'private'],
    ['8.8.8.8', 'public'],
    ['169.254.169.254', 'blocked'],
    ['0.0.0.0', 'blocked'],
    ['metadata.google.internal', 'blocked'],
    ['printer.local', 'blocked'],
    ['2130706433', 'loopback'],
  ];
  for (const [host, expected] of cases) {
    assert.equal(hostClass(host), expected, host);
    assert.equal(classifyHost(host), host === 'printer.local' ? 'private' : expected, host);
  }
  assert.equal(hostClass('nas.lan'), 'public');
  assert.equal(classifyHost('nas.lan'), 'private');
  assert.equal(hostClass('box.home.arpa'), 'public');
  assert.equal(classifyHost('box.home.arpa'), 'private');
  assert.equal(hostClass('mac.ts.net'), 'public');
  assert.equal(classifyHost('mac.ts.net'), 'private');
  assert.equal(classifyHost('metadata.google.internal'), 'blocked');
  assert.equal(classifyHost('files.internal'), 'blocked');
  assert.equal(isPublicHttpUrl('https://example.com/docs'), true);
  assert.equal(isPublicHttpUrl('http://127.0.0.2/'), false);
  assert.equal(isPublicHttpUrl('http://169.254.169.254/'), false);
  assert.equal(isPublicHttpUrl('http://2130706433/'), false);
  assert.equal(isLoopbackPeer('127.0.0.1'), true);
  assert.equal(isLoopbackPeer('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackPeer('8.8.8.8'), false);
  assert.equal(isLoopbackPeer(''), false);
  assert.equal(isAgentRequestUrl('wss://example.com/socket'), true);
  assert.equal(isAgentRequestUrl('ws://example.com/socket'), true);
  assert.equal(isAgentRequestUrl('wss://127.0.0.1/socket'), false);
  assert.equal(isAgentRequestUrl('ws://192.168.0.8/socket'), false);
  assert.equal(isAgentRequestUrl('wss://user:secret@example.com/socket'), false);
});

test('Executável local recusa shell e aceita o Node absoluto', () => {
  assert.throws(() => assertLocalExecutable('/bin/bash', ['-c', 'id']), /shell/);
  assert.throws(() => assertLocalExecutable('node', []), /absoluto/);
  assert.throws(() => assertLocalExecutable('/usr/bin/node\0', []), /absoluto/);
  assert.doesNotThrow(() => assertLocalExecutable(process.execPath, [join(tmpdir(), 'servidor.mjs')]));
});

test('OAuth externo não alcança metadados, rede privada nem loopback de um MCP público', () => {
  const mcp = 'https://api.example/mcp';
  for (const url of [
    'https://metadata.google.internal/token',
    'https://169.254.169.254/latest',
    'https://10.0.0.5/token',
    'https://127.0.0.1/token',
    'http://printer.local/token',
  ]) assert.throws(() => decideOAuthOrigin(new URL(url), mcp), /recusada/, url);
  const local = 'http://127.0.0.1:4317/mcp';
  assert.deepEqual(decideOAuthOrigin(new URL('https://127.0.0.1:8443/token'), local), { pin: 'https://127.0.0.1:8443' });
  assert.deepEqual(decideOAuthOrigin(new URL('https://auth.example/authorize'), local), { pin: 'https://auth.example' });
});

test('Mensagens de arranque e registros ocultam segredo e caminho pessoal', () => {
  const disk = Object.assign(new Error('cheio'), { code: 'ENOSPC' });
  assert.equal(startupMessage(disk), 'Não há espaço em disco para abrir o LocalNeuron.');
  const leaked = startupMessage(new Error('falha sk-abcdefghijklmnopqrst em /home/ada/vault'));
  assert.match(leaked, /••••/);
  assert.doesNotMatch(leaked, /sk-abc/);
  assert.doesNotMatch(leaked, /\/home\/ada/);
  assert.equal(redactSensitive('Bearer hf_abcdefghijklmnopqrstuvwxyz'), '••••');
  assert.equal(startupMessage(new Error('')), 'O serviço local não iniciou.');
});

test('Consulta encaminhada ao EXO não aceita quebra de linha nem tamanho absurdo', () => {
  assert.equal(exoPreviewPath('/exo/previews?id=1'), '/instance/previews?id=1');
  assert.throws(() => exoPreviewPath('/exo/previews?a=1\r\nHost:evil'), /Consulta recusada/);
  assert.throws(() => exoPreviewPath('/exo/previews?' + 'a'.repeat(513)), /Consulta recusada/);
});

test('Limite local devolve 429 em português', () => {
  assert.equal(LOCAL_REQUESTS_PER_MINUTE, 1200);
  const error = localRateLimitError();
  assert.equal(error.statusCode, 429);
  assert.match(error.message, /Aguarde/);
});

test('Servidor local recusa par remoto, token vazio e publica a CSP estrita', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-security-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-segura');
  const { app } = await createApp(core, '');
  try {
    const host = { host: '127.0.0.1:4317' };
    assert.equal((await app.inject({ method: 'GET', url: '/v1/status', headers: host })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/status', headers: { ...host, authorization: 'Bearer ' } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/', headers: host, remoteAddress: '8.8.8.8' })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/', headers: { host: 'rebind.local' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/', headers: { ...host, 'sec-fetch-site': 'cross-site' } })).statusCode, 403);
    const page = await app.inject({ method: 'GET', url: '/', headers: host });
    const csp = String(page.headers['content-security-policy']);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-src 'none'/);
    assert.match(csp, /worker-src 'self'/);
    assert.match(csp, /connect-src 'self' blob:/);
    assert.equal(page.headers['x-frame-options'], 'DENY');
    assert.match(String(page.headers['permissions-policy']), /camera=\(\)/);
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
