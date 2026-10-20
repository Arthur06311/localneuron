import { createRequire } from 'node:module';

const { hostClass } = createRequire(import.meta.url)('../../desktop/public-url.cjs') as {
  hostClass: (hostname: string) => 'loopback' | 'private' | 'public' | 'blocked';
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
