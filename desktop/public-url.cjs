const ipaddr = require('ipaddr.js');

const LOCAL_SUFFIXES = ['.local', '.localhost', '.localdomain', '.internal'];
const BLOCKED_NAMES = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
  'instance-data',
]);

function stripHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function hostClass(hostname) {
  const host = stripHost(hostname);
  if (!host) return 'blocked';
  if (host === 'localhost' || host === 'localhost.localdomain') return 'loopback';
  if (LOCAL_SUFFIXES.some(suffix => host.endsWith(suffix)) || BLOCKED_NAMES.has(host)) return 'blocked';
  let parsed = null;
  try {
    parsed = ipaddr.process(host);
  } catch {
    parsed = null;
  }
  if (parsed) {
    const range = parsed.range();
    if (range === 'loopback') return 'loopback';
    if (range === 'private' || range === 'uniqueLocal' || range === 'carrierGradeNat') return 'private';
    if (range === 'unicast') return 'public';
    return 'blocked';
  }
  if (/^\d+$/.test(host) || /^0x[0-9a-f.]+$/i.test(host) || host.split('.').every(part => /^\d+$/.test(part))) return 'blocked';
  if (host.includes(':')) return 'blocked';
  if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.startsWith('-') || host.endsWith('-') || host.includes('..')) return 'blocked';
  return 'public';
}

function isHttpUrl(value, { standardPort }) {
  try {
    const target = new URL(value);
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) return false;
    if (standardPort && target.port && !['80', '443'].includes(target.port)) return false;
    return hostClass(target.hostname) === 'public';
  } catch {
    return false;
  }
}

function isPublicHttpUrl(value) {
  return isHttpUrl(value, { standardPort: true });
}

function isAgentHttpUrl(value) {
  return isHttpUrl(value, { standardPort: false });
}

function isLoopbackPeer(ip) {
  if (typeof ip !== 'string' || !ip) return false;
  return hostClass(ip.replace(/^::ffff:/i, '')) === 'loopback';
}

async function resolvesPublic(hostname, lookup) {
  if (hostClass(hostname) !== 'public') return false;
  const host = stripHost(hostname);
  try {
    if (ipaddr.process(host).range() === 'unicast') return true;
  } catch {
    /* nome, não endereço literal */
  }
  const answers = await lookup(host, { all: true, verbatim: true });
  return Array.isArray(answers) && answers.length > 0 && answers.every(answer => hostClass(answer.address) === 'public');
}

module.exports = {
  stripHost,
  hostClass,
  isPublicHttpUrl,
  isAgentHttpUrl,
  isLoopbackPeer,
  resolvesPublic,
};
