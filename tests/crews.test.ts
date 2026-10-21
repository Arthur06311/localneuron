import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Core } from '../src/core.js';
import { createApp } from '../src/server.js';
import { Experience } from '../src/experience.js';
import { Crews } from '../src/crews.js';
import { CrewSecrets } from '../src/crew-secrets.js';

const TOKEN = 'crew-test-token-aaaa';

async function open() {
  const dir = await mkdtemp(join(tmpdir(), 'neuron-crews-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await core.setup('senha-ficticia-equipes');
  const { app } = await createApp(core, 'crews-fixture');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer crews-fixture', 'idempotency-key': randomUUID() };
  return { dir, core, app, headers };
}

test('Equipes liga os bots existentes e não cria uma segunda lista', async () => {
  const fx = await open();
  try {
    assert.equal((await fx.app.inject({ url: '/v1/crews', headers: { host: fx.headers.host } })).statusCode, 401);
    const empty = (await fx.app.inject({ url: '/v1/crews', headers: fx.headers })).json();
    assert.equal(empty.available_bots.length, 0);
    assert.match(empty.relation, /Minha equipe/);
    assert.equal(empty.settings.max_tokens, 4096);
    assert.equal(empty.settings.max_rounds, 4);
    assert.equal((await fx.app.inject({ method: 'POST', url: '/v1/crews/link', headers: fx.headers })).statusCode, 400);
    const created = (await fx.app.inject({ method: 'POST', url: '/v1/experience/team', headers: { ...fx.headers, 'idempotency-key': randomUUID() }, payload: { use: 'work' } })).json();
    const linked = (await fx.app.inject({ method: 'POST', url: '/v1/crews/link', headers: fx.headers })).json();
    assert.equal(linked.available_bots.length, created.length);
    assert.equal(linked.members.length, created.length);
    assert.equal(linked.members.filter((member: { coordinator: boolean }) => member.coordinator).length, 1);
    const coordinator = linked.members.find((member: { template: string }) => member.template === 'work-ceo');
    assert.equal(coordinator.coordinator, true);
    assert.equal(coordinator.mascot, 'coordenador');
    assert.equal(coordinator.name, created.find((bot: { template: string }) => bot.template === 'work-ceo').name);
    const again = (await fx.app.inject({ method: 'POST', url: '/v1/crews/link', headers: { ...fx.headers, 'idempotency-key': randomUUID() } })).json();
    assert.equal(again.members.length, created.length);
    assert.equal((await fx.app.inject({ url: '/v1/experience', headers: fx.headers })).json().bots.length, created.length);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test('Cada agente pode ter um modelo menor e só o coordenador aceita 70B ou nuvem', async () => {
  const fx = await open();
  try {
    await fx.app.inject({ method: 'POST', url: '/v1/experience/team', headers: fx.headers, payload: { use: 'work' } });
    const crew = (await fx.app.inject({ method: 'POST', url: '/v1/crews/link', headers: { ...fx.headers, 'idempotency-key': randomUUID() } })).json();
    const coordinator = crew.members.find((member: { coordinator: boolean }) => member.coordinator);
    const colleague = crew.members.find((member: { coordinator: boolean }) => !member.coordinator);
    const small = await fx.app.inject({ method: 'POST', url: `/v1/crews/members/${colleague.bot_id}/model`, headers: { ...fx.headers, 'idempotency-key': randomUUID() }, payload: { model: 'qwen35-9b' } });
    assert.equal(small.statusCode, 200);
    assert.equal(small.json().members.find((member: { bot_id: string }) => member.bot_id === colleague.bot_id).model, 'qwen35-9b');
    const blocked = await fx.app.inject({ method: 'POST', url: `/v1/crews/members/${colleague.bot_id}/model`, headers: { ...fx.headers, 'idempotency-key': randomUUID() }, payload: { model: 'gpt-oss-120b' } });
    assert.equal(blocked.statusCode, 400);
    assert.match(blocked.json().error, /coordenador/);
    const large = await fx.app.inject({ method: 'POST', url: `/v1/crews/members/${coordinator.bot_id}/model`, headers: { ...fx.headers, 'idempotency-key': randomUUID() }, payload: { model: 'gpt-oss-120b' } });
    assert.equal(large.statusCode, 200);
    const bots = (await fx.app.inject({ url: '/v1/experience', headers: fx.headers })).json().bots;
    assert.equal(bots.find((bot: { id: string }) => bot.id === coordinator.bot_id).model, 'gpt-oss-120b');
    assert.equal(bots.find((bot: { id: string }) => bot.id === colleague.bot_id).model, 'qwen35-9b');
    const cloud = await fx.app.inject({
      method: 'POST', url: '/v1/crews/providers', headers: fx.headers,
      payload: { kind: 'anthropic', label: 'Claude', acknowledged: true, confirm_remote: true, token: TOKEN },
    });
    assert.equal(cloud.statusCode, 200);
    const provider = cloud.json();
    assert.equal(provider.leaves_computer, true);
    assert.equal(provider.has_token, true);
    assert.equal(provider.token_hint, '••••aaaa');
    assert.equal(JSON.stringify(provider).includes(TOKEN), false);
    const raw = await readFile(join(fx.dir, 'crew-providers.enc.json'), 'utf8');
    assert.equal(raw.includes(TOKEN), false);
    if (process.platform !== 'win32') assert.equal((await stat(join(fx.dir, 'crew-providers.enc.json'))).mode & 0o777, 0o600);
    const assigned = await fx.app.inject({ method: 'PATCH', url: `/v1/crews/members/${colleague.bot_id}`, headers: fx.headers, payload: { provider_id: provider.id } });
    assert.equal(assigned.statusCode, 400);
    assert.equal((await fx.app.inject({ method: 'PATCH', url: `/v1/crews/members/${coordinator.bot_id}`, headers: fx.headers, payload: { provider_id: provider.id } })).statusCode, 200);
    const settings = await fx.app.inject({ method: 'POST', url: '/v1/crews/settings', headers: fx.headers, payload: { max_rounds: 2, max_tokens: 1024 } });
    assert.equal(settings.json().settings.max_tokens, 1024);
    assert.equal((await fx.app.inject({ method: 'POST', url: '/v1/crews/settings', headers: fx.headers, payload: { max_rounds: 9, max_tokens: 1024 } })).statusCode, 400);
    const sent = await fx.app.inject({ method: 'POST', url: `/v1/crews/members/${colleague.bot_id}/messages`, headers: fx.headers, payload: { content: 'Olá da equipe' } });
    assert.equal(sent.json().at(-1).content, 'Olá da equipe');
    assert.equal(sent.json().at(-1).tokens > 0, true);
    assert.equal((await fx.app.inject({ url: '/v1/crews', headers: fx.headers })).json().members.find((member: { bot_id: string }) => member.bot_id === colleague.bot_id).unread, 0);
    const direct = new Crews(fx.core.store.db, new CrewSecrets(fx.dir, fx.core.vault), new Experience(fx.core), () => [], () => ({ totalMemoryBytes: 1, availableMemoryBytes: 1, diskFreeBytes: 1, platform: 'linux', architecture: 'x64' }));
    await direct.recordIncoming(colleague.bot_id, 'agent', 'Resposta do colega', 1);
    const unread = (await fx.app.inject({ url: '/v1/crews', headers: fx.headers })).json();
    assert.equal(unread.members.find((member: { bot_id: string }) => member.bot_id === colleague.bot_id).unread, 1);
    assert.equal((await fx.app.inject({ url: '/v1/crews/team/messages', headers: fx.headers })).json()[0].content, 'Resposta do colega');
    assert.equal((await fx.app.inject({ method: 'POST', url: `/v1/crews/members/${colleague.bot_id}/read`, headers: fx.headers })).json().members.find((member: { bot_id: string }) => member.bot_id === colleague.bot_id).unread, 0);
    assert.equal((await fx.app.inject({ method: 'DELETE', url: `/v1/crews/members/${coordinator.bot_id}`, headers: fx.headers })).statusCode, 400);
    assert.equal((await fx.app.inject({ method: 'DELETE', url: `/v1/crews/members/${colleague.bot_id}`, headers: fx.headers })).statusCode, 200);
    assert.equal((await fx.app.inject({ url: '/v1/experience', headers: fx.headers })).json().bots.some((bot: { id: string }) => bot.id === colleague.bot_id), true);
    assert.equal((await fx.app.inject({ method: 'POST', url: '/v1/crews/providers', headers: fx.headers, payload: { kind: 'exo', label: 'Rede', endpoint: 'http://192.168.1.9:52415' } })).statusCode, 400);
    assert.equal((await fx.app.inject({ url: '/v1/sharing', headers: fx.headers })).json().enabled, false);
    assert.equal((await fx.app.inject({ url: '/v1/exo', headers: fx.headers })).json().expose_lan, false);
    fx.core.vault.lock();
    assert.equal((await fx.app.inject({ url: '/v1/crews', headers: fx.headers })).statusCode, 423);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test('O limite por rota responde 429 e não corta as outras rotas', async () => {
  const fx = await open();
  try {
    const payload = { max_rounds: 3, max_tokens: 512 };
    const codes = [];
    for (let i = 0; i < 31; i++) codes.push((await fx.app.inject({ method: 'POST', url: '/v1/crews/settings', headers: fx.headers, payload })).statusCode);
    assert.deepEqual(codes.slice(0, 30), Array(30).fill(200));
    assert.equal(codes[30], 429);
    assert.equal((await fx.app.inject({ url: '/v1/status', headers: fx.headers })).statusCode, 200);
    assert.equal((await fx.app.inject({ url: '/v1/crews', headers: fx.headers })).statusCode, 200);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});
