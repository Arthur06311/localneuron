import test from 'node:test';
import assert from 'node:assert/strict';
import { crewRemoteComplete, remoteDestination, type RemoteProvider } from '../src/crew-remote.js';

const TOKEN = 'crew-test-token-aaaa';

function provider(patch: Partial<RemoteProvider> = {}): RemoteProvider {
  return {
    kind: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    model: 'claude-test',
    leaves_computer: true,
    trusted_network: false,
    acknowledged: true,
    confirm_remote: true,
    enabled: true,
    token: TOKEN,
    ...patch,
  };
}

test('Anthropic e xAI ficam presos aos endereços oficiais e o token não volta no erro', async () => {
  const seen: { url: string; redirect: string; headers: Record<string, string>; body: string }[] = [];
  const fetchImpl = async (url: string, init: { redirect: 'error'; headers: Record<string, string>; body: string }) => {
    seen.push({ url, redirect: init.redirect, headers: init.headers, body: init.body });
    if (url.includes('anthropic')) return { ok: false, status: 401, text: async () => `chave ${TOKEN} recusada` };
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'da xAI' } }] }) };
  };
  await assert.rejects(() => crewRemoteComplete(provider(), [{ role: 'user', content: 'olá' }], 200, new AbortController().signal, fetchImpl), (error: Error) => {
    assert.equal(error.message.includes(TOKEN), false);
    assert.match(error.message, /401/);
    return true;
  });
  assert.equal(seen[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen[0].redirect, 'error');
  assert.equal(seen[0].headers['x-api-key'], TOKEN);
  assert.deepEqual(Object.keys(seen[0].headers).sort(), ['anthropic-version', 'content-type', 'x-api-key']);
  assert.equal(seen[0].body.includes('claude-test'), true);

  const xai = await crewRemoteComplete(provider({ kind: 'xai', endpoint: 'https://api.x.ai' }), [{ role: 'user', content: 'olá' }], 200, new AbortController().signal, fetchImpl);
  assert.equal(xai.text, 'da xAI');
  assert.equal(seen[1].url, 'https://api.x.ai/v1/chat/completions');
  assert.equal(seen[1].headers.authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(Object.keys(seen[1].headers).sort(), ['authorization', 'content-type']);
});

test('outro computador exige HTTPS ou rede privada, e o EXO não sai do loopback', async () => {
  assert.throws(() => remoteDestination(provider({ kind: 'openai', endpoint: 'http://example.com/v1', leaves_computer: true, model: 'remoto' })), /HTTPS|rede privada/);
  assert.throws(() => remoteDestination(provider({ kind: 'openai', endpoint: 'http://192.168.1.20/v1', leaves_computer: true, trusted_network: false, model: 'remoto' })), /HTTPS|rede privada/);
  assert.throws(() => remoteDestination(provider({ kind: 'openai', endpoint: 'http://169.254.169.254/v1', leaves_computer: true, model: 'remoto' })), /recusado|HTTPS|rede privada/);
  assert.throws(() => remoteDestination(provider({ kind: 'exo', endpoint: 'http://192.168.1.20:52415', leaves_computer: false, acknowledged: false, confirm_remote: false, token: null, model: 'llama' })), /loopback/);
  const loop = remoteDestination(provider({ kind: 'openai', endpoint: 'http://127.0.0.1:8080/v1', leaves_computer: false, acknowledged: false, confirm_remote: false, token: null, model: 'local-compat' }));
  assert.equal(loop.url, 'http://127.0.0.1:8080/v1/chat/completions');
  const exo = remoteDestination(provider({ kind: 'exo', endpoint: 'http://127.0.0.1:52415', leaves_computer: false, acknowledged: false, confirm_remote: false, token: null, model: 'llama' }));
  assert.equal(exo.url, 'http://127.0.0.1:52415/v1/chat/completions');
  assert.equal(exo.token, null);
  const trusted = remoteDestination(provider({ kind: 'openai', endpoint: 'http://10.0.0.8/v1', leaves_computer: true, trusted_network: true, model: 'remoto' }));
  assert.equal(trusted.url, 'http://10.0.0.8/v1/chat/completions');
});
