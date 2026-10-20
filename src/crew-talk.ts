import type { Crews } from './crews.js';
import { estimateTokens } from './crew-policy.js';

export type TalkRole = 'system' | 'user' | 'assistant';
export type TalkMessage = { role: TalkRole; content: string };
export type TalkStop = 'done' | 'rounds' | 'tokens' | 'abort' | 'self' | 'local' | 'model';

export type TalkComplete = (input: {
  botId: string;
  model: string;
  providerId: string;
  messages: TalkMessage[];
  maxTokens: number;
  signal: AbortSignal;
}) => Promise<{ text: string }>;

type Seat = {
  botId: string;
  name: string;
  role: string;
  instructions: string;
  model: string;
  providerId: string;
  coordinator: boolean;
  channel: 'local' | 'remote' | 'closed';
};

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function aborted(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

/** Lê o primeiro pedido. Um segundo PARA na mesma resposta é ignorado. */
export function parseCoordinator(text: string): { kind: 'ask'; id: string; task: string } | { kind: 'finish'; text: string } {
  const ask = text.match(/PARA:\s*(\S+)\s*[\r\n]+PEDIDO:\s*([\s\S]+)/);
  if (ask) return { kind: 'ask', id: ask[1], task: ask[2].split(/\n\s*PARA:/)[0].trim().slice(0, 2000) };
  const done = text.match(/FIM:\s*([\s\S]+)/);
  if (done && done[1].trim()) return { kind: 'finish', text: done[1].trim().slice(0, 8000) };
  const plain = text.trim();
  return { kind: 'finish', text: (plain || 'Sem resposta.').slice(0, 8000) };
}

function seatFor(token: string, seats: Seat[]): Seat | 'self' | null {
  const key = token.trim().toLowerCase();
  const byId = seats.find(seat => seat.botId.toLowerCase() === key);
  if (byId) return byId.coordinator ? 'self' : byId;
  const named = seats.filter(seat => seat.name.trim().toLowerCase() === key);
  if (named.length === 1) return named[0].coordinator ? 'self' : named[0];
  return null;
}

function channelFor(member: { coordinator: boolean; model: string }, provider: { kind: string; enabled: boolean; model: string } | undefined) {
  if (!provider?.enabled) return 'closed' as const;
  if (!member.coordinator && provider.kind !== 'local') return 'closed' as const;
  if (provider.kind === 'local') return member.model && !member.model.startsWith('exo:') ? 'local' as const : 'closed' as const;
  return provider.model ? 'remote' as const : 'closed' as const;
}

/**
 * Uma ronda pede no máximo um colega, nunca o próprio coordenador.
 * Para quando acaba as rondas, os tokens, o pedido, ou a ligação é cancelada.
 * Só o coordenador pode usar um provedor que sai deste computador.
 */
export async function runCrewTalk(crews: Crews, complete: TalkComplete, content: string, signal: AbortSignal) {
  if (signal.aborted) return finish(crews, 'abort', 0, 0, 0, 0);
  const snap = await crews.snapshot();
  const settings = snap.settings;
  const prior = await crews.teamMessages();
  const usedBefore = prior.reduce((sum, message) => sum + message.tokens, 0);
  if (usedBefore >= settings.max_tokens) throw new Error('Esta conversa já passou o limite de tokens.');
  const incoming = estimateTokens(content);
  if (usedBefore + incoming > settings.max_tokens) throw new Error('Esta mensagem passa o limite de tokens da conversa.');

  const providers = new Map(snap.providers.map(provider => [provider.id, provider]));
  const seats: Seat[] = snap.members.filter(member => !member.missing).map(member => {
    const provider = providers.get(member.provider_id);
    const channel = channelFor(member, provider);
    const model = provider && provider.kind !== 'local' ? provider.model : member.model;
    return { botId: member.bot_id, name: member.name || 'Agente', role: member.role, instructions: member.instructions, model, providerId: member.provider_id, coordinator: member.coordinator, channel };
  });
  const coordinator = seats.find(seat => seat.coordinator);
  if (!coordinator) throw new Error('A equipa precisa de um coordenador.');
  const coordinatorProvider = providers.get(coordinator.providerId);
  if (coordinator.channel === 'closed' && coordinator.model.startsWith('exo:')) throw new Error('O EXO da equipa fica só em loopback (127.0.0.1). Esta opção não abre a rede.');
  if (coordinator.channel === 'closed' && coordinatorProvider && coordinatorProvider.kind !== 'local' && !coordinatorProvider.model) throw new Error('Indique o modelo deste provedor.');
  if (coordinator.channel === 'closed' && !coordinator.model) throw new Error('Escolha um modelo para o coordenador antes de começar a conversa.');
  if (coordinator.channel === 'closed') throw new Error('O coordenador precisa de um modelo neste computador ou de um provedor confirmado.');
  const colleagues = seats.filter(seat => !seat.coordinator);

  await crews.addTeamUserMessage(content, 1);
  let used = usedBefore + incoming;
  const heard: string[] = [`Utilizador: ${clip(content, 400)}`];

  for (let round = 1; round <= settings.max_rounds; round += 1) {
    if (signal.aborted) return finish(crews, 'abort', round, used, settings.max_rounds, settings.max_tokens);
    if (used >= settings.max_tokens) return finish(crews, 'tokens', round, used, settings.max_rounds, settings.max_tokens);
    const decision = await ask(complete, coordinator, coordinatorPrompt(coordinator, colleagues, heard), settings.max_tokens - used, signal);
    if (decision === abortedTalk) return finish(crews, 'abort', round, used, settings.max_rounds, settings.max_tokens);
    const parsed = parseCoordinator(decision);
    if (parsed.kind === 'finish') {
      used += await crews.recordIncoming(coordinator.botId, 'coordinator', parsed.text, round);
      return finish(crews, used > settings.max_tokens ? 'tokens' : 'done', round, used, settings.max_rounds, settings.max_tokens);
    }
    const target = seatFor(parsed.id, seats);
    if (target === 'self') {
      await crews.recordNotice('O coordenador não se pede a si próprio. A ronda para aqui.', round);
      return finish(crews, 'self', round, used, settings.max_rounds, settings.max_tokens);
    }
    if (!target) {
      await crews.recordNotice('O coordenador pediu alguém que não está na equipa. A ronda para aqui.', round);
      return finish(crews, 'done', round, used, settings.max_rounds, settings.max_tokens);
    }
    if (target.channel !== 'local') {
      await crews.recordNotice(`${target.name} fica no modelo deste computador. Só o coordenador pode usar outro provedor.`, round);
      return finish(crews, 'local', round, used, settings.max_rounds, settings.max_tokens);
    }
    if (!target.model) {
      await crews.recordNotice(`${target.name} ainda não tem um modelo local.`, round);
      return finish(crews, 'model', round, used, settings.max_rounds, settings.max_tokens);
    }
    const delegation = `Peço a ${target.name}: ${parsed.task}`;
    used += await crews.recordIncoming(coordinator.botId, 'coordinator', delegation, round);
    heard.push(`Coordenador: ${clip(delegation, 400)}`);
    if (used >= settings.max_tokens) return finish(crews, 'tokens', round, used, settings.max_rounds, settings.max_tokens);
    if (signal.aborted) return finish(crews, 'abort', round, used, settings.max_rounds, settings.max_tokens);
    const reply = await ask(complete, target, colleaguePrompt(target, parsed.task), settings.max_tokens - used, signal);
    if (reply === abortedTalk) return finish(crews, 'abort', round, used, settings.max_rounds, settings.max_tokens);
    used += await crews.recordIncoming(target.botId, 'agent', reply, round);
    heard.push(`${target.name}: ${clip(reply, 400)}`);
    if (used >= settings.max_tokens) return finish(crews, 'tokens', round, used, settings.max_rounds, settings.max_tokens);
  }
  return finish(crews, 'rounds', settings.max_rounds, used, settings.max_rounds, settings.max_tokens);
}

const abortedTalk = Symbol('abort');

async function ask(complete: TalkComplete, seat: Seat, messages: TalkMessage[], remaining: number, signal: AbortSignal) {
  try {
    const result = await complete({ botId: seat.botId, model: seat.model, providerId: seat.providerId, messages, maxTokens: Math.max(1, Math.min(1024, remaining)), signal });
    const text = result.text.trim();
    return text || 'Sem resposta.';
  } catch (error) {
    if (signal.aborted || aborted(error)) return abortedTalk;
    throw error;
  }
}

function coordinatorPrompt(coordinator: Seat, colleagues: Seat[], heard: string[]): TalkMessage[] {
  const roster = colleagues.length
    ? colleagues.map(seat => `- ${seat.botId} ${seat.name} — ${seat.role || 'colega'}`).join('\n')
    : '- Nenhum colega conectado.';
  return [
    {
      role: 'system',
      content: `Você é ${coordinator.name}, coordenador da equipe. Responda só com um bloco.\nPARA: <id de um colega>\nPEDIDO: <uma tarefa>\nou\nFIM: <resposta final>\nPeça um colega por resposta. Não peça a si mesmo. Não invente ids.\nColegas:\n${roster}`,
    },
    { role: 'user', content: heard.join('\n').slice(0, 6000) },
  ];
}

function colleaguePrompt(seat: Seat, task: string): TalkMessage[] {
  return [
    { role: 'system', content: `És ${seat.name}. O teu papel é ${seat.role || 'colega'}. ${clip(seat.instructions, 1200)} Responde só ao pedido, em português. Não delegues.` },
    { role: 'user', content: task },
  ];
}

async function finish(crews: Crews, stopped: TalkStop, rounds: number, tokens: number, maxRounds: number, maxTokens: number) {
  const messages = await crews.teamMessages();
  const spent = messages.reduce((sum, message) => sum + message.tokens, 0);
  return { stopped, rounds, tokens: spent || tokens, max_rounds: maxRounds, max_tokens: maxTokens, messages };
}

export class CrewTalk {
  busy = false;

  constructor(
    private crews: Crews,
    private complete: TalkComplete,
    private exclusive: <T>(operation: () => Promise<T>) => Promise<T>,
    private blocked: () => string | null,
  ) {}

  start(content: string, signal: AbortSignal) {
    if (this.busy) return Promise.reject(busyError());
    return this.exclusive(async () => {
      if (this.busy) throw busyError();
      const block = this.blocked();
      if (block) throw new Error(block);
      this.busy = true;
      try {
        return await runCrewTalk(this.crews, this.complete, content, signal);
      } finally {
        this.busy = false;
      }
    });
  }
}

function busyError() {
  const error = new Error('A conversa da equipa já está a decorrer.') as Error & { statusCode: number };
  error.statusCode = 409;
  return error;
}
