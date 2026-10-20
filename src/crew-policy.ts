import { createRequire } from 'node:module';
import { z } from 'zod';

export const CREW_MASCOTS = ['coordenador', 'redacao', 'analise', 'codigo', 'pesquisa'] as const;
export type CrewMascot = (typeof CREW_MASCOTS)[number];

export const PROVIDER_KINDS = ['local', 'exo', 'openai', 'anthropic', 'xai'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const ADVANCED_PARAMETERS = 70;
export const LOCAL_PARAMETER_MIN = 7;
export const LOCAL_PARAMETER_MAX = 14;

const CLOUD = {
  anthropic: 'https://api.anthropic.com',
  xai: 'https://api.x.ai',
} as const;

export function mascotForTemplate(template?: string): CrewMascot {
  if (template === 'work-ceo') return 'coordenador';
  if (template === 'work-marketing' || template === 'work-sales') return 'redacao';
  if (template === 'work-legal') return 'analise';
  if (template === 'work-finance' || template === 'work-accounting') return 'pesquisa';
  return 'codigo';
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function redactSecrets(message: string, secrets: readonly string[]) {
  let text = message;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    text = text.split(secret).join('••••');
  }
  return text;
}

export function tokenHint(token: string) {
  if (token.length < 4) return '••••';
  return `••••${token.slice(-4)}`;
}

export type HostClass = 'loopback' | 'private' | 'public' | 'blocked';

const { hostClass, isConfiguredLanName } = createRequire(import.meta.url)('../../desktop/public-url.cjs') as {
  hostClass: (hostname: string) => HostClass;
  isConfiguredLanName: (hostname: string) => boolean;
};

export function classifyHost(hostname: string): HostClass {
  if (isConfiguredLanName(hostname)) return 'private';
  return hostClass(hostname);
}

export type ParsedEndpoint = {
  protocol: 'http:' | 'https:';
  hostClass: HostClass;
  origin: string;
  base: string;
};

export function parseEndpoint(value: string): ParsedEndpoint {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Endereço inválido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Use HTTP ou HTTPS.');
  if (url.username || url.password || url.search || url.hash) throw new Error('O endereço não pode ter utilizador, senha, consulta ou fragmento.');
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== '/v1') throw new Error('Use só a origem do serviço, com o caminho /v1 se for uma API compatível.');
  const hostClass = classifyHost(url.hostname);
  if (hostClass === 'blocked') throw new Error('Endereço recusado.');
  return { protocol: url.protocol, hostClass, origin: url.origin, base: path === '/v1' ? `${url.origin}/v1` : url.origin };
}

export function modelIsAdvanced(model: string, parametersB: number | null) {
  return model.startsWith('exo:') || (parametersB !== null && parametersB >= ADVANCED_PARAMETERS);
}

export function providerIsAdvanced(kind: ProviderKind, leavesComputer: boolean) {
  return kind === 'exo' || kind === 'anthropic' || kind === 'xai' || (kind === 'openai' && leavesComputer);
}

export function assertAssignable(coordinator: boolean, model: string, parametersB: number | null, kind: ProviderKind, leavesComputer: boolean) {
  if (coordinator) return;
  if (modelIsAdvanced(model, parametersB) || providerIsAdvanced(kind, leavesComputer)) {
    throw new Error('Um modelo de 70B ou mais, o EXO, outro computador ou uma nuvem só pode ficar no coordenador. Os restantes agentes usam um modelo local menor.');
  }
}

const providerInputSchema = z.strictObject({
  kind: z.enum(PROVIDER_KINDS),
  label: z.string().trim().min(1).max(80),
  endpoint: z.string().max(300).optional(),
  model: z.string().trim().max(120).optional(),
  token: z.string().max(500).optional(),
  trusted_network: z.boolean().optional(),
  acknowledged: z.boolean().optional(),
  confirm_remote: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export type ProviderPlan = {
  kind: ProviderKind;
  label: string;
  endpoint: string;
  model: string;
  leaves_computer: boolean;
  trusted_network: boolean;
  acknowledged: boolean;
  confirm_remote: boolean;
  enabled: boolean;
  /** null mantém a chave já guardada; string vazia apaga. */
  token: string | null;
};

export function planProvider(input: unknown): ProviderPlan {
  const value = providerInputSchema.parse(input);
  const model = value.model ?? '';
  const token = value.token === undefined ? null : value.token;
  const enabled = value.enabled !== false;
  if (value.kind === 'local') {
    if (value.endpoint?.trim()) {
      const parsed = parseEndpoint(value.endpoint.includes('://') ? value.endpoint : `http://${value.endpoint}`);
      if (parsed.hostClass !== 'loopback') throw new Error('O provedor local não aceita um endereço fora deste computador.');
    }
    return { kind: 'local', label: value.label, endpoint: '', model, leaves_computer: false, trusted_network: false, acknowledged: false, confirm_remote: false, enabled, token: null };
  }
  if (value.kind === 'exo') {
    const parsed = parseEndpoint((value.endpoint && value.endpoint.trim()) || 'http://127.0.0.1:52415');
    if (parsed.hostClass !== 'loopback' || parsed.protocol !== 'http:' || parsed.base !== parsed.origin) {
      throw new Error('O EXO da equipa fica só em loopback (127.0.0.1). Esta opção não abre a rede.');
    }
    return { kind: 'exo', label: value.label, endpoint: parsed.origin, model, leaves_computer: false, trusted_network: false, acknowledged: Boolean(value.acknowledged), confirm_remote: false, enabled, token: null };
  }
  if (value.kind === 'anthropic' || value.kind === 'xai') {
    const endpoint = CLOUD[value.kind];
    if (value.endpoint?.trim() && value.endpoint.replace(/\/+$/, '') !== endpoint) {
      throw new Error(value.kind === 'anthropic' ? 'A Anthropic usa apenas https://api.anthropic.com.' : 'A xAI usa apenas https://api.x.ai.');
    }
    if (!value.acknowledged || !value.confirm_remote) throw new Error('Esta ligação sai do computador. Confirme o aviso antes de a guardar.');
    return { kind: value.kind, label: value.label, endpoint, model, leaves_computer: true, trusted_network: false, acknowledged: true, confirm_remote: true, enabled, token };
  }
  const endpoint = value.endpoint?.trim();
  if (!endpoint) throw new Error('Indique o endereço do outro computador.');
  const parsed = parseEndpoint(endpoint);
  const leaves = parsed.hostClass !== 'loopback';
  if (leaves) {
    if (!value.acknowledged || !value.confirm_remote) throw new Error('Esta ligação sai do computador. Confirme o aviso antes de a guardar.');
    if (parsed.protocol !== 'https:' && !(parsed.hostClass === 'private' && value.trusted_network)) {
      throw new Error('Num outro computador, use HTTPS ou uma rede privada marcada como confiável.');
    }
  }
  return {
    kind: 'openai',
    label: value.label,
    endpoint: parsed.base,
    model,
    leaves_computer: leaves,
    trusted_network: Boolean(leaves && value.trusted_network),
    acknowledged: Boolean(value.acknowledged),
    confirm_remote: Boolean(value.confirm_remote),
    enabled,
    token,
  };
}

export function needsStoredToken(plan: ProviderPlan) {
  return plan.enabled && (plan.kind === 'anthropic' || plan.kind === 'xai' || (plan.kind === 'openai' && plan.leaves_computer));
}

export function assertToken(plan: ProviderPlan, hasStored: boolean) {
  if (!needsStoredToken(plan)) return;
  if (!plan.token && !hasStored) throw new Error('Indique o token. Ele fica só no cofre cifrado.');
}
