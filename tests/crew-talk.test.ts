import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Core } from '../src/core.js';
import { createApp } from '../src/server.js';
import { Experience } from '../src/experience.js';
import { Crews } from '../src/crews.js';
import { CrewSecrets } from '../src/crew-secrets.js';
import { CrewTalk, runCrewTalk, type TalkComplete } from '../src/crew-talk.js';

const MACHINE = { totalMemoryBytes: 16 * 1024 ** 3, availableMemoryBytes: 8 * 1024 ** 3, diskFreeBytes: 20 * 1024 ** 3, platform: 'linux', architecture: 'x64' };

async function open() {
  const dir = await mkdtemp(join(tmpdir(), 'neuron-talk-'));
  const core = new Core(dir, process.cwd());
  await core.init();
  await core.setup('senha-ficticia-equipes');
  const { app } = await createApp(core, 'crews-fixture');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer crews-fixture', 'idempotency-key': randomUUID() };
  const crews = new Crews(core.store.db, new CrewSecrets(core.directory, core.vault), new Experience(core), () => [], () => MACHINE);
  return { dir, core, app, headers, crews };
}

async function linked(fx: Awaited<ReturnType<typeof open>>) {
  await fx.app.inject({ method: 'POST', url: '/v1/experience/team', headers: fx.headers, payload: { use: 'work' } });
  const crew = (await fx.app.inject({ method: 'POST', url: '/v1/crews/link', headers: { ...fx.headers, 'idempotency-key': randomUUID() } })).json();
  const coordinator = crew.members.find((member: { coordinator: boolean }) => member.coordinator);
  const colleagues = crew.members.filter((member: { coordinator: boolean }) => !member.coordinator);
  return { coordinator, colleagues };
}

async function model(fx: Awaited<ReturnType<typeof open>>, botId: string, name: string) {
  const response = await fx.app.inject({ method: 'POST', url: `/v1/crews/members/${botId}/model`, headers: { ...fx.headers, 'idempotency-key': randomUUID() }, payload: { model: name } });
  assert.equal(response.statusCode, 200);
}

