import { parseEndpoint, planProvider, redactSecrets, type ProviderKind } from './crew-policy.js';

export type RemoteMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type RemoteProvider = {
  kind: ProviderKind;
  endpoint: string;
  model: string;
  leaves_computer: boolean;
  trusted_network: boolean;
  acknowledged: boolean;
  confirm_remote: boolean;
  enabled: boolean;
  token: string | null;
};

type RemoteFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; redirect: 'error'; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/**
 * Volta a validar o endereço no momento da chamada.
 * Não segue redirecionamentos e não envia telemetria.
 */
export function remoteDestination(provider: RemoteProvider) {
  if (provider.kind === 'local') throw new Error('O modelo deste computador não sai pela rede.');
  const plan = planProvider({
    kind: provider.kind,
    label: 'chamada',
    endpoint: provider.endpoint,
    model: provider.model,
    token: provider.token ?? '',
    trusted_network: provider.trusted_network,
    acknowledged: provider.acknowledged,
    confirm_remote: provider.confirm_remote,
    enabled: provider.enabled,
  });
  if (!plan.enabled) throw new Error('Este provedor está desligado.');
  if (!plan.model) throw new Error('Indique o modelo deste provedor.');
  if (plan.kind === 'exo') {
    const parsed = parseEndpoint(plan.endpoint);
    if (parsed.hostClass !== 'loopback' || parsed.protocol !== 'http:') throw new Error('O EXO da equipa fica só em loopback (127.0.0.1). Esta opção não abre a rede.');
    return { url: `${parsed.origin}/v1/chat/completions`, kind: plan.kind, model: plan.model, token: null as string | null };
  }
  if ((plan.kind === 'anthropic' || plan.kind === 'xai' || (plan.kind === 'openai' && plan.leaves_computer)) && !provider.token) {
    throw new Error('Indique o token. Ele fica só no cofre cifrado.');
  }
  if (plan.kind === 'anthropic') return { url: 'https://api.anthropic.com/v1/messages', kind: plan.kind, model: plan.model, token: provider.token };
  if (plan.kind === 'xai') return { url: 'https://api.x.ai/v1/chat/completions', kind: plan.kind, model: plan.model, token: provider.token };
  const base = plan.endpoint.replace(/\/+$/, '');
  const root = base.endsWith('/v1') ? base : `${base}/v1`;
  return { url: `${root}/chat/completions`, kind: plan.kind, model: plan.model, token: provider.token };
}

export async function crewRemoteComplete(provider: RemoteProvider, messages: RemoteMessage[], maxTokens: number, signal: AbortSignal, fetchImpl: RemoteFetch = fetch) {
  const target = remoteDestination(provider);
  const limited = Math.max(1, Math.min(1024, maxTokens));
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  let body: string;
  if (target.kind === 'anthropic') {
    headers['x-api-key'] = target.token || '';
    headers['anthropic-version'] = '2023-06-01';
    const system = messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
    const dialogue = messages.filter(message => message.role !== 'system').map(message => ({ role: message.role, content: message.content }));
    body = JSON.stringify({ model: target.model, max_tokens: limited, ...(system ? { system } : {}), messages: dialogue.length ? dialogue : [{ role: 'user', content: 'Olá' }] });
  } else {
    if (target.token) headers.authorization = `Bearer ${target.token}`;
    body = JSON.stringify({ model: target.model, max_tokens: limited, messages });
  }
  const call = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  let response: { ok: boolean; status: number; text: () => Promise<string> };
  try {
    response = await fetchImpl(target.url, { method: 'POST', headers, body, redirect: 'error', signal: call });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new Error('Não foi possível contactar o provedor.');
  }
  const raw = await response.text().catch(() => '');
  const secret = target.token ? [target.token] : [];
  if (!response.ok) throw new Error(redactSecrets(`O provedor recusou o pedido (${response.status}). ${raw.slice(0, 180)}`, secret));
  return { text: readReply(raw, target.kind) };
}

function readReply(raw: string, kind: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('O provedor não devolveu uma resposta legível.');
  }
  if (kind === 'anthropic') {
    const content = (parsed as { content?: { type?: string; text?: string }[] }).content;
    const text = (content || []).map(part => part.text || '').join('').trim();
    if (text) return text.slice(0, 8000);
  }
  const choice = (parsed as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  const text = typeof choice === 'string' ? choice : '';
  if (text.trim()) return text.trim().slice(0, 8000);
  throw new Error('O provedor devolveu uma resposta vazia.');
}
