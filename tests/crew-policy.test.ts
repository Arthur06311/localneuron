import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAssignable, classifyHost, planProvider, redactSecrets, tokenHint } from '../src/crew-policy.js';

const remote = { acknowledged: true, confirm_remote: true, token: 'crew-test-token-aaaa' };

test('EXO da equipe só aceita loopback e não leva token', () => {
  assert.equal(planProvider({ kind: 'exo', label: 'EXO local' }).endpoint, 'http://127.0.0.1:52415');
  assert.equal(planProvider({ kind: 'exo', label: 'EXO local', endpoint: 'http://localhost:52415' }).leaves_computer, false);
  for (const endpoint of ['http://192.168.1.20:52415', 'http://10.0.0.4:52415', 'https://127.0.0.1:52415', 'http://1.1.1.1:52415']) {
    assert.throws(() => planProvider({ kind: 'exo', label: 'EXO', endpoint }), /loopback/);
  }
  assert.equal(planProvider({ kind: 'exo', label: 'EXO', token: 'crew-test-token-aaaa' }).token, null);
});

test('Outro computador exige confirmação, token e TLS ou rede privada', () => {
  assert.throws(() => planProvider({ kind: 'openai', label: 'LM', endpoint: 'http://192.168.0.8:1234/v1', ...remote, trusted_network: false }), /HTTPS|confiável/);
  const lan = planProvider({ kind: 'openai', label: 'LM', endpoint: 'http://192.168.0.8:1234/v1', ...remote, trusted_network: true });
  assert.equal(lan.leaves_computer, true);
  assert.equal(lan.endpoint, 'http://192.168.0.8:1234/v1');
  assert.throws(() => planProvider({ kind: 'openai', label: 'LM', endpoint: 'http://1.1.1.1:1234/v1', ...remote, trusted_network: true }), /HTTPS|confiável/);
  assert.throws(() => planProvider({ kind: 'openai', label: 'LM', endpoint: 'https://10.0.0.5:1234/v1', token: 'crew-test-token-aaaa' }), /sai do computador/);
  assert.throws(() => planProvider({ kind: 'openai', label: 'LM', endpoint: 'http://169.254.169.254/v1', ...remote, trusted_network: true }), /recusado/);
  assert.throws(() => planProvider({ kind: 'openai', label: 'LM', endpoint: 'http://user:crew-test-token-aaaa@127.0.0.1:1234/v1' }), /usuário/);
  assert.equal(classifyHost('127.0.0.1'), 'loopback');
  assert.equal(classifyHost('10.1.1.1'), 'private');
  assert.equal(classifyHost('8.8.8.8'), 'public');
  const nas = planProvider({ kind: 'openai', label: 'NAS', endpoint: 'http://nas.lan:1234/v1', ...remote, trusted_network: true });
  assert.equal(nas.endpoint, 'http://nas.lan:1234/v1');
  assert.equal(classifyHost('printer.local'), 'private');
  const printer = planProvider({ kind: 'openai', label: 'Impressora', endpoint: 'http://printer.local:1234/v1', ...remote, trusted_network: true });
  assert.equal(printer.endpoint, 'http://printer.local:1234/v1');
  assert.throws(() => planProvider({ kind: 'openai', label: 'NAS', endpoint: 'http://nas.lan:1234/v1', ...remote, trusted_network: false }), /HTTPS|confiável/);
  const home = planProvider({ kind: 'openai', label: 'Casa', endpoint: 'https://box.home.arpa/v1', ...remote });
  assert.equal(home.endpoint, 'https://box.home.arpa/v1');
  const tailscale = planProvider({ kind: 'openai', label: 'VPN', endpoint: 'https://mac.ts.net/v1', ...remote });
  assert.equal(tailscale.endpoint, 'https://mac.ts.net/v1');
  assert.throws(() => planProvider({ kind: 'openai', label: 'Meta', endpoint: 'https://metadata.google.internal/v1', ...remote, trusted_network: true }), /recusado/);
});

test('Anthropic e xAI ficam marcados como saída do computador e não aceitam outro host', () => {
  const anthropic = planProvider({ kind: 'anthropic', label: 'Claude', ...remote });
  assert.equal(anthropic.endpoint, 'https://api.anthropic.com');
  assert.equal(anthropic.leaves_computer, true);
  assert.equal(anthropic.token, 'crew-test-token-aaaa');
  assert.throws(() => planProvider({ kind: 'xai', label: 'Grok', endpoint: 'https://example.com', ...remote }), /api\.x\.ai/);
  assert.throws(() => planProvider({ kind: 'anthropic', label: 'Claude', confirm_remote: true, token: 'crew-test-token-aaaa' }), /sai do computador/);
  assert.equal(tokenHint('crew-test-token-aaaa'), '••••aaaa');
  assert.equal(redactSecrets('falha crew-test-token-aaaa no pedido', ['crew-test-token-aaaa']), 'falha •••• no pedido');
});

test('Modelo grande ou provedor que sai do computador só no coordenador', () => {
  assert.doesNotThrow(() => assertAssignable(false, 'qwen35-9b', 9, 'local', false));
  assert.throws(() => assertAssignable(false, 'gpt-oss-120b', 120, 'local', false), /coordenador/);
  assert.throws(() => assertAssignable(false, 'exo:grande', null, 'local', false), /coordenador/);
  assert.throws(() => assertAssignable(false, 'qwen35-9b', 9, 'anthropic', true), /coordenador/);
  assert.doesNotThrow(() => assertAssignable(true, 'gpt-oss-120b', 120, 'xai', true));
});