test('o coordenador pede um colega por rodada e a resposta fica na conversa da equipe', async () => {
  const fx = await open();
  try {
    const { coordinator, colleagues } = await linked(fx);
    const colleague = colleagues[0];
    const other = colleagues[1];
    await model(fx, coordinator.bot_id, 'qwen35-9b');
    await model(fx, colleague.bot_id, 'qwen35-9b');
    const calls: string[] = [];
    const complete: TalkComplete = async input => {
      calls.push(input.botId);
      assert.ok(input.maxTokens <= 1024);
      if (input.botId === coordinator.bot_id && calls.filter(id => id === coordinator.bot_id).length === 1) {
        assert.match(input.messages.map(message => message.content).join('\n'), /Usuário: Prepara o resumo/);
        return { text: `PARA: ${colleague.bot_id}\nPEDIDO: resume o pedido\nPARA: ${other.bot_id}\nPEDIDO: ignora este segundo pedido` };
      }
      if (input.botId === colleague.bot_id) return { text: 'O resumo do colega.' };
      const heard = input.messages.map(message => message.content).join('\n');
      assert.match(heard, /O resumo do colega/);
      return { text: 'FIM: a equipe fechou o pedido.' };
    };
    const result = await runCrewTalk(fx.crews, complete, 'Prepara o resumo.', new AbortController().signal);
    assert.equal(result.stopped, 'done');
    assert.deepEqual(calls, [coordinator.bot_id, colleague.bot_id, coordinator.bot_id]);
    assert.equal(result.messages.filter(message => message.author === 'agent').length, 1);
    assert.match(result.messages.map(message => message.content).join('\n'), /Peço a/);
    assert.match(result.messages.at(-1)?.content ?? '', /fechou o pedido/);
    assert.ok(result.tokens <= result.max_tokens);
    const agent = await fx.crews.messages(colleague.bot_id);
    assert.equal(agent.filter(message => message.author === 'agent').length, 1);
    assert.equal(result.messages.filter(message => message.author === 'user').length, 1);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test('a conversa para no máximo de rodadas, nos tokens, no próprio coordenador e no cancelamento', async () => {
  const fx = await open();
  try {
    const { coordinator, colleagues } = await linked(fx);
    const colleague = colleagues[0];
    await model(fx, coordinator.bot_id, 'qwen35-9b');
    await model(fx, colleague.bot_id, 'qwen35-9b');
    await fx.crews.updateSettings({ max_rounds: 1, max_tokens: 4096 });
    let calls = 0;
    const rounds = await runCrewTalk(fx.crews, async input => {
      calls += 1;
      if (input.botId === coordinator.bot_id) return { text: `PARA: ${colleague.bot_id}\nPEDIDO: continua` };
      return { text: 'ainda não.' };
    }, 'Continua.', new AbortController().signal);
    assert.equal(rounds.stopped, 'rounds');
    assert.equal(rounds.rounds, 1);
    assert.equal(calls, 2);

    await fx.core.store.db.query('DELETE FROM crew_messages');
    await fx.crews.updateSettings({ max_rounds: 4, max_tokens: 256 });
    calls = 0;
    const tokens = await runCrewTalk(fx.crews, async input => {
      calls += 1;
      if (input.botId === coordinator.bot_id) return { text: `PARA: ${colleague.bot_id}\nPEDIDO: escreve` };
      return { text: 'x'.repeat(4000) };
    }, 'Gasta o limite.', new AbortController().signal);
    assert.equal(tokens.stopped, 'tokens');
    assert.equal(calls, 2);
    assert.ok(tokens.tokens > 256);

    await fx.core.store.db.query('DELETE FROM crew_messages');
    await fx.crews.updateSettings({ max_rounds: 4, max_tokens: 4096 });
    calls = 0;
    const self = await runCrewTalk(fx.crews, async () => {
      calls += 1;
      return { text: `PARA: ${coordinator.bot_id}\nPEDIDO: faz tu` };
    }, 'Não te peças.', new AbortController().signal);
    assert.equal(self.stopped, 'self');
    assert.equal(calls, 1);
    assert.match(self.messages.map(message => message.content).join('\n'), /não pede a si mesmo/);

    await fx.core.store.db.query('DELETE FROM crew_messages');
    const controller = new AbortController();
    calls = 0;
    const aborted = await runCrewTalk(fx.crews, async input => {
      calls += 1;
      assert.equal(input.botId, coordinator.bot_id);
      controller.abort();
      return { text: `PARA: ${colleague.bot_id}\nPEDIDO: não chegues a responder` };
    }, 'Para a meio.', controller.signal);
    assert.equal(aborted.stopped, 'abort');
    assert.equal(calls, 1);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test('o coordenador pode usar Anthropic e um colega não sai deste computador', async () => {
  const fx = await open();
  try {
    const missing = await fx.app.inject({ method: 'POST', url: '/v1/crews/talk', headers: fx.headers, payload: { content: 'olá' } });
    assert.equal(missing.statusCode, 400);
    const { coordinator, colleagues } = await linked(fx);
    const colleague = colleagues[0];
    const noModel = await fx.app.inject({ method: 'POST', url: '/v1/crews/talk', headers: fx.headers, payload: { content: 'olá' } });
    assert.equal(noModel.statusCode, 400);
    assert.match(noModel.json().error, /modelo/);

    await model(fx, coordinator.bot_id, 'exo:cluster');
    await assert.rejects(() => runCrewTalk(fx.crews, async () => { throw new Error('não chamar'); }, 'remoto', new AbortController().signal), /loopback/);

    await model(fx, coordinator.bot_id, 'qwen35-9b');
    await model(fx, colleague.bot_id, 'qwen35-9b');
    const cloud = await fx.crews.createProvider({ kind: 'anthropic', label: 'Claude', model: 'claude-test', acknowledged: true, confirm_remote: true, token: 'crew-test-token-aaaa' });
    await fx.crews.updateMember(coordinator.bot_id, { provider_id: cloud.id });
    const cloudTalk = await runCrewTalk(fx.crews, async input => {
      assert.equal(input.providerId, cloud.id);
      assert.equal(input.model, 'claude-test');
      return { text: 'FIM: resposta do coordenador na nuvem.' };
    }, 'nuvem', new AbortController().signal);
    assert.equal(cloudTalk.stopped, 'done');
    assert.equal(JSON.stringify(cloudTalk).includes('crew-test-token-aaaa'), false);
    await fx.crews.updateMember(coordinator.bot_id, { provider_id: 'local' });
    const loopback = await fx.crews.createProvider({ kind: 'openai', label: 'Loopback', endpoint: 'http://127.0.0.1:8080/v1' });
    await fx.crews.updateMember(colleague.bot_id, { provider_id: loopback.id });
    let calls = 0;
    const remote = await runCrewTalk(fx.crews, async () => {
      calls += 1;
      return { text: `PARA: ${colleague.bot_id}\nPEDIDO: usa outro motor` };
    }, 'Fica local.', new AbortController().signal);
    assert.equal(remote.stopped, 'local');
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(remote).includes('crew-test-token-aaaa'), false);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test('uma segunda conversa recebe 409 enquanto a primeira ainda decorre', async () => {
  const fx = await open();
  try {
    const { coordinator, colleagues } = await linked(fx);
    await model(fx, coordinator.bot_id, 'qwen35-9b');
    await model(fx, colleagues[0].bot_id, 'qwen35-9b');
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const talk = new CrewTalk(fx.crews, async () => {
      await gate;
      return { text: 'FIM: pronto.' };
    }, async operation => operation(), () => null);
    const first = talk.start('primeiro pedido', new AbortController().signal);
    assert.equal(talk.busy, true);
    await assert.rejects(() => talk.start('segundo pedido', new AbortController().signal), (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /em andamento/);
      return true;
    });
    release();
    const done = await first;
    assert.equal(done.stopped, 'done');
    assert.equal(talk.busy, false);
  } finally {
    await fx.app.close();
    await fx.core.close();
    await rm(fx.dir, { recursive: true, force: true });
  }
});
