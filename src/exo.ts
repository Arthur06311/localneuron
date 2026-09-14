import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { networkInterfaces } from "node:os";
import { memoryStatus } from "./model.js";
import type { Backend } from "./inference.js";
import { ExoInstall } from "./exo-install.js";
export function exoEndpoint(value: string) {
  const input = value.trim();
  const u = new URL(input.includes("://") ? input : "http://" + input);
  if (!input.includes("://") && !u.port) u.port = "52415";
  const host = u.hostname;
  const ip = host.split(".").map(Number);
  const privateV4 =
    /^\d+\.\d+\.\d+\.\d+$/.test(host) &&
    ip.every((n) => n >= 0 && n <= 255) &&
    (ip[0] === 10 ||
      ip[0] === 127 ||
      (ip[0] === 192 && ip[1] === 168) ||
      (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31));
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    !(privateV4 || host === "localhost" || host === "[::1]")
  )
    throw Error(
      "Use localhost ou o IP privado de uma máquina da sua rede, sem caminho ou senha na URL.",
    );
  return u.origin;
}
const configSchema = z.strictObject({
  enabled: z.boolean(),
  endpoint: z.string().max(150).transform(exoEndpoint),
  network: z.string().regex(/^[a-zA-Z0-9_-]{4,60}$/),
  offline: z.boolean(),
});
const value = (v: any, snake: string, camel: string) =>
  v?.[snake] ?? v?.[camel];
const unwrap = (v: any) =>
  v &&
  typeof v === "object" &&
  Object.keys(v).length === 1 &&
  /Instance$|ShardMetadata$/.test(Object.keys(v)[0])
    ? (Object.values(v)[0] as any)
    : v;
