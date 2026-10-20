import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { Vault } from './vault.js';

const CODE_MS = 60_000;
const ATTEMPTS = 5;
export const GATEWAY_PORT = 52416;
export const EXO_LAN_WARNING = 'A porta 52415 continua acessível na LAN enquanto o EXO estiver ligado. Ela não tem senha. Os outros computadores falam com este LocalNeuron, não com essa porta.';

export function assertLanAddress(host: string) {
  const ip = host.replace(/^\[|\]$/g, '');
  if (ip === '0.0.0.0' || ip === '::' || ip === '') {
    const error = new Error('O modo servidor não abre a escuta para todas as interfaces. Exposição pública fica fora.') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }
  if (ip === '127.0.0.1' || ip === '::1') return ip;
  const parts = ip.split('.').map(Number);
  const v4 = parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
  const privateV4 = v4 && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
  if (!privateV4) {
    const error = new Error('Só a rede local pode usar o modo servidor. Exposição pública fica fora.') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }
  return ip;
}

function fail(statusCode: number, message: string): never {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  throw error;
}

function same(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Peer = { id: string; name: string; created_at: number; revoked: boolean };
type SecretFile = Record<string, string>;

class PeerSecrets {
  private file: string;
  constructor(directory: string, private vault: Vault) {
    this.file = join(directory, 'server-peers.enc.json');
  }
  private key() {
    return createHash('sha256').update(this.vault.key('service')).update('localneuron-server-peers-v1').digest();
  }
  read() {
    if (!existsSync(this.file)) return {} as SecretFile;
    const envelope = JSON.parse(readFileSync(this.file, 'utf8')) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
    const parsed = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8')) as SecretFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }
  write(secrets: SecretFile) {
    if (!Object.keys(secrets).length) {
      rmSync(this.file, { force: true });
      return;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(secrets)), cipher.final()]);
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify({ version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('base64') }), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
}

export class ServerGateway {
  app: FastifyInstance;
  private secrets: PeerSecrets;
  private peersFile: string;
  private logFile: string;
  private peers: Peer[] = [];
  private pending: { code: string; expires: number; attempts: number } | null = null;
  private accepting = false;
  private listening: { host: string; port: number } | null = null;
  private prepared: Promise<void>;
  private closed = false;
  constructor(
    directory: string,
    vault: Vault,
    private exoFetch: typeof fetch = fetch,
    private endpoint: () => string = () => 'http://127.0.0.1:52415',
    private exoRunning: () => boolean = () => false,
    private role: () => string = () => 'off',
    private now: () => number = () => Date.now(),
  ) {
    this.secrets = new PeerSecrets(directory, vault);
    this.peersFile = join(directory, 'server-peers.json');
    this.logFile = join(directory, 'server-gateway-log.json');
    try { this.peers = JSON.parse(readFileSync(this.peersFile, 'utf8')) as Peer[]; } catch { this.peers = []; }
    if (!Array.isArray(this.peers)) this.peers = [];
    this.app = Fastify({ logger: false, trustProxy: false });
    this.prepared = this.mount();
  }
  ready() {
    return this.prepared;
  }
  private persistPeers() {
    writeFileSync(this.peersFile, JSON.stringify(this.peers), { mode: 0o600 });
  }
  private log(machineId: string, path: string) {
    let rows: { at: number; machine_id: string; path: string }[] = [];
    try { rows = JSON.parse(readFileSync(this.logFile, 'utf8')); } catch { rows = []; }
    if (!Array.isArray(rows)) rows = [];
    rows.push({ at: this.now(), machine_id: machineId, path });
    writeFileSync(this.logFile, JSON.stringify(rows.slice(-200)), { mode: 0o600 });
  }
  status() {
    return {
      accepting: this.accepting,
      listening: this.listening,
      public_exposure: false,
      code_expires_at: this.pending?.expires ?? null,
      peers: this.peers.map(({ id, name, created_at, revoked }) => ({ id, name, created_at, revoked })),
      log: this.readLog(),
      exo_warning: this.exoRunning() ? EXO_LAN_WARNING : '',
    };
  }
  readLog() {
    try {
      const rows = JSON.parse(readFileSync(this.logFile, 'utf8'));
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }
  createCode() {
    if (this.role() === 'off') throw new Error('O modo servidor está desligado.');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    this.pending = { code, expires: this.now() + CODE_MS, attempts: 0 };
    this.accepting = true;
    return { code, expires_at: this.pending.expires };
  }
  pair(ip: string, input: unknown) {
    assertLanAddress(ip);
    if (!this.accepting || this.role() === 'off') fail(403, 'O modo servidor está desligado.');
    const bag = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const code = String(bag.code ?? '');
    const name = String(bag.name ?? '').trim();
    if (name.length < 1 || name.length > 80) fail(400, 'Dê um nome a este computador.');
    const pending = this.pending;
    if (!pending || this.now() > pending.expires) {
      this.pending = null;
      fail(401, 'O código expirou.');
    }
    if (pending.attempts >= ATTEMPTS) {
      this.pending = null;
      fail(429, 'Muitas tentativas. Gere outro código.');
    }
    if (!/^\d{6}$/.test(code) || !same(code, pending.code)) {
      pending.attempts += 1;
      if (pending.attempts >= ATTEMPTS) this.pending = null;
      fail(401, 'Código recusado.');
    }
    const id = randomUUID();
    const key = randomBytes(32).toString('base64url');
    const secrets = this.secrets.read();
    secrets[id] = key;
    this.secrets.write(secrets);
    this.peers.push({ id, name, created_at: this.now(), revoked: false });
    this.persistPeers();
    this.pending = null;
    return { id, key, name };
  }
  revoke(input: unknown) {
    const id = String((input as { id?: string } | null)?.id ?? '');
    const peer = this.peers.find(item => item.id === id);
    if (!peer || peer.revoked) throw new Error('Computador pareado não encontrado.');
    peer.revoked = true;
    this.persistPeers();
    const secrets = this.secrets.read();
    delete secrets[id];
    this.secrets.write(secrets);
    return this.status();
  }
  private peerFromKey(authorization: string) {
    const token = authorization.replace(/^Bearer /, '');
    if (!token) fail(401, 'Esta máquina não está pareada.');
    const secrets = this.secrets.read();
    const id = Object.keys(secrets).find(candidate => same(secrets[candidate], token));
    const peer = id ? this.peers.find(item => item.id === id && !item.revoked) : undefined;
    if (!peer) fail(401, 'Esta máquina não está pareada.');
    return peer;
  }
  async forward(ip: string, authorization: string, path: string) {
    assertLanAddress(ip);
    if (!this.accepting || this.role() === 'off') fail(403, 'O modo servidor está desligado.');
    if (path !== '/state' && path !== '/node_id' && !path.startsWith('/instance/previews?')) fail(404, 'Este caminho não passa pelo gateway.');
    const peer = this.peerFromKey(authorization);
    const target = new URL(this.endpoint());
    if (target.hostname !== '127.0.0.1' && target.hostname !== 'localhost') assertLanAddress(target.hostname);
    const response = await this.exoFetch(target.origin + path, { redirect: 'error', signal: AbortSignal.timeout(6000) });
    this.log(peer.id, path);
    if (!response.ok) fail(502, 'EXO: HTTP ' + response.status);
    return { machine: peer.name, body: await response.json() };
  }
  async open(input: unknown) {
    const host = assertLanAddress(String((input as { host?: string } | null)?.host ?? ''));
    if (this.role() === 'off') throw new Error('O modo servidor está desligado.');
    if (this.listening) return this.status();
    if (this.closed) {
      this.app = Fastify({ logger: false, trustProxy: false });
      this.closed = false;
      this.prepared = this.mount();
    }
    await this.ready();
    await this.app.listen({ host, port: GATEWAY_PORT });
    this.listening = { host, port: GATEWAY_PORT };
    this.accepting = true;
    return this.status();
  }
  async stop() {
    this.accepting = false;
    this.pending = null;
    this.listening = null;
    if (this.closed) return this.status();
    this.closed = true;
    await this.prepared.catch(() => undefined);
    await this.app.close();
    return this.status();
  }
  private async mount() {
    const limit = { config: { rateLimit: { max: 8, timeWindow: '1 minute', errorResponseBuilder: () => ({ statusCode: 429, error: 'Too Many Requests', message: 'Aguarde antes de usar o gateway do modo servidor novamente.' }) } } };
    await this.app.register(rateLimit, { global: false });
    this.app.post('/pair', limit, async request => this.pair(request.ip, request.body));
    this.app.get('/exo/state', limit, async request => this.forward(request.ip, request.headers.authorization ?? '', '/state'));
    this.app.get('/exo/node_id', limit, async request => this.forward(request.ip, request.headers.authorization ?? '', '/node_id'));
    this.app.get('/exo/previews', limit, async request => this.forward(request.ip, request.headers.authorization ?? '', '/instance/previews?' + (request.url.split('?')[1] ?? '')));
  }
}
