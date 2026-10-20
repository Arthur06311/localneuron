import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Vault } from '../src/vault.js';
import { EXO_LAN_WARNING, ServerGateway, assertLanAddress } from '../src/server-gateway.js';

const password = 'senha-local-12';

function harness(now = () => 1_000_000, role = () => 'manage', exoRunning = () => true) {
  const dir = mkdtempSync(join(tmpdir(), 'server-gateway-'));
  const vault = new Vault(dir);
  vault.initialize(password);
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(String(url));
    return Response.json({ nodes: ['mac-sala'] });
  }) as typeof fetch;
  const gateway = new ServerGateway(dir, vault, fetcher, () => 'http://127.0.0.1:52415', exoRunning, role, now);
  return { dir, gateway, calls, vault };
}

test('O gateway recusa IP público e escuta em todas as interfaces', () => {
  assert.throws(() => assertLanAddress('1.1.1.1'), /Exposição pública fica fora/);
  assert.throws(() => assertLanAddress('0.0.0.0'), /todas as interfaces/);
  assert.throws(() => assertLanAddress('8.8.8.8'), /Exposição pública fica fora/);
  assert.equal(assertLanAddress('192.168.1.20'), '192.168.1.20');
  assert.equal(assertLanAddress('10.1.2.3'), '10.1.2.3');
  assert.equal(assertLanAddress('127.0.0.1'), '127.0.0.1');
});

test('O código de 6 dígitos expira e trava depois de cinco tentativas', async () => {
  let now = 1_000_000;
  const { dir, gateway } = harness(() => now);
  try {
    const issued = gateway.createCode();
    assert.match(issued.code, /^\d{6}$/);
    now += 60_001;
    assert.throws(() => gateway.pair('192.168.1.8', { code: issued.code, name: 'Sala' }), /expirou/);
    now = 1_000_000;
    const again = gateway.createCode();
    for (let attempt = 0; attempt < 5; attempt++) assert.throws(() => gateway.pair('192.168.1.8', { code: '000000', name: 'Sala' }), /recusado|Muitas tentativas/);
    assert.throws(() => gateway.pair('192.168.1.8', { code: again.code, name: 'Sala' }), /Muitas tentativas|desligado|expirou/);
  } finally {
    await gateway.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A máquina pareada fala com o EXO simulado, fica no registo e pode ser revogada', async () => {
  const { dir, gateway, calls } = harness();
  try {
    const issued = gateway.createCode();
    assert.throws(() => gateway.pair('1.1.1.1', { code: issued.code, name: 'Rua' }), /Exposição pública/);
    const paired = gateway.pair('192.168.1.8', { code: issued.code, name: 'Mac da sala' });
    assert.equal(gateway.status().peers[0].name, 'Mac da sala');
    assert.equal('key' in gateway.status().peers[0], false);
    const forwarded = await gateway.forward('192.168.1.8', 'Bearer ' + paired.key, '/state');
    assert.equal(forwarded.machine, 'Mac da sala');
    assert.deepEqual(calls, ['http://127.0.0.1:52415/state']);
    assert.equal(gateway.readLog()[0].path, '/state');
    assert.equal(gateway.status().exo_warning, EXO_LAN_WARNING);
    gateway.revoke({ id: paired.id });
    await assert.rejects(() => gateway.forward('192.168.1.8', 'Bearer ' + paired.key, '/state'), /não está pareada/);
    assert.equal(calls.length, 1);
    await gateway.stop();
    assert.throws(() => gateway.pair('192.168.1.8', { code: '123456', name: 'Outra' }), /desligado/);
  } finally {
    await gateway.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('O pareamento pela rota tem limite e não aceita a internet', async () => {
  const { dir, gateway } = harness();
  try {
    await gateway.ready();
    gateway.createCode();
    const refused = await gateway.app.inject({ method: 'POST', url: '/pair', remoteAddress: '8.8.8.8', payload: { code: '000000', name: 'Rua' } });
    assert.equal(refused.statusCode, 400);
    assert.match(refused.body, /Exposição pública/);
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await gateway.app.inject({ method: 'POST', url: '/pair', remoteAddress: '192.168.1.9', payload: { code: '111111', name: 'Sala' } });
      assert.ok(response.statusCode === 401 || response.statusCode === 429);
    }
    const blocked = await gateway.app.inject({ method: 'POST', url: '/pair', remoteAddress: '192.168.1.9', payload: { code: '111111', name: 'Sala' } });
    assert.equal(blocked.statusCode, 429);
    assert.match(blocked.body, /gateway do modo servidor|Muitas tentativas/);
  } finally {
    await gateway.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
