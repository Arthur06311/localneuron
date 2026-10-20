import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CrewTalk } from './crew-talk.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Sql } from './migrations.js';
import type { Experience, Bot } from './experience.js';
import type { CrewSecrets } from './crew-secrets.js';
import {
  CREW_MASCOTS,
  type CrewMascot,
  type ProviderKind,
  type ProviderPlan,
  assertAssignable,
  assertToken,
  estimateTokens,
  mascotForTemplate,
  planProvider,
  tokenHint,
} from './crew-policy.js';
import { suggestCrewModels, type CrewCandidate, type CrewMachine } from './crew-models.js';

type MemberRow = { bot_id: string; mascot: string; coordinator: boolean; unread: number; provider_id: string };
type ProviderRow = {
  id: string;
  kind: ProviderKind;
  label: string;
  endpoint: string;
  model: string;
  leaves_computer: boolean;
  trusted_network: boolean;
  acknowledged: boolean;
  confirm_remote: boolean;
  token_hint: string;
  enabled: boolean;
};
type MessageRow = { id: string; scope: string; bot_id: string | null; author: string; author_bot_id: string | null; content: string; tokens: number; round: number; created_at: unknown };

const readLimit = { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };
const writeLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

function flag(value: unknown) {
  return value === true || value === 't' || value === 'true';
}
function num(value: unknown) {
  return Number(value);
}
function iso(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

/**
 * A ilha Equipas não cria outra lista de especialistas.
 * Nome, papel, instruções, memória e modelo continuam no bot de Minha equipe.
 * Aqui ficam só o vínculo, o mascote, as não lidas, o provedor e a conversa.
 */
export class Crews {
  constructor(
    private db: Sql,
    private secrets: CrewSecrets,
    private experience: Experience,
    private candidates: () => CrewCandidate[],
    private machine: () => CrewMachine,
  ) {}

  private async settings() {
    const result = await this.db.query<{ max_rounds: number; max_tokens: number }>('SELECT max_rounds, max_tokens FROM crew_settings WHERE id = 1');
    const row = result.rows[0];
    return { max_rounds: num(row?.max_rounds ?? 4), max_tokens: num(row?.max_tokens ?? 4096) };
  }

  private async memberRows() {
    const result = await this.db.query<MemberRow>('SELECT bot_id, mascot, coordinator, unread, provider_id FROM crew_members ORDER BY created_at, bot_id');
    return result.rows.map(row => ({ ...row, coordinator: flag(row.coordinator), unread: num(row.unread) }));
  }

  private async providerRows() {
    const result = await this.db.query<ProviderRow>('SELECT id, kind, label, endpoint, model, leaves_computer, trusted_network, acknowledged, confirm_remote, token_hint, enabled FROM crew_providers ORDER BY created_at, id');
    return result.rows.map(row => ({
      ...row,
      leaves_computer: flag(row.leaves_computer),
      trusted_network: flag(row.trusted_network),
      acknowledged: flag(row.acknowledged),
      confirm_remote: flag(row.confirm_remote),
      enabled: flag(row.enabled),
    }));
  }

  private async requireMember(botId: string) {
    const member = (await this.memberRows()).find(row => row.bot_id === botId);
    if (!member) throw new Error('Este bot ainda não está na equipa.');
    return member;
  }

  private async requireBot(botId: string) {
    const bot = (await this.experience.snapshot()).bots.find(item => item.id === botId);
    if (!bot) throw new Error('Bot não encontrado. A equipa usa os bots de Minha equipe.');
    return bot;
  }

  private async requireProvider(id: string) {
    const provider = (await this.providerRows()).find(row => row.id === id);
    if (!provider) throw new Error('Provedor não encontrado.');
    return provider;
  }

  private parametersOf(model: string) {
    if (!model) return null;
    return this.candidates().find(item => item.id === model || item.local_key === model)?.parameters_b ?? null;
  }

  private toPublic(row: ProviderRow) {
    const hasToken = row.id !== 'local' && this.secrets.has(row.id);
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      endpoint: row.endpoint,
      model: row.model,
      leaves_computer: row.leaves_computer,
      trusted_network: row.trusted_network,
      acknowledged: row.acknowledged,
      confirm_remote: row.confirm_remote,
      enabled: row.enabled,
      has_token: hasToken,
      token_hint: hasToken ? row.token_hint : '',
    };
  }

  async snapshot() {
    const settings = await this.settings();
    const members = await this.memberRows();
    const providers = await this.providerRows();
    const bots = (await this.experience.snapshot()).bots;
    return {
      source: 'experience' as const,
      relation: 'A ilha Equipas usa os bots de Minha equipe. Não cria uma segunda lista de especialistas.',
      settings,
      members: members.map(member => {
        const bot = bots.find(item => item.id === member.bot_id);
        return {
          bot_id: member.bot_id,
          missing: !bot,
          name: bot?.name ?? '',
          role: bot?.role ?? '',
          instructions: bot?.instructions ?? '',
          memory: bot?.memory ?? '',
          model: bot?.model ?? '',
          area: bot?.area ?? null,
          template: bot?.template ?? null,
          mascot: member.mascot,
          coordinator: member.coordinator,
          unread: member.unread,
          provider_id: member.provider_id,
        };
      }),
      available_bots: bots.map(bot => ({
        id: bot.id,
        name: bot.name,
        role: bot.role,
        area: bot.area,
        template: bot.template ?? null,
        model: bot.model,
        linked: members.some(member => member.bot_id === bot.id),
      })),
      providers: providers.map(row => this.toPublic(row)),
      recommendation: suggestCrewModels(this.candidates(), this.machine()),
    };
  }

  async linkTeam() {
    const work = (await this.experience.snapshot()).bots.filter(bot => bot.area === 'work');
    if (!work.length) throw new Error('Ative a equipa de trabalho em Minha equipe. A ilha Equipas usa esses bots e não cria outra lista.');
    const existing = await this.memberRows();
    const have = new Set(existing.map(row => row.bot_id));
    const already = existing.some(row => row.coordinator);
    const coordinatorId = existing.find(row => row.coordinator)?.bot_id ?? work.find(bot => bot.template === 'work-ceo')?.id ?? work[0].id;
    await this.db.transaction(async tx => {
      for (const bot of work) {
        if (have.has(bot.id)) continue;
        await tx.query('INSERT INTO crew_members (bot_id, mascot, coordinator, provider_id) VALUES ($1, $2, $3, \'local\')', [bot.id, mascotForTemplate(bot.template), !already && bot.id === coordinatorId]);
      }
    });
    return this.snapshot();
  }

  async addMember(input: { bot_id: string; mascot?: CrewMascot; coordinator?: boolean }) {
    const bot = await this.requireBot(input.bot_id);
    const rows = await this.memberRows();
    if (rows.some(row => row.bot_id === bot.id)) throw new Error('Este bot já está na equipa.');
    const coordinator = input.coordinator === true || rows.length === 0;
    await this.db.transaction(async tx => {
      if (coordinator) await tx.query('UPDATE crew_members SET coordinator = false WHERE coordinator');
      await tx.query('INSERT INTO crew_members (bot_id, mascot, coordinator, provider_id) VALUES ($1, $2, $3, \'local\')', [bot.id, input.mascot ?? mascotForTemplate(bot.template), coordinator]);
    });
    return this.snapshot();
  }

  async updateMember(botId: string, patch: { mascot?: CrewMascot; coordinator?: boolean; provider_id?: string }) {
    const member = await this.requireMember(botId);
    if (patch.coordinator === false) throw new Error('Escolha outro coordenador. A equipa mantém sempre um.');
    const coordinator = patch.coordinator ?? member.coordinator;
    const provider = await this.requireProvider(patch.provider_id ?? member.provider_id);
    const bot = await this.requireBot(botId);
    assertAssignable(coordinator, bot.model, this.parametersOf(bot.model), provider.kind, provider.leaves_computer);
    await this.db.transaction(async tx => {
      if (patch.coordinator === true) await tx.query('UPDATE crew_members SET coordinator = false WHERE coordinator');
      await tx.query('UPDATE crew_members SET mascot = $2, coordinator = $3, provider_id = $4, updated_at = now() WHERE bot_id = $1', [botId, patch.mascot ?? member.mascot, coordinator, provider.id]);
    });
    return this.snapshot();
  }

  async removeMember(botId: string) {
    const rows = await this.memberRows();
    const member = rows.find(row => row.bot_id === botId);
    if (!member) throw new Error('Este bot ainda não está na equipa.');
    if (member.coordinator && rows.length > 1) throw new Error('Escolha outro coordenador antes de retirar este.');
    await this.db.query('DELETE FROM crew_members WHERE bot_id = $1', [botId]);
    return { ok: true as const };
  }

  async setModel(botId: string, model: string, key: string) {
    const member = await this.requireMember(botId);
    const bot = await this.requireBot(botId);
    const provider = await this.requireProvider(member.provider_id);
    assertAssignable(member.coordinator, model, this.parametersOf(model), provider.kind, provider.leaves_computer);
    await this.experience.bot({ ...bot, model }, key);
    return this.snapshot();
  }

  async markRead(botId: string) {
    await this.requireMember(botId);
    await this.db.query('UPDATE crew_members SET unread = 0, updated_at = now() WHERE bot_id = $1', [botId]);
    return this.snapshot();
  }

  private mapMessage(row: MessageRow) {
    return { id: row.id, scope: row.scope, bot_id: row.bot_id, author: row.author, author_bot_id: row.author_bot_id, content: row.content, tokens: num(row.tokens), round: num(row.round), created_at: iso(row.created_at) };
  }

  async messages(botId: string) {
    await this.requireMember(botId);
    const result = await this.db.query<MessageRow>('SELECT id, scope, bot_id, author, author_bot_id, content, tokens, round, created_at FROM crew_messages WHERE scope = \'agent\' AND bot_id = $1 ORDER BY created_at, id', [botId]);
    return result.rows.map(row => this.mapMessage(row));
  }

  async teamMessages() {
    const result = await this.db.query<MessageRow>('SELECT id, scope, bot_id, author, author_bot_id, content, tokens, round, created_at FROM crew_messages WHERE scope = \'team\' ORDER BY created_at, id');
    return result.rows.map(row => this.mapMessage(row));
  }

  async addUserMessage(botId: string, content: string) {
    await this.requireMember(botId);
    await this.db.query('INSERT INTO crew_messages (id, scope, bot_id, author, content, tokens, round) VALUES ($1, \'agent\', $2, \'user\', $3, $4, 0)', [randomUUID(), botId, content, estimateTokens(content)]);
    return this.messages(botId);
  }

  tokenFor(providerId: string) {
    if (providerId === 'local') return null;
    return this.secrets.get(providerId);
  }

  async addTeamUserMessage(content: string, round: number) {
    const tokens = estimateTokens(content);
    await this.db.query('INSERT INTO crew_messages (id, scope, bot_id, author, content, tokens, round) VALUES ($1, \'team\', NULL, \'user\', $2, $3, $4)', [randomUUID(), content, tokens, round]);
    return tokens;
  }

  async recordNotice(content: string, round: number) {
    const tokens = estimateTokens(content);
    await this.db.query('INSERT INTO crew_messages (id, scope, bot_id, author, content, tokens, round) VALUES ($1, \'team\', NULL, \'system\', $2, $3, $4)', [randomUUID(), content, tokens, round]);
    return tokens;
  }

  async recordIncoming(botId: string, author: 'agent' | 'coordinator', content: string, round: number) {
    await this.requireMember(botId);
    const tokens = estimateTokens(content);
    await this.db.transaction(async tx => {
      await tx.query('INSERT INTO crew_messages (id, scope, bot_id, author, author_bot_id, content, tokens, round) VALUES ($1, \'agent\', $2, $3, $2, $4, $5, $6)', [randomUUID(), botId, author, content, tokens, round]);
      await tx.query('INSERT INTO crew_messages (id, scope, bot_id, author, author_bot_id, content, tokens, round) VALUES ($1, \'team\', NULL, $2, $3, $4, $5, $6)', [randomUUID(), author, botId, content, tokens, round]);
      await tx.query('UPDATE crew_members SET unread = unread + 1, updated_at = now() WHERE bot_id = $1', [botId]);
    });
    return tokens;
  }

  async updateSettings(input: unknown) {
    const value = z.strictObject({
      max_rounds: z.number().int().min(1).max(8),
      max_tokens: z.number().int().min(256).max(32768),
    }).parse(input);
    await this.db.query('UPDATE crew_settings SET max_rounds = $1, max_tokens = $2 WHERE id = 1', [value.max_rounds, value.max_tokens]);
    return this.snapshot();
  }

  private async insertProvider(id: string, plan: ProviderPlan, hint: string) {
    await this.db.query(
      `INSERT INTO crew_providers (id, kind, label, endpoint, model, leaves_computer, trusted_network, acknowledged, confirm_remote, token_hint, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, plan.kind, plan.label, plan.endpoint, plan.model, plan.leaves_computer, plan.trusted_network, plan.acknowledged, plan.confirm_remote, hint, plan.enabled],
    );
  }

  async createProvider(input: unknown) {
    const plan = planProvider(input);
    if (plan.kind === 'local') throw new Error('O provedor deste computador já existe.');
    assertToken(plan, false);
    const id = randomUUID();
    const hint = plan.token ? tokenHint(plan.token) : '';
    await this.insertProvider(id, plan, hint);
    try {
      if (plan.token) this.secrets.put(id, plan.token);
    } catch (error) {
      await this.db.query('DELETE FROM crew_providers WHERE id = $1', [id]);
      throw error;
    }
    return this.toPublic(await this.requireProvider(id));
  }

  async updateProvider(id: string, input: unknown) {
    const current = await this.requireProvider(id);
    if (id === 'local') throw new Error('O provedor deste computador não muda de tipo.');
    const patch = z.strictObject({
      label: z.string().trim().min(1).max(80).optional(),
      endpoint: z.string().max(300).optional(),
      model: z.string().trim().max(120).optional(),
      token: z.string().max(500).optional(),
      trusted_network: z.boolean().optional(),
      acknowledged: z.boolean().optional(),
      confirm_remote: z.boolean().optional(),
      enabled: z.boolean().optional(),
    }).parse(input);
    const plan = planProvider({
      kind: current.kind,
      label: patch.label ?? current.label,
      endpoint: patch.endpoint ?? current.endpoint,
      model: patch.model ?? current.model,
      token: Object.hasOwn(patch, 'token') ? patch.token : undefined,
      trusted_network: patch.trusted_network ?? current.trusted_network,
      acknowledged: patch.acknowledged ?? current.acknowledged,
      confirm_remote: patch.confirm_remote ?? current.confirm_remote,
      enabled: patch.enabled ?? current.enabled,
    });
    assertToken(plan, plan.token === null && this.secrets.has(id));
    const hint = plan.token ? tokenHint(plan.token) : plan.token === '' ? '' : current.token_hint;
    await this.db.query(
      `UPDATE crew_providers SET label = $2, endpoint = $3, model = $4, leaves_computer = $5, trusted_network = $6, acknowledged = $7, confirm_remote = $8, token_hint = $9, enabled = $10 WHERE id = $1`,
      [id, plan.label, plan.endpoint, plan.model, plan.leaves_computer, plan.trusted_network, plan.acknowledged, plan.confirm_remote, hint, plan.enabled],
    );
    if (plan.token !== null) this.secrets.put(id, plan.token);
    return this.toPublic(await this.requireProvider(id));
  }

  async removeProvider(id: string) {
    if (id === 'local') throw new Error('O provedor deste computador permanece.');
    await this.requireProvider(id);
    const used = await this.db.query('SELECT bot_id FROM crew_members WHERE provider_id = $1', [id]);
    if (used.rows.length) throw new Error('Este provedor ainda está associado a um agente.');
    this.secrets.remove(id);
    await this.db.query('DELETE FROM crew_providers WHERE id = $1', [id]);
    return { ok: true as const };
  }
}

export function registerCrewRoutes(app: FastifyInstance, crews: Crews, talk?: CrewTalk) {
  const body = (request: { body: unknown }) => request.body;
  const idOf = (request: { params: unknown }) => z.object({ id: z.string().min(1).max(80) }).parse(request.params).id;
  app.get('/v1/crews', readLimit, async () => crews.snapshot());
  app.post('/v1/crews/link', writeLimit, async () => crews.linkTeam());
  app.post('/v1/crews/settings', writeLimit, async request => crews.updateSettings(body(request)));
  app.post('/v1/crews/members', writeLimit, async request => crews.addMember(z.strictObject({
    bot_id: z.string().uuid(),
    mascot: z.enum(CREW_MASCOTS).optional(),
    coordinator: z.boolean().optional(),
  }).parse(body(request))));
  app.patch('/v1/crews/members/:id', writeLimit, async request => crews.updateMember(idOf(request), z.strictObject({
    mascot: z.enum(CREW_MASCOTS).optional(),
    coordinator: z.boolean().optional(),
    provider_id: z.string().min(1).max(80).optional(),
  }).refine(value => Object.keys(value).length > 0).parse(body(request))));
  app.delete('/v1/crews/members/:id', writeLimit, async request => crews.removeMember(idOf(request)));
  app.post('/v1/crews/members/:id/read', writeLimit, async request => crews.markRead(idOf(request)));
  app.post('/v1/crews/members/:id/model', writeLimit, async request => crews.setModel(idOf(request), z.strictObject({ model: z.string().max(512) }).parse(body(request)).model, String(request.headers['idempotency-key'] ?? '')));
  app.get('/v1/crews/members/:id/messages', readLimit, async request => crews.messages(idOf(request)));
  app.post('/v1/crews/members/:id/messages', writeLimit, async request => crews.addUserMessage(idOf(request), z.strictObject({ content: z.string().trim().min(1).max(16000) }).parse(body(request)).content));
  app.get('/v1/crews/team/messages', readLimit, async () => crews.teamMessages());
  if (talk) {
    app.post('/v1/crews/talk', writeLimit, async (request, reply) => {
      const content = z.strictObject({ content: z.string().trim().min(1).max(16000) }).parse(body(request)).content;
      const controller = new AbortController();
      const socket = (request as FastifyRequest).raw.socket;
      const stop = () => { if (!reply.sent) controller.abort(); };
      socket.on('close', stop);
      try {
        return await talk.start(content, controller.signal);
      } finally {
        socket.off('close', stop);
      }
    });
  }
  app.post('/v1/crews/providers', writeLimit, async request => crews.createProvider(body(request)));
  app.patch('/v1/crews/providers/:id', writeLimit, async request => crews.updateProvider(idOf(request), body(request)));
  app.delete('/v1/crews/providers/:id', writeLimit, async request => crews.removeProvider(idOf(request)));
}

export type { Bot };
