import { createRequire } from 'node:module';

const { hostClass, isConfiguredLanName } = createRequire(import.meta.url)('../../desktop/public-url.cjs') as {
  hostClass: (hostname: string) => 'loopback' | 'private' | 'public' | 'blocked';
  isConfiguredLanName: (hostname: string) => boolean;
};

export type FetchPolicy = { allowLoopback?: boolean; allowPrivate?: boolean };
type Resolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<readonly { address: string }[]>;

export function assertHostAllowed(hostname: string, policy: FetchPolicy = {}) {
  const kind = hostClass(hostname);
  if (kind === 'blocked') throw new Error('Endereço recusado.');
  if (kind === 'loopback' && !policy.allowLoopback) throw new Error('Endereço recusado.');
  if (kind === 'private' && !policy.allowPrivate) throw new Error('Endereço recusado.');
  return kind;
}

function isIpLiteral(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '');
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':');
}

function dnsFailureIsMdns(hostname: string) {
  return isConfiguredLanName(hostname) && hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase().endsWith('.local');
}

async function answersStayOffLinkLocal(hostname: string, resolver: Resolver, allowPrivate: boolean) {
  if (isIpLiteral(hostname)) return;
  let answers: readonly { address: string }[];
  try {
    answers = await resolver(hostname, { all: true, verbatim: true });
  } catch {
    if (dnsFailureIsMdns(hostname)) return;
    throw new Error('Endereço recusado.');
  }
  const refused = answers.length === 0 || answers.some(answer => {
    const kind = hostClass(answer.address);
    if (kind === 'blocked' || kind === 'loopback') return true;
    return kind === 'private' && !allowPrivate;
  });
  if (refused) throw new Error('Endereço recusado.');
}

/**
 * HTTPS MCP. Sem rede confiável, só nome público que resolve para endereço público.
 * Com a opção, IP privado ou nome de LAN/VPN pode resolver para rede privada.
 * Loopback em HTTPS continua recusado, para não alcançar o painel local.
 */
export async function assertMcpResolved(url: URL, trustedNetwork: boolean, resolver?: Resolver) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Endereço recusado.');
  const kind = hostClass(url.hostname);
  const lan = isConfiguredLanName(url.hostname);
  if (url.protocol === 'http:') {
    if (kind !== 'loopback') throw new Error('Endereço recusado.');
    return;
  }
  if (kind === 'loopback' || (kind === 'blocked' && !(trustedNetwork && lan))) throw new Error('Endereço recusado.');
  if (kind === 'private' && !trustedNetwork) throw new Error('Endereço recusado.');
  if (!trustedNetwork) {
    await assertResolvedFetch(url, {}, resolver);
    return;
  }
  if (!resolver) return;
  await answersStayOffLinkLocal(url.hostname, resolver, true);
}

/** Public names must resolve only to public addresses. Literal loopback and private hosts skip DNS. */
export async function assertResolvedFetch(url: URL, policy: FetchPolicy = {}, resolver?: Resolver) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Endereço recusado.');
  const kind = assertHostAllowed(url.hostname, policy);
  if (!resolver || kind !== 'public' || isIpLiteral(url.hostname)) return;
  let answers: readonly { address: string }[];
  try {
    answers = await resolver(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Endereço recusado.');
  }
  if (!answers.length || answers.some(answer => hostClass(answer.address) !== 'public')) throw new Error('Endereço recusado.');
}

export function policyForHost(hostname: string): FetchPolicy {
  const kind = hostClass(hostname);
  return { allowLoopback: kind === 'loopback', allowPrivate: kind === 'private' };
}
