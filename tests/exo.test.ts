import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { exoEndpoint, exoLanAddresses, exoNamespace, exoState, ExoRuntime, EXO_NAMESPACE } from "../src/exo.js";
import { exoCliFlag, planExoLaunch, type ExoInstallHooks } from "../src/exo-install.js";
import { complete, optionsSchema } from "../src/inference.js";
const G = 1024 ** 3,
  model = "mlx-community/Qwen3-8B-4bit",
  networkId = "neuron-" + "0123456789abcdef".repeat(2);
const helpLegacy = "usage: EXO [-h] [--api-port API_PORT]\n  --api-port API_PORT\n";
const helpBind = helpLegacy + "  --api-host API_HOST  HTTP API host to bind.\n";
const helpModern = helpBind + "  --namespace NAMESPACE  Discovery namespace.\n";
const catalog = {
  data: [
    {
      id: model,
      name: "Qwen3 8B",
      storage_size_megabytes: 5120,
      context_length: 32768,
      supports_tensor: true,
      tasks: ["TextGeneration"],
    },
    { id: "image-only", tasks: ["ImageGeneration"] },
  ],
};
const instance = {
  MlxRingInstance: {
    instanceId: "instance-1",
    shardAssignments: {
      modelId: model,
      nodeToRunner: { a: "runner-a", b: "runner-b" },
      runnerToShard: {},
    },
  },
};
const cluster = () => ({
  topology: { nodes: ["a", "b"] },
  nodeIdentities: {
    a: { friendlyName: "Mac de Arthur", chipId: "Apple M4" },
    b: { friendlyName: "Segundo Mac", chipId: "Apple M3" },
  },
  nodeMemory: {
    a: { ramTotal: { inBytes: 24 * G }, ramAvailable: { inBytes: 12 * G } },
    b: { ramTotal: { inBytes: 32 * G }, ramAvailable: { inBytes: 20 * G } },
  },
  instances: { "instance-1": instance },
  runners: {
    "runner-a": { RunnerReady: {} },
    "runner-b": { RunnerRunning: {} },
  },
});
test("EXO aceita somente endereços locais sem credenciais ou caminhos", () => {
  for (const input of [
    "http://127.0.0.1:52415",
    "http://192.168.1.10:52415",
    "https://10.0.0.2",
    "http://[::1]:52415",
  ])
    assert.equal(exoEndpoint(input), input);
  for (const input of [
    "https://example.com",
    "http://169.254.169.254",
    "http://8.8.8.8",
    "http://172.32.0.1",
    "file:///etc/passwd",
    "http://user:pass@127.0.0.1",
    "http://localhost/v1",
    "http://localhost/?x=1",
  ])
    assert.throws(() => exoEndpoint(input));
});
test("EXO distingue catálogo de modelos carregados e exige todos os nós prontos", () => {
  const state = cluster(),
    snapshot = exoState(state, catalog);
  assert.equal(snapshot.total_memory, 56 * G);
  assert.equal(snapshot.available_memory, 32 * G);
  assert.equal(snapshot.nodes[0].name, "Mac de Arthur");
  assert.equal(snapshot.catalog.length, 1);
  assert.equal(snapshot.catalog[0].ready, true);
  const loading = structuredClone(state) as any;
  loading.runners["runner-b"] = { RunnerLoading: {} };
  assert.equal(exoState(loading, catalog).catalog[0].ready, false);
  const missing = structuredClone(state);
  missing.topology.nodes = ["a"];
  assert.equal(exoState(missing, catalog).catalog[0].ready, false);
  assert.equal(
    exoState({ ...state, instances: {} }, catalog).catalog[0].ready,
    false,
  );
  const snake = JSON.parse(
    JSON.stringify(state)
      .replaceAll("nodeIdentities", "node_identities")
      .replaceAll("friendlyName", "friendly_name")
      .replaceAll("nodeMemory", "node_memory")
      .replaceAll("ramTotal", "ram_total")
      .replaceAll("ramAvailable", "ram_available")
      .replaceAll("inBytes", "in_bytes")
      .replaceAll("shardAssignments", "shard_assignments")
      .replaceAll("modelId", "model_id")
      .replaceAll("nodeToRunner", "node_to_runner"),
  );
  assert.equal(exoState(snake, catalog).catalog[0].ready, true);
  assert.equal(exoState(snake, catalog).total_memory, 56 * G);
  assert.throws(() => exoState({}, { data: [] }), /não corresponde/);
});
test("EXO prepara pelo planejamento oficial, encaminha o ID do modelo e retira modelos desconectados", async () => {
  const dir = mkdtempSync(join(tmpdir(), "neuron-exo-"));
  let state: any = { ...cluster(), instances: {} },
    offline = false;
  const calls: { path: string; body: any }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(init?.redirect, "error");
    if (offline) throw Error("Rede perdida");
    const path = new URL(String(url)).pathname;
    calls.push({
      path,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (path === "/state") return Response.json(state);
    if (path === "/v1/models") return Response.json(catalog);
    if (path === "/instance/placement") {
      assert.equal(new URL(String(url)).searchParams.get("min_nodes"), "2");
      return Response.json(instance);
    }
    if (path === "/instance")
      return Response.json({ message: "Command received" });
    if (path === "/instance/instance-1") {
      assert.equal(init?.method, "DELETE");
      return Response.json({});
    }
    throw Error(path);
  };
  const exo = new ExoRuntime(dir, fetcher);
  const original = globalThis.fetch;
  try {
    exo.configure({
      enabled: true,
      endpoint: "http://127.0.0.1:52416",
      network: networkId,
      offline: false,
    });
    await exo.refresh(true);
    assert.equal(exo.inventory().length, 0);
    await assert.rejects(exo.load("exo:" + model, 8192), /Prepare/);
    await assert.rejects(exo.prepare(model, 3, "Pipeline"), /suficientes/);
    await assert.rejects(exo.prepare("other", 2, "Pipeline"), /listado/);
    await exo.prepare(model, 2, "Pipeline");
    assert.deepEqual(calls.find((c) => c.path === "/instance")?.body, {
      instance,
    });
    state = cluster();
    await exo.refresh(true);
    assert.equal(exo.inventory()[0].key, "exo:" + model);
    await assert.rejects(exo.prepare(model, 2, "Pipeline"), /já tem/);
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "http://127.0.0.1:52416/v1/chat/completions");
      const sent = JSON.parse(String(init?.body));
      assert.equal(sent.model, model);
      return new Response(
        "data: " +
          JSON.stringify({
            choices: [
              { delta: { content: "Resposta da rede" }, finish_reason: "stop" },
            ],
          }) +
          "\n\ndata: [DONE]\n\n",
      );
    };
    const result = await complete(
      "exo:" + model,
      [{ role: "user", content: "Olá" }],
      optionsSchema.parse({}),
      new AbortController().signal,
      () => {},
      exo.backend("exo:" + model),
    );
    assert.equal(result.text, "Resposta da rede");
    await exo.remove("instance-1");
    assert.ok(calls.some((c) => c.path === "/instance/instance-1"));
    offline = true;
    await exo.refresh(true);
    assert.equal(exo.inventory().length, 0);
    await assert.rejects(exo.backend("exo:" + model).status(), /desconectou/);
  } finally {
    globalThis.fetch = original;
    await exo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EXO mostra progresso e erro do download apenas nas máquinas da instância", () => {
  const state: any = cluster();
  state.downloads = {
    a: [
      {
        DownloadOngoing: {
          shardMetadata: {
            PipelineShardMetadata: { modelCard: { modelId: model } },
          },
          downloadProgress: {
            total: { inBytes: 10 * G },
            downloaded: { inBytes: 3 * G },
          },
        },
      },
    ],
    b: [
      {
        DownloadFailed: {
          shardMetadata: {
            PipelineShardMetadata: { modelCard: { modelId: model } },
          },
          errorMessage: "Download interrompido",
        },
      },
    ],
    other: [
      {
        DownloadOngoing: {
          shardMetadata: {
            PipelineShardMetadata: { modelCard: { modelId: model } },
          },
          downloadProgress: {
            total: { inBytes: 99 * G },
            downloaded: { inBytes: 80 * G },
          },
        },
      },
    ],
  };
  const entry = exoState(state, catalog).instances[0];
  assert.deepEqual(entry.progress, { total: 10 * G, downloaded: 3 * G });
  assert.equal(entry.error, "Download interrompido");
});
test("Resposta atrasada do EXO não reconecta a rede depois de desconectar", async () => {
  const dir = mkdtempSync(join(tmpdir(), "exo-race-"));
  let respond!: () => void;
  const gate = new Promise<void>((r) => (respond = r));
  const exo = new ExoRuntime(dir, async (url) => {
    await gate;
    return Response.json(String(url).endsWith("/state") ? cluster() : catalog);
  });
  try {
    exo.configure({
      enabled: true,
      endpoint: "http://localhost:52415",
      network: networkId,
      offline: false,
    });
    const pending = exo.refresh(true);
    await exo.stop();
    respond();
    await pending;
    assert.equal(exo.connected, false);
    assert.equal(exo.inventory().length, 0);
    assert.equal(exo.snapshot().nodes.length, 0);
    assert.equal(exo.snapshot().exposed, false);
    Object.defineProperty(exo.installer, "running", { configurable: true, get: () => true });
    assert.equal(exo.snapshot().exposed, false);
    Object.defineProperty(exo.installer, "exposed", { configurable: true, get: () => true });
    assert.equal(exo.snapshot().exposed, true);
  } finally {
    await exo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("IP simples usa a porta EXO e nó ausente nunca aparece como pronto", () => {
  assert.equal(exoEndpoint(" 192.168.1.8 "), "http://192.168.1.8:52415");
  const s = cluster();s.topology.nodes = ["a"];
  const result = exoState(s, catalog).instances[0];
  assert.equal(result.state, "disconnected");assert.deepEqual(result.missing_nodes, ["b"]);
});
test("Seleção manual usa somente as máquinas escolhidas e recusa divisões ampliadas", async () => {
  const dir = mkdtempSync(join(tmpdir(), "exo-select-"));let extra = false, sent = 0;
  const exo = new ExoRuntime(dir, async (url, init) => {
    const u = new URL(String(url));
    if (u.pathname === "/state") return Response.json({...cluster(), instances: {}});
    if (u.pathname === "/v1/models") return Response.json(catalog);
    if (u.pathname === "/instance/previews") {
      assert.deepEqual(u.searchParams.getAll("node_ids"), ["a", "b"]);
      const placement = structuredClone(instance) as any;
      if(extra)placement.MlxRingInstance.shardAssignments.nodeToRunner.c = "runner-c";
      return Response.json({previews: [{sharding:"Pipeline",instance_meta:"MlxRing",instance:placement,error:null}]});
    }
    if(u.pathname === "/instance"){sent++;assert.deepEqual(JSON.parse(String(init?.body)),{instance});return Response.json({});}
    throw Error(u.pathname);
  });
  try {
    exo.configure({enabled:true,endpoint:"192.168.1.8",network:networkId,offline:false});
    await exo.prepare(model,2,"Pipeline",["a","b"]);assert.equal(sent,1);
    extra = true;
    await assert.rejects(exo.prepare(model,2,"Pipeline",["a","b"]), /exatamente/);
    await assert.rejects(exo.prepare(model,2,"Pipeline",["a","a"]), /selecionada/);
    await assert.rejects(exo.prepare(model,2,"Pipeline",["a","missing"]), /selecionada/);
    assert.equal(sent,1);
  } finally {await exo.close();rmSync(dir,{recursive:true,force:true});}
});
test("Trocar a rede durante o planejamento não cria instância no destino novo", async () => {
  const dir = mkdtempSync(join(tmpdir(), "exo-placement-race-"));let reached!:()=>void, release!:()=>void, sent=0;
  const planning=new Promise<void>(r=>reached=r),gate=new Promise<void>(r=>release=r);
  const exo=new ExoRuntime(dir,async(url)=>{
    const path=new URL(String(url)).pathname;
    if(path==='/state')return Response.json({...cluster(),instances:{}});
    if(path==='/v1/models')return Response.json(catalog);
    if(path==='/instance/placement'){reached();await gate;return Response.json(instance);}
    sent++;return Response.json({});
  });
  try {
    const config={enabled:true,endpoint:'192.168.1.8',network:networkId,offline:false};exo.configure(config);
    const pending=exo.prepare(model,2,'Pipeline');await planning;exo.configure({...config,endpoint:'192.168.1.9'});release();
    await assert.rejects(pending,/conexão EXO mudou/);assert.equal(sent,0);
  } finally {await exo.close();rmSync(dir,{recursive:true,force:true});}
});
const nics = {
  lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  eth0: [
    { address: "192.168.1.20", family: "IPv4", internal: false },
    { address: "8.8.8.8", family: "IPv4", internal: false },
  ],
  lan: [{ address: "10.1.2.3", family: "IPv4", internal: false }],
  wifi: [{ address: "fe80::1", family: "IPv6", internal: false }],
};
test("Endereços LAN só são anunciados com exposição ativa", () => {
  assert.deepEqual(exoLanAddresses(false, nics), []);
  assert.deepEqual(exoLanAddresses(true, nics), [
    "http://192.168.1.20:52415",
    "http://10.1.2.3:52415",
  ]);
});
test("Identificação nova tem 128 bits e identificações curtas são rejeitadas", () => {
  const id = exoNamespace();
  assert.match(id, EXO_NAMESPACE);
  assert.equal(Buffer.from(id.slice("neuron-".length), "hex").length, 16);
  assert.notEqual(exoNamespace(), exoNamespace());
  assert.equal(exoCliFlag("  --api-host API_HOST", "api-host"), true);
  assert.equal(exoCliFlag("[--api-host API_HOST]", "api-host"), true);
  assert.equal(exoCliFlag("--api-hostname", "api-host"), false);
  const loopback = planExoLaunch(helpBind, false);
  assert.equal(loopback.refusal, null);
  assert.equal(loopback.apiHost, "127.0.0.1");
  assert.deepEqual(loopback.args, ["--api-port", "52415", "--api-host", "127.0.0.1"]);
  const opted = planExoLaunch(helpBind, true);
  assert.equal(opted.apiHost, "0.0.0.0");
  assert.equal(opted.unrestricted, false);
  const legacy = planExoLaunch(helpLegacy, false);
  assert.match(legacy.refusal ?? "", /0\.0\.0\.0/);
  assert.equal(planExoLaunch(helpLegacy, true).unrestricted, true);
  assert.equal(planExoLaunch(helpLegacy, true).apiHost, null);
  assert.equal(planExoLaunch(helpModern, false).namespaceArg, true);
  assert.equal(planExoLaunch(helpModern, false).useLibp2pNamespaceEnv, false);
});
test("Configuração antiga ganha namespace de 128 bits e não anuncia a LAN", () => {
  const dir = mkdtempSync(join(tmpdir(), "exo-migrate-"));
  try {
    writeFileSync(join(dir, "exo-config.json"), JSON.stringify({
      enabled: false,
      endpoint: "http://10.0.0.4:52415",
      network: "neuron-abcd",
      offline: true,
    }));
    const exo = new ExoRuntime(dir);
    assert.match(exo.config.network, EXO_NAMESPACE);
    assert.notEqual(exo.config.network, "neuron-abcd");
    assert.equal(exo.config.endpoint, "http://10.0.0.4:52415");
    assert.equal(exo.config.offline, true);
    assert.equal(exo.config.expose_lan, false);
    assert.deepEqual(exo.snapshot().connection_addresses, []);
    assert.equal(exo.snapshot().lan_exposed, false);
    assert.equal(exo.snapshot().lan_warning, "");
    const saved = JSON.parse(readFileSync(join(dir, "exo-config.json"), "utf8"));
    assert.equal(saved.network, exo.config.network);
    assert.equal(saved.expose_lan, false);
    assert.throws(() => exo.configure({
      enabled: true,
      endpoint: "http://127.0.0.1:52415",
      network: "test-exo",
      offline: false,
      expose_lan: false,
    }), /128 bits/);
    exo.configure({
      enabled: true,
      endpoint: "http://127.0.0.1:52415",
      network: networkId,
      offline: false,
      expose_lan: true,
    });
    assert.equal(exo.snapshot().expose_lan, true);
    assert.deepEqual(exo.snapshot().connection_addresses, []);
    assert.equal(exo.snapshot().lan_warning, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
function fakeSpawn(calls: { args: readonly string[]; env: NodeJS.ProcessEnv }[]) {
  return ((
    _command: string,
    args: readonly string[],
    options: { env: NodeJS.ProcessEnv },
  ) => {
    calls.push({ args, env: options.env });
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: (signal?: NodeJS.Signals) => boolean;
    };
    child.pid = 51515;
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => {
      if (child.signalCode || child.exitCode !== null) return true;
      child.signalCode = signal ?? "SIGTERM";
      child.emit("exit", null, child.signalCode);
      return true;
    };
    queueMicrotask(() => child.emit("spawn"));
    return child;
  }) as NonNullable<ExoInstallHooks["spawn"]>;
}
const offlineFetch: typeof fetch = async () => new Response(null, { status: 503 });
async function bootExo(help: string, exposeLan: boolean) {
  const dir = mkdtempSync(join(tmpdir(), "exo-bind-"));
  const calls: { args: readonly string[]; env: NodeJS.ProcessEnv }[] = [];
  const exo = new ExoRuntime(dir, offlineFetch, {
    helpText: help,
    allowUnsupported: true,
    spawn: fakeSpawn(calls),
  });
  mkdirSync(exo.installer.directory, { recursive: true });
  writeFileSync(join(exo.installer.directory, "exo"), "");
  exo.configure({
    enabled: true,
    endpoint: "http://127.0.0.1:52415",
    network: networkId,
    offline: false,
    expose_lan: exposeLan,
  });
  return { dir, exo, calls };
}
test("Padrão é loopback e opt-in anuncia a LAN; EXO sem bind não inicia sozinho", async () => {
  const loopback = await bootExo(helpBind, false);
  const modern = await bootExo(helpModern, false);
  const exposed = await bootExo(helpBind, true);
  const legacy = await bootExo(helpLegacy, true);
  const refused = await bootExo(helpLegacy, false);
  try {
    await loopback.exo.start();
    assert.deepEqual(loopback.calls[0].args, ["--api-port", "52415", "--api-host", "127.0.0.1"]);
    assert.equal(loopback.calls[0].env.EXO_API_HOST, "127.0.0.1");
    assert.equal(loopback.calls[0].env.EXO_LIBP2P_NAMESPACE, networkId);
    assert.equal(loopback.exo.snapshot().lan_exposed, false);
    assert.equal(loopback.exo.snapshot().lan_warning, "");
    assert.deepEqual(loopback.exo.snapshot().connection_addresses, []);
    await loopback.exo.restrictLan();
    assert.equal(loopback.exo.installer.running, true);

    await modern.exo.start();
    assert.ok(modern.calls[0].args.includes("--namespace"));
    assert.equal(modern.calls[0].args.at(-1), networkId);
    assert.equal(modern.calls[0].env.EXO_API_HOST, "127.0.0.1");
    assert.equal(modern.calls[0].env.EXO_LIBP2P_NAMESPACE, undefined);

    await exposed.exo.start();
    assert.equal(exposed.calls[0].env.EXO_API_HOST, "0.0.0.0");
    assert.ok(exposed.calls[0].args.includes("0.0.0.0"));
    assert.equal(exposed.exo.snapshot().lan_exposed, true);
    assert.match(exposed.exo.snapshot().lan_warning, /sem autenticação/);
    assert.doesNotMatch(exposed.exo.snapshot().lan_warning, /não tem --api-host/);
    assert.deepEqual(exposed.exo.snapshot().connection_addresses, exoLanAddresses(true));
    await exposed.exo.restrictLan();
    assert.equal(exposed.exo.installer.running, false);
    assert.equal(exposed.exo.config.expose_lan, false);
    assert.deepEqual(exposed.exo.snapshot().connection_addresses, []);
    assert.equal(exposed.exo.snapshot().lan_warning, "");

    await legacy.exo.start();
    assert.deepEqual(legacy.calls[0].args, ["--api-port", "52415"]);
    assert.equal(legacy.calls[0].env.EXO_API_HOST, undefined);
    assert.equal(legacy.exo.installer.unrestricted, true);
    assert.match(legacy.exo.snapshot().lan_warning, /0\.0\.0\.0/);
    assert.deepEqual(legacy.exo.snapshot().connection_addresses, exoLanAddresses(true));
    await legacy.exo.restrictLan();
    assert.equal(legacy.exo.installer.running, false);

    await assert.rejects(refused.exo.start(), /0\.0\.0\.0/);
    assert.equal(refused.calls.length, 0);
    assert.equal(refused.exo.installer.running, false);
    assert.deepEqual(refused.exo.snapshot().connection_addresses, []);
  } finally {
    await Promise.all([loopback, modern, exposed, legacy, refused].map(async (item) => {
      await item.exo.close();
      rmSync(item.dir, { recursive: true, force: true });
    }));
  }
});
