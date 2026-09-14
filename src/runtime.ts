import {ExoRuntime} from './exo.js';
import {modelSupport} from './catalog-access.js';
import {windowsRuntimeReady,windowsRuntimeMessage} from './platform.js';
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { inspectMlx, importMlx } from "./mlx-models.js";
import { ggufSetBytes } from "./gguf-parts.js";
import { CATALOG, type CatalogModel } from "./catalog.js";
import { memoryStatus } from "./model.js";
export type RuntimeModel = {
  type: string;
  key: string;
  display_name: string;
  size_bytes: number;
  format: string;
  path: string;
  loaded_instances: { id: string; config: { context_length: number } }[];
};
export class LocalRuntime {
  readonly exo:ExoRuntime;
  private process: ChildProcess | null = null;
  private catalog:CatalogModel[]=CATALOG;
  private metadata(path:string){return this.catalog.find(m=>m.file===basename(path)&&(!m.id.startsWith("hub-")||dirname(path)===join(this.modelDirectory,"catalog-"+m.id)));}
  setCatalog(models:CatalogModel[]){this.catalog=models;}
  private loaded: RuntimeModel | null = null;
  private context = 0;
  private nativeTools = true;
  private secret = "";
  private endpoint = "";
  private loading = false;
  readonly modelDirectory: string;
  readonly binary: string;
  readonly mlxPython: string;
  private mlxScript: string;
  private keyFile: string;
  constructor(
    directory: string,
    root: string,
    private extraRoots = [join(homedir(), ".lmstudio", "models")],
  ) {
    this.exo=new ExoRuntime(directory);
    this.modelDirectory = join(directory, "models");
    mkdirSync(this.modelDirectory, { recursive: true, mode: 0o700 });
    const manifest = JSON.parse(
      readFileSync(join(root, "runtime", "manifest.json"), "utf8"),
    );
    this.binary =
      process.platform === "win32"
        ? join(
            root,
            "runtime",
            process.platform + "-" + process.arch,
            "llama-server.exe",
          )
        : join(
            root,
            "runtime",
            process.platform + "-" + process.arch,
            "llama-" + manifest.release,
            "llama-server",
          );
    this.keyFile = join(directory, "runtime-key");
    this.mlxPython = join(root, "runtime/mlx-darwin-arm64/python/bin/python3");
    this.mlxScript = join(root, "runtime/mlx_server.py");
  }
  get ggufAvailable() { return existsSync(this.binary); }
  get available() {
    return existsSync(this.binary) || this.mlxAvailable;
  }
  get mlxAvailable() {
    return (
      process.platform === "darwin" &&
      process.arch === "arm64" &&
      existsSync(this.mlxPython)
    );
  }
  owns(key: string) {
    return /^(gguf|mlx|exo):/.test(key);
  }
  async importMlx(folder: string) {
    if (!this.mlxAvailable)
      throw new Error("MLX integrado requer o pacote para Mac Apple Silicon.");
    return importMlx(folder, this.modelDirectory);
  }
  get busy() {
    return this.loading;
  }
  inventory(): RuntimeModel[] {
    const found: RuntimeModel[] = [...this.exo.inventory()];
    const seen = new Set<string>();
    const scan = (directory: string, depth: number) => {
      if (depth > 5 || found.length >= 300) return;
      let entries;
      try {
        entries = readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      if (this.mlxAvailable && entries.some((e) => e.name === "config.json")) {
        try {
          const model = inspectMlx(directory);
          if (!seen.has(model.path)) {
            seen.add(model.path);
            found.push({
              type: "llm",
              key: model.key,
              path: model.path,
              format: "MLX",
              size_bytes: model.size_bytes,
              display_name:
                model.display_name +
                (model.path.startsWith(this.modelDirectory + "/")
                  ? " · LocalNeuron"
                  : " · pasta externa"),
              loaded_instances:
                this.loaded?.key === model.key
                  ? [
                      {
                        id: model.key,
                        config: { context_length: this.context },
                      },
                    ]
                  : [],
            });
          }
        } catch {}
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        if (entry.isSymbolicLink()) continue;
        const file = join(directory, entry.name);
        if (entry.isDirectory() && !entry.name.endsWith(".part")) scan(file, depth + 1);
        else if (
          entry.isFile() &&
          /\.gguf$/i.test(entry.name) &&
          !/^mmproj/i.test(entry.name)
        ) {
          const bytes = ggufSetBytes(directory,entry.name);
          if(bytes===null)continue;
          const path = realpathSync(file);
          if (seen.has(path)) continue;
          seen.add(path);
          const key =
            "gguf:" +
            createHash("sha256").update(path).digest("hex").slice(0, 24);
          found.push({
            type: "llm",
            key,
            display_name:
              (this.metadata(path)?.name ||
                entry.name.replace(/\.gguf$/i, "")) + " · integrado",
            size_bytes: bytes,
            format: "GGUF",
            path,
            loaded_instances:
              this.loaded?.key === key
                ? [{ id: key, config: { context_length: this.context } }]
                : [],
          });
        }
      }
    };
    [this.modelDirectory, ...this.extraRoots].forEach((root) => scan(root, 0));
    return found;
  }
  status() {
    const info = this.loaded
      ? [
          {
            id: this.loaded.key,
            key: this.loaded.key,
            context_length: this.context,
            reasoning_off: true,
          },
        ]
      : [];
    return {
      available: this.available,
      endpoint: this.endpoint,
      api: "integrated",
      models: info.map((i) => i.id),
      model_info: info,
      ...memoryStatus(),
    };
  }
  identity(model: string) {
    if(model.startsWith("exo:"))return {application:"LocalNeuron",inference:"distribuída entre computadores conectados à rede EXO; mensagens são enviadas à rede local",engine:"EXO 1.0 com MLX distribuído; ferramentas executadas neste computador",model:model.slice(4)};
    return {
      application: "LocalNeuron",
      inference: "local neste computador; sem inferência em nuvem",
      engine: model.startsWith("mlx:")
        ? "motor MLX integrado da LocalNeuron, baseado nas bibliotecas MLX e MLX LM da Apple; independente de LM Studio; conexões externas bloqueadas no processo de inferência"
        : model.startsWith("gguf:")
          ? "motor integrado da LocalNeuron, baseado em llama.cpp"
          : "servidor local compatível com OpenAI em 127.0.0.1:8080, integração externa",
      model: this.loaded?.key === model ? this.loaded.display_name : model,
    };
  }
  backend(model: string) {
    if(model.startsWith("exo:"))return this.exo.backend(model);
    if (!this.owns(model)) return undefined;
    if (this.loaded?.key !== model)
      throw new Error("Prepare o modelo no motor integrado antes de usar.");
    return {
      status: async () => this.status(),
      endpoint: this.endpoint,
      headers: { Authorization: "Bearer " + this.secret },
      integrated: true,
      nativeTools: this.nativeTools,
    };
  }
  async load(key: string, context: number) {
    if(key.startsWith("exo:"))return this.exo.load(key,context);
    if(!windowsRuntimeReady())throw new Error(windowsRuntimeMessage);
    if (this.loading) throw new Error("O motor está preparando outra IA.");
    if (!(key.startsWith("mlx:") ? this.mlxAvailable : existsSync(this.binary)))
      throw new Error("Motor integrado indisponível nesta arquitetura.");
    const model = this.inventory().find((m) => m.key === key);
    if (!model) throw new Error("Modelo integrado não encontrado na biblioteca.");
    const definition=model.format==='GGUF'?this.metadata(model.path):undefined;
    if(definition&&modelSupport(definition).status==='unsupported')throw Error(modelSupport(definition).reason);
    const limit = model.format === "GGUF" ? this.metadata(model.path)?.context_limit : undefined;
    if(limit)context=Math.min(context,limit);
    if (this.loaded?.key === key && this.context === context)
      return { instance_id:key, load_config:{context_length:this.context}, status:"loaded" };
    this.loading = true;
    try {
      await this.stopProcess();
      const memory = memoryStatus();
      const estimate =
        model.size_bytes * (model.format === "MLX" ? 1 : 1.25) +
        (model.format === "MLX" ? 512 * 1024 ** 2 : 1024 ** 3) +
        Math.max(0, context - 4096) * 32768;
      const margin = model.format === "MLX" ? 512 * 1024 ** 2 : 1024 ** 3;
      if (
        memory.available_memory_bytes < estimate + margin ||
        (memory.pressure_free_percent !== null &&
          memory.pressure_free_percent < 5)
      )
        throw new Error(
          "Libere a IA anterior ou feche aplicativos para preparar este modelo.",
        );
      this.secret = randomBytes(32).toString("hex");
      writeFileSync(this.keyFile, this.secret, { mode: 0o600 });
      // One owned process, one slot, fixed context. No model downloader, arbitrary URL or shell.
      const args = [
        "--model",
        model.path,
        "--alias",
        key,
        "--host",
        "127.0.0.1",
        "--port",
        "0",
        "--ctx-size",
        String(context),
        "--parallel",
        "1",
        "--flash-attn",
        "on",
        "--gpu-layers",
        "auto",
        "--batch-size",
        "512",
        "--ubatch-size",
        "256",
        "--jinja",
        "--no-webui",
        "--no-slots",
        "--offline",
        "--api-key-file",
        this.keyFile,
        "--log-disable",
      ];
      // Select an ephemeral loopback port before spawning; authenticated health prevents adopting another service.
      const net = await import("node:net");
      const reservation = net.createServer();
      await new Promise<void>((r, j) => {
        reservation.once("error", j);
        reservation.listen(0, "127.0.0.1", r);
      });
      const port = (reservation.address() as import("node:net").AddressInfo)
        .port;
      await new Promise<void>((r) => reservation.close(() => r()));
      args[args.indexOf("--port") + 1] = String(port);
      this.endpoint = "http://127.0.0.1:" + port;
      const env: NodeJS.ProcessEnv = {};
      for (const k of [
        "PATH",
        "HOME",
        "USERPROFILE",
        "SYSTEMROOT",
        "WINDIR",
        "TEMP",
        "TMP",
        "TMPDIR",
        "LANG",
        "LC_ALL",
      ])
        if (process.env[k]) env[k] = process.env[k];
      let failure = "";
      const mlx = model.format === "MLX";
      if (mlx) {
        env.HF_HUB_OFFLINE = "1";
        env.TRANSFORMERS_OFFLINE = "1";
        env.HF_HUB_DISABLE_TELEMETRY = "1";
        env.PYTHONDONTWRITEBYTECODE = "1";
      }
      const command = mlx ? "/usr/bin/sandbox-exec" : this.binary;
      const workerArgs = mlx
        ? [
            "-p",
            "(version 1)(allow default)(deny network-outbound)",
            this.mlxPython,
            "-I",
            "-B",
            this.mlxScript,
            "--model",
            model.path,
            "--alias",
            key,
            "--port",
            String(port),
            "--context",
            String(context),
            "--memory-limit",
            String(Math.floor(estimate)),
            "--key-file",
            this.keyFile,
          ]
        : args;
      const child = spawn(command, workerArgs, {
        cwd: resolve(mlx ? this.mlxScript : this.binary, ".."),
        env,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
        shell: false,
      });
      this.process = child;
      child.stderr?.on("data", (chunk) => {
        failure = (failure + chunk.toString()).slice(-5000);
      });
      child.on("error", (e) => {
        failure = e.message;
      });
      child.on("exit", () => {
        if (this.process === child) {
          this.process = null;
          this.loaded = null;
          this.context = 0;
        }
      });
      const start = Date.now();
      while (Date.now() - start < 150000) {
        if (child.exitCode !== null || child.signalCode || !child.pid)
          throw new Error(
            "O motor não conseguiu abrir este modelo. Confira se a arquitetura do modelo é suportada. " +
              failure.slice(-350),
          );
        try {
          const response = await fetch(this.endpoint + "/health", {
            headers: { Authorization: "Bearer " + this.secret },
            signal: AbortSignal.timeout(800),
            redirect: "error",
          });
          if (response.ok) {
            const properties = await fetch(this.endpoint + "/props", {
              headers: { Authorization: "Bearer " + this.secret },
              signal: AbortSignal.timeout(1000),
              redirect: "error",
            });
            if (!properties.ok)
              throw new Error(
                "Não foi possível autenticar o processo integrado.",
              );
            const props = (await properties.json()) as any;
            const effective =
              props.default_generation_settings?.n_ctx ??
              props.default_generation_settings?.params?.n_ctx;
            if (effective !== context)
              throw new Error("O motor não aplicou o contexto solicitado.");
            const after = memoryStatus();
            if (
              after.available_memory_bytes < 512 * 1024 ** 2 ||
              (after.pressure_free_percent !== null &&
                after.pressure_free_percent < 3)
            )
              throw new Error("O modelo consumiu a margem de memória.");
            this.nativeTools = props.native_tools !== false;
            this.loaded = model;
            this.context = effective;
            return {
              instance_id: key,
              load_config: { context_length: effective },
              status: "loaded",
            };
          }
        } catch (error) {
          if (
            [
              "O motor não aplicou o contexto solicitado.",
              "O modelo consumiu a margem de memória.",
            ].includes((error as Error).message)
          )
            throw error;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("O modelo demorou mais de 150 segundos para carregar.");
    } catch (error) {
      await this.stopProcess();
      throw error;
    } finally {
      this.loading = false;
    }
  }
  async unload(instance: string) {
    if(instance.startsWith("exo:"))return this.exo.unload(instance);
    if (this.loaded?.key !== instance)
      throw new Error("Instância integrada não encontrada.");
    await this.stopProcess();
    return { ok: true };
  }
  private async stopProcess() {
    const child = this.process;
    this.loaded = null;
    this.context = 0;
    if (child && child.exitCode === null && !child.signalCode) {
      const ended = new Promise<void>((r) => child.once("exit", () => r()));
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      await ended;
      clearTimeout(timer);
    }
    this.process = null;
    rmSync(this.keyFile, { force: true });
    this.secret = "";
  }
  async close() {
    await this.exo.close();
    await this.stopProcess();
  }
}
