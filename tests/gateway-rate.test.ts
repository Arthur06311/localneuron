import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { Gateway, apiRateLimit } from '../src/gateway.js';
import { optionsSchema } from '../src/inference.js';

const { resetEnvWarnings } = createRequire(import.meta.url)('../../desktop/env.cjs') as { resetEnvWarnings:()=>void };
const reply = { text:'ok', finish_reason:'stop' as const, elapsed_ms:1, omitted_messages:0, context:4096 };

test('Limite da Minha API responde 429 com Retry-After e separa chave de IP', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'api-rate-'));
  const gateway = new Gateway(dir, () => true, async () => reply, 0, process.cwd(), () => true, { max: 2, windowSeconds: 60 });
  try {
    const { key } = await gateway.rotate();
    const other = gateway.addKey({ name: 'Outro', daily: 20, max_tokens: 128 });
    await gateway.start('127.0.0.1', 'model', optionsSchema.parse({}));
    assert.equal(gateway.status().exposed, false);
    const url = gateway.status().base_url!;
    const call = (token?: string) => fetch(url + '/models', { headers: token ? { authorization: 'Bearer ' + token } : {} });
    assert.equal((await call(key)).status, 200);
    assert.equal((await call(key)).status, 200);
    const blocked = await call(key);
    assert.equal(blocked.status, 429);
    const retry = Number(blocked.headers.get('retry-after'));
    assert.equal(Number.isInteger(retry), true);
    assert.ok(retry >= 1 && retry <= 60);
    const body = await blocked.json() as { error: { message: string, type: string } };
    assert.equal(body.error.message, 'Muitas chamadas num curto intervalo. Aguarde e tente novamente.');
    assert.equal(body.error.type, 'rate_limit');
    assert.equal(JSON.stringify(body).includes(key), false);
    assert.equal((await call(other.key)).status, 200);
    assert.equal((await call()).status, 401);
    assert.equal((await call()).status, 401);
    const byIp = await call();
    assert.equal(byIp.status, 429);
    assert.equal(Number(byIp.headers.get('retry-after')) >= 1, true);
    assert.match(await byIp.text(), /Muitas chamadas/);
  } finally {
    await gateway.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Limite configurável prefere LOCALNEURON_* e mantém COLMEIA_* sem expor o valor', () => {
  resetEnvWarnings();
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  assert.deepEqual(apiRateLimit({
    LOCALNEURON_API_RATE_LIMIT: '8',
    COLMEIA_API_RATE_LIMIT: '3',
    LOCALNEURON_API_RATE_WINDOW_SECONDS: '15',
    COLMEIA_API_RATE_WINDOW_SECONDS: '9',
  }, warn), { max: 8, windowSeconds: 15 });
  assert.equal(warnings.length, 0);
  resetEnvWarnings();
  assert.deepEqual(apiRateLimit({ COLMEIA_API_RATE_LIMIT: '9' }, warn), { max: 9, windowSeconds: 60 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /COLMEIA_API_RATE_LIMIT está descontinuada\. Use LOCALNEURON_API_RATE_LIMIT/);
  assert.equal(warnings[0].includes('9'), false);
  apiRateLimit({ COLMEIA_API_RATE_LIMIT: '9' }, warn);
  assert.equal(warnings.length, 1);
  assert.deepEqual(apiRateLimit({ LOCALNEURON_API_RATE_LIMIT: '0', LOCALNEURON_API_RATE_WINDOW_SECONDS: '99999' }, warn), { max: 60, windowSeconds: 60 });
  resetEnvWarnings();
});
