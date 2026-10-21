import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { release } from 'node:os';
import { exoEndpoint } from './exo.js';

export type ServerRole = 'off' | 'contribute' | 'manage' | 'use';
export type HostInfo = { platform: string; arch: string; release: string };
export type ServerLinkKind = 'rdma' | 'tcp';

// TODO(fase RDMA): não abrir conexões RDMA. O caminho desta fase é TCP.
// A linha grossa só mostra Thunderbolt ou RDMA que o EXO já reportou.
const RDMA_LATER = 'TCP';

type Stored = { role: ServerRole; no_worker: boolean; endpoint: string; selected: string[] };
type NodeView = { id: string; name: string; total: number; available: number; master: boolean };
type LinkView = { from: string; to: string; kind: ServerLinkKind; label: string };

const roles: ServerRole[] = ['off', 'contribute', 'manage', 'use'];

export function workerEligibility(host: HostInfo) {
  const [major, minor] = host.release.split('.').map(Number);
  const mac = host.platform === 'darwin' && host.arch === 'arm64' && (major > 25 || (major === 25 && (minor || 0) >= 2));
  if (mac) return { allowed: true, experimental: false, reason: 'Mac Apple Silicon com macOS 26.2 ou superior.' };
  if (host.platform === 'linux') return { allowed: true, experimental: true, reason: 'Linux em CPU é experimental. O motor do EXO não está homologado neste sistema.' };
  return { allowed: false, experimental: false, reason: 'Contribuir só está disponível no Mac Apple Silicon com macOS 26.2 ou superior e, em caráter experimental, no Linux em CPU.' };
}

export function participationPlan(role: ServerRole, noWorker = false) {
  if (role === 'off') return { role, args: [] as string[], startsNode: false, noWorker: false, note: 'O modo servidor está desligado.', transport: RDMA_LATER };
  if (role === 'use') return { role, args: [] as string[], startsNode: false, noWorker: false, note: 'Este computador só usa a rede e não inicia um nó.', transport: RDMA_LATER };
  if (role === 'contribute') return { role, args: [] as string[], startsNode: true, noWorker: false, note: 'Este computador contribui como worker. A descoberta na LAN é automática. O namespace não é senha.', transport: RDMA_LATER };
  const args = ['--force-master'];
  if (noWorker) args.push('--no-worker');
  return { role, args, startsNode: true, noWorker, note: 'O EXO pode eleger outro master. --force-master só dá preferência.', transport: RDMA_LATER };
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function text(value: unknown, ...keys: string[]) {
  const bag = record(value);
  if (!bag) return undefined;
  for (const key of keys) if (bag[key] != null) return bag[key];
  return undefined;
}
function bytes(value: unknown) {
  const raw = typeof value === 'number' ? value : text(value, 'in_bytes', 'inBytes');
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
}
function unwrap(value: unknown) {
  const bag = record(value);
  if (!bag) return value;
  const keys = Object.keys(bag);
  return keys.length === 1 && /Instance$|ShardMetadata$/.test(keys[0]) ? bag[keys[0]] : value;
}

function pushLink(links: Map<string, LinkView>, from: string, to: string, kindRaw: unknown) {
  if (!from || !to || from === to || from.length > 200 || to.length > 200) return;
  const label = String(kindRaw ?? 'socket');
  const rdma = /rdma|thunderbolt/i.test(label);
  const key = [from, to].sort().join('\0');
  const next: LinkView = { from, to, kind: rdma ? 'rdma' : 'tcp', label: rdma ? 'Thunderbolt/RDMA' : 'Rede' };
  const current = links.get(key);
  if (!current || (current.kind === 'tcp' && next.kind === 'rdma')) links.set(key, next);
}

export function readLinks(state: unknown) {
  const bag = record(state);
  const topology = record(bag?.topology);
  const raw = topology?.connections ?? topology?.edges ?? bag?.connections ?? [];
  const links = new Map<string, LinkView>();
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, 256)) {
      const row = record(item);
      if (!row) continue;
      pushLink(links, String(row.source ?? row.from ?? row.local_node_id ?? row.localNodeId ?? ''), String(row.target ?? row.to ?? row.peer_node_id ?? row.peerNodeId ?? ''), row.type ?? row.connection_type ?? row.connectionType ?? row.kind);
    }
  } else {
    const map = record(raw);
    for (const [from, peers] of Object.entries(map ?? {}).slice(0, 128)) {
      const row = record(peers);
      if (!row) continue;
      for (const [to, kind] of Object.entries(row).slice(0, 128)) {
        for (const item of Array.isArray(kind) ? kind : [kind]) pushLink(links, from, to, item);
      }
    }
  }
  return [...links.values()];
}

export function readMaster(body: unknown) {
  if (typeof body === 'string' && body.length > 0 && body.length <= 200) return body;
  const bag = record(body);
  const master = bag?.master_node_id ?? bag?.masterNodeId ?? bag?.master;
  if (typeof master === 'string') return master;
  if (bag?.is_master === true && typeof bag.node_id === 'string') return bag.node_id;
  return null;
}

export function serverModeMap(state: unknown, masterId: string | null) {
  const bag = record(state);
  const nodesRaw = record(bag?.topology)?.nodes;
  if (!Array.isArray(nodesRaw)) throw new Error('Esta API não corresponde ao EXO 1.0. Atualize o EXO e confira o endereço.');
  const identities = record(text(bag, 'node_identities', 'nodeIdentities')) ?? {};
  const memory = record(text(bag, 'node_memory', 'nodeMemory')) ?? {};
  const nodes: NodeView[] = nodesRaw.slice(0, 128).filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200).map(id => ({
    id,
    name: String(text(identities[id], 'friendly_name', 'friendlyName') || id.slice(0, 12)),
    total: bytes(text(memory[id], 'ram_total', 'ramTotal')),
    available: bytes(text(memory[id], 'ram_available', 'ramAvailable')),
    master: masterId === id,
  }));
  const known = new Set(nodes.map(node => node.id));
  return { nodes, links: readLinks(state).filter(link => known.has(link.from) && known.has(link.to)), master: masterId, transport: RDMA_LATER };
}