const bytes = (v: any) => {
  const n = typeof v === "number" ? v : value(v, "in_bytes", "inBytes");
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};
export function exoState(state: any, models: any) {
  if (
    !state ||
    typeof state !== "object" ||
    !Array.isArray(state.topology?.nodes) ||
    !Array.isArray(models?.data)
  )
    throw Error(
      "Esta API não corresponde ao EXO 1.0. Atualize o EXO e confira o endereço.",
    );
  const identities = value(state, "node_identities", "nodeIdentities") || {},
    memory = value(state, "node_memory", "nodeMemory") || {},
    runners = state.runners || {};
  const nodes = state.topology.nodes.slice(0, 128).map((id: string) => ({
    id,
    name:
      value(identities[id], "friendly_name", "friendlyName") || id.slice(0, 12),
    chip: value(identities[id], "chip_id", "chipId") || "Não informado",
    total: bytes(value(memory[id], "ram_total", "ramTotal")),
    available: bytes(value(memory[id], "ram_available", "ramAvailable")),
  }));
  const instances = Object.entries(state.instances || {})
    .slice(0, 100)
    .map(([id, raw]) => {
      const v = unwrap(raw),
        shards = value(v, "shard_assignments", "shardAssignments") || {},
        mapping = value(shards, "node_to_runner", "nodeToRunner") || {};
      const statuses = Object.values(mapping).map(
        (r: any) => Object.keys(runners[r] || {})[0] || "Unknown",
      );
      const model = value(shards, "model_id", "modelId");
      const downloads = Object.entries(state.downloads || {})
        .flatMap(([node, entries]) =>
          Object.keys(mapping).includes(node) && Array.isArray(entries)
            ? entries
            : [],
        )
        .map((entry: any) => Object.values(entry)[0] as any)
        .filter((entry: any) => {
          const shard = unwrap(value(entry, "shard_metadata", "shardMetadata"));
          return (
            value(
              value(shard, "model_card", "modelCard"),
              "model_id",
              "modelId",
            ) === model
          );
        });
      const progress = downloads.reduce(
        (sum: any, entry: any) => {
          const p =
            value(entry, "download_progress", "downloadProgress") || entry;
          return {
            total: sum.total + bytes(p.total),
            downloaded: sum.downloaded + bytes(p.downloaded ?? p.total),
          };
        },
        { total: 0, downloaded: 0 },
      );
      const failure =
        Object.values(mapping)
          .map((r: any) =>
            value(runners[r]?.RunnerFailed, "error_message", "errorMessage"),
          )
          .find(Boolean) ||
        downloads
          .map((d: any) => value(d, "error_message", "errorMessage"))
          .find(Boolean);
      const missing = Object.keys(mapping).filter(id => !nodes.some((n: any) => n.id === id));
      return {
        id,
        model,
        missing_nodes: missing,
        progress,
        error: failure
          ? String(failure)
              .replace(/\x1b\[[0-9;]*m/g, "")
              .slice(0, 800)
          : "",

        nodes: Object.keys(mapping),
        ready:
          Object.keys(mapping).every((id) =>
            nodes.some((n: any) => n.id === id),
          ) &&
          statuses.length > 0 &&
          statuses.every((s) => s === "RunnerReady" || s === "RunnerRunning"),
        state: missing.length ? "disconnected" : statuses.some((s) => s === "RunnerFailed")
          ? "failed"
          : statuses.some((s) => s === "RunnerRunning")
            ? "running"
            : statuses.every((s) => s === "RunnerReady") && statuses.length
              ? "ready"
              : "loading",
      };
    });
  const catalog: {
    id: string;
    name: string;
    size: number;
    context: number;
    tensor: boolean;
    quantization: string;
    ready: boolean;
  }[] = models.data
    .filter(
      (m: any) =>
        typeof m.id === "string" &&
        m.id.length <= 400 &&
        (!m.tasks?.length || m.tasks.includes("TextGeneration")),
    )
    .slice(0, 2000)
    .map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      size: Math.max(0, Number(m.storage_size_megabytes) || 0) * 1024 ** 2,
      context: Math.max(2048, Number(m.context_length) || 16384),
      tensor: m.supports_tensor === true,
      quantization: m.quantization || "",
      ready: instances.some((i) => i.model === m.id && i.ready),
    }));
  return {
    nodes,
    instances,
    catalog,
    available_memory: nodes.reduce((n: number, v: any) => n + v.available, 0),
    total_memory: nodes.reduce((n: number, v: any) => n + v.total, 0),
  };
}
export class ExoRuntime {
  readonly installer: ExoInstall;
  private file: string;
  config: z.infer<typeof configSchema>;
  private cached = exoState({ topology: { nodes: [] } }, { data: [] });
  connected = false;
  error = "";
  private revision = 0;
  private checked = 0;
  private pending: Promise<void> | null = null;
  constructor(
    directory: string,
    private fetcher = fetch,
  ) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = join(directory, "exo-config.json");
    this.config = {
      enabled: false,
      endpoint: "http://127.0.0.1:52415",
      network: "neuron-" + randomBytes(4).toString("hex"),
      offline: false,
    };
    try {
      this.config = configSchema.parse(
        JSON.parse(readFileSync(this.file, "utf8")),
      );
    } catch {}
    this.installer = new ExoInstall(directory);
  }
  async request(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    timeout = 6000,
  ) {
    if (!this.config.enabled) throw Error("Conecte a Rede EXO primeiro.");
    const response = await this.fetcher(this.config.endpoint + path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { "content-type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const data = (await response.json()) as any;
        detail = String(data.detail || data.error?.message || "").slice(0, 500);
      } catch {}
      throw Error("EXO: " + (detail || "HTTP " + response.status));
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 12 * 1024 ** 2) throw Error("Resposta EXO muito grande.");
    const text = await response.text();
    if (text.length > 12 * 1024 ** 2) throw Error("Resposta EXO muito grande.");
    return text ? JSON.parse(text) : {};
  }
  async refresh(force = false) {
    if (this.pending) return this.pending;
    if (!force && Date.now() - this.checked < 3000) return;
    if (!this.config.enabled) {
      this.connected = false;
      return;
    }
    const revision = this.revision;
    this.pending = (async () => {
      try {
        const [state, models] = await Promise.all([
          this.request("/state"),
          this.request("/v1/models"),
        ]);
        if (revision !== this.revision) return;
        this.cached = exoState(state, models);
        this.connected = true;
        this.error = "";
      } catch (error) {
        if (revision !== this.revision) return;
        this.connected = false;
        this.error = (error as Error).message;
        this.cached = exoState({ topology: { nodes: [] } }, { data: [] });
      } finally {
        if (revision === this.revision) this.checked = Date.now();
      }
    })();
    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
  }
  snapshot() {
    return {
      ...this.cached,
      ...this.config,
      connected: this.connected,
      error: this.error,
      checked_at: this.checked,
      installation: this.installer.status(),
      connection_addresses: this.installer.running ? Object.values(networkInterfaces()).flatMap(entries => (entries || []).filter(n => n.family === "IPv4" && !n.internal).flatMap(n => { try { return [exoEndpoint("http://" + n.address + ":52415")]; } catch { return []; } })) : [],
    };
  }
  configure(input: unknown) {
    if (this.installer.running)
      throw Error("Pare este nó antes de trocar a configuração.");
    this.config = configSchema.parse(input);
    this.error = "";
    this.revision++;
    writeFileSync(this.file, JSON.stringify(this.config), { mode: 0o600 });
    this.connected = false;
    this.checked = 0;
    this.cached = exoState({ topology: { nodes: [] } }, { data: [] });
    return this.snapshot();
  }
  inventory() {
    if (!this.connected) return [];
    return this.cached.catalog
      .filter((m) => m.ready)
      .map((m) => ({
        type: "llm",
        key: "exo:" + m.id,
        path: "",
        display_name: m.name + " · Rede EXO",
        format: "EXO",
        size_bytes: m.size,
        loaded_instances: [
          { id: "exo:" + m.id, config: { context_length: m.context } },
        ],
      }));
  }
  backend(key: string): Backend {
    const model = key.slice(4);
    return {
      endpoint: this.config.endpoint,
      headers: {},
      model,
      nativeTools: false,
      status: async () => {
        await this.refresh(true);
        if (!this.connected)
          throw Error("A Rede EXO desconectou. Confira as outras máquinas.");
        const active = this.inventory();
        return {
          available: true,
          endpoint: this.config.endpoint,
          api: "exo",
          models: active.map((m) => m.key),
          model_info: active.map((m) => ({
            id: m.key,
            key: m.key,
            context_length: m.loaded_instances[0].config.context_length,
            reasoning_off: false,
          })),
          ...memoryStatus(),
        };
      },
    };
  }
  async load(key: string, context: number) {
    await this.refresh(true);
    const model = this.cached.catalog.find(
      (m) => "exo:" + m.id === key && m.ready,
    );
    if (!this.connected || !model)
      throw Error(
        "Prepare o modelo na Rede EXO e aguarde todas as máquinas ficarem prontas.",
      );
    return {
      instance_id: key,
      status: "loaded",
      load_config: { context_length: Math.min(context, model.context) },
    };
  }
  async prepare(model: string, nodes: number, sharding: "Pipeline" | "Tensor", selected: string[] = []) {
    await this.refresh(true);
    const m = this.cached.catalog.find((m) => m.id === model);
    if (!this.connected || !m)
      throw Error("Escolha um modelo listado pelo EXO conectado.");
    if (nodes > this.cached.nodes.length)
      throw Error("Não há máquinas suficientes conectadas.");
    if (this.cached.instances.some((i) => i.model === model))
      throw Error(
        "Este modelo já tem uma instância. Aguarde ou libere-a antes.",
      );
    if (sharding === "Tensor" && !m.tensor)
      throw Error("Este modelo não informa suporte a divisão por tensores.");
    const revision = this.revision;
    if (new Set(selected).size !== selected.length || selected.some(id => !this.cached.nodes.some((n: any) => n.id === id)))
      throw Error("Uma máquina selecionada saiu da rede. Atualize a seleção.");
    if (selected.length && selected.length !== nodes) throw Error("A quantidade de máquinas deve corresponder à seleção.");
    let placement: any;
    if (selected.length) {
      const query = new URLSearchParams({ model_id: model });
      selected.forEach(id => query.append("node_ids", id));
      const response = await this.request("/instance/previews?" + query, undefined, "GET", 30000);
      const preview = (Array.isArray(response.previews) ? response.previews : []).find((p: any) => {
        const v = unwrap(p.instance), shards = value(v, "shard_assignments", "shardAssignments"), mapping = value(shards, "node_to_runner", "nodeToRunner") || {};
        const actual = Object.keys(mapping);
        return !p.error && p.sharding === sharding && value(p, "instance_meta", "instanceMeta") === "MlxRing" && value(shards, "model_id", "modelId") === model && actual.length === selected.length && actual.every(id => selected.includes(id));
      });
      if (!preview) throw Error("O EXO não encontrou uma divisão usando exatamente as máquinas selecionadas. Confira a memória e a conexão entre elas ou use seleção automática.");
      placement = preview.instance;
    } else placement = await this.request(
      "/instance/placement?" +
        new URLSearchParams({
          model_id: model,
          min_nodes: String(nodes),
          sharding,
          instance_meta: "MlxRing",
        }),
      undefined,
      "GET",
      30000,
    );
    if (revision !== this.revision || !this.config.enabled) throw Error("A conexão EXO mudou durante a preparação. Tente novamente.");
    const result = await this.request(
      "/instance",
      { instance: placement },
      "POST",
      30000,
    );
    this.checked = 0;
    return result;
  }
  async unload(key: string) {
    await this.refresh(true);
    const matches = this.cached.instances.filter(
      (i) => i.model === key.slice(4),
    );
    if (!matches.length) throw Error("Instância EXO não encontrada.");
    for (const i of matches) await this.remove(i.id);
    return { ok: true };
  }
  async remove(id: string) {
    await this.refresh(true);
    if (!this.cached.instances.some((i) => i.id === id))
      throw Error("Instância fora desta rede EXO.");
    await this.request(
      "/instance/" + encodeURIComponent(id),
      undefined,
      "DELETE",
    );
    this.checked = 0;
    return { ok: true };
  }
  async start() {
    if (this.config.endpoint !== "http://127.0.0.1:52415")
      throw Error(
        "Para iniciar neste computador, use o endereço padrão 127.0.0.1:52415.",
      );
    if (
      await this.fetcher(this.config.endpoint + "/node_id", {
        signal: AbortSignal.timeout(1000),
        redirect: "error",
      })
        .then((r) => r.ok)
        .catch(() => false)
    )
      throw Error(
        "Já existe um EXO na porta 52415. Use Conectar ao EXO existente.",
      );
    await this.installer.start(this.config.network, this.config.offline);
    this.config.enabled = true;
    writeFileSync(this.file, JSON.stringify(this.config), { mode: 0o600 });
    this.checked = 0;
    return this.snapshot();
  }
  async stop() {
    await this.installer.stop();
    this.config.enabled = false;
    this.revision++;
    this.checked = 0;
    this.error = "";
    this.cached = exoState({ topology: { nodes: [] } }, { data: [] });
    writeFileSync(this.file, JSON.stringify(this.config), { mode: 0o600 });
    this.connected = false;
    return this.snapshot();
  }
  async close() {
    await this.installer.close();
  }
}