function previewNodes(preview: Record<string, unknown>) {
  const instance = record(unwrap(preview.instance));
  const shards = record(text(instance, 'shard_assignments', 'shardAssignments'));
  const mapping = record(text(shards, 'node_to_runner', 'nodeToRunner')) ?? {};
  return { model: text(shards, 'model_id', 'modelId') ?? preview.model_id, nodes: Object.keys(mapping) };
}

export function memoryByNode(body: unknown, modelId: string, selected: string[]) {
  if (!selected.length) throw new Error('Escolha pelo menos um computador.');
  if (new Set(selected).size !== selected.length) throw new Error('Há um computador repetido na seleção.');
  const previews = Array.isArray(record(body)?.previews) ? (record(body)?.previews as unknown[]) : [];
  const match = previews.map(record).find(preview => {
    if (!preview || preview.error) return false;
    const parsed = previewNodes(preview);
    return parsed.model === modelId && parsed.nodes.length === selected.length && parsed.nodes.every(id => selected.includes(id));
  });
  if (!match) throw new Error('O EXO não mostrou uma divisão para os computadores escolhidos.');
  const memory = record(match.memory_delta_by_node ?? match.memoryDeltaByNode) ?? {};
  return selected.map(id => ({ id, bytes: bytes(memory[id]) }));
}

function defaults(): Stored {
  return { role: 'off', no_worker: false, endpoint: 'http://127.0.0.1:52415', selected: [] };
}

export class ServerMode {
  private file: string;
  private config: Stored = defaults();
  private generation = 0;
  private mapCache: ReturnType<typeof serverModeMap> | null = null;
  constructor(directory: string, private fetcher: typeof fetch = fetch, private host: HostInfo = { platform: process.platform, arch: process.arch, release: release() }) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = join(directory, 'server-mode.json');
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Stored>;
      this.config = {
        role: roles.includes(raw.role as ServerRole) ? (raw.role as ServerRole) : 'off',
        no_worker: raw.no_worker === true && raw.role === 'manage',
        endpoint: exoEndpoint(String(raw.endpoint || defaults().endpoint)),
        selected: Array.isArray(raw.selected) ? raw.selected.filter((id): id is string => typeof id === 'string').slice(0, 128) : [],
      };
    } catch {
      this.config = defaults();
    }
  }
  private persist() {
    writeFileSync(this.file, JSON.stringify(this.config), { mode: 0o600 });
  }
  snapshot() {
    const eligibility = workerEligibility(this.host);
    return { ...this.config, enabled: this.config.role !== 'off', eligibility, plan: participationPlan(this.config.role, this.config.no_worker), map: this.mapCache };
  }
  setRole(input: unknown) {
    const bag = record(input);
    const role = bag?.role;
    if (!roles.includes(role as ServerRole)) throw new Error('Escolha como este computador vai participar.');
    const next = role as ServerRole;
    const noWorker = bag?.no_worker === true;
    if (noWorker && next !== 'manage') throw new Error('A opção de não rodar modelo aqui só vale ao gerenciar.');
    if (next === 'contribute' && !workerEligibility(this.host).allowed) throw new Error(workerEligibility(this.host).reason);
    const endpoint = bag?.endpoint == null ? this.config.endpoint : exoEndpoint(String(bag.endpoint));
    this.generation++;
    this.config = { role: next, no_worker: next === 'manage' && noWorker, endpoint, selected: next === 'off' ? [] : this.config.selected };
    this.mapCache = null;
    this.persist();
    return this.snapshot();
  }
  disable() {
    this.generation++;
    this.config = { ...this.config, role: 'off', no_worker: false, selected: [] };
    this.mapCache = null;
    this.persist();
    return this.snapshot();
  }
  private async read(path: string) {
    if (this.config.role === 'off') throw new Error('O modo servidor está desligado.');
    const response = await this.fetcher(this.config.endpoint + path, { redirect: 'error', signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('EXO: HTTP ' + response.status);
    return response.json() as Promise<unknown>;
  }
  async map() {
    const generation = this.generation;
    const [state, master] = await Promise.all([this.read('/state'), this.read('/node_id')]);
    if (generation !== this.generation || this.config.role === 'off') throw new Error('O modo servidor foi desligado durante a descoberta.');
    this.mapCache = serverModeMap(state, readMaster(master));
    return this.snapshot();
  }
  async preview(input: unknown) {
    const bag = record(input);
    const model = typeof bag?.model_id === 'string' ? bag.model_id : '';
    const selected = Array.isArray(bag?.nodes) ? bag.nodes.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200).slice(0, 128) : [];
    if (!model || model.length > 400) throw new Error('Informe o modelo para ver a divisão.');
    const query = new URLSearchParams({ model_id: model });
    selected.forEach(id => query.append('node_ids', id));
    const generation = this.generation;
    const body = await this.read('/instance/previews?' + query);
    if (generation !== this.generation || this.config.role === 'off') throw new Error('O modo servidor foi desligado durante a prévia.');
    const memory = memoryByNode(body, model, selected);
    this.config.selected = selected;
    this.persist();
    return { ...this.snapshot(), preview: memory };
  }
}
