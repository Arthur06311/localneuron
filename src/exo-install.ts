import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { open, cp, rm, mkdtemp, rename } from "node:fs/promises";
import { join } from "node:path";
import { homedir, release, tmpdir } from "node:os";
import { createHash } from "node:crypto";
const exec = promisify(execFile);
export const EXO_RELEASE = {
  version: "1.0.71",
  bytes: 412972413,
  sha256: "bc81a23ec647a995c5f8237857e749bc3de7ba8ec40f2aab39886c1a04beaac7",
  url: "https://github.com/exo-explore/exo/releases/download/v1.0.71/EXO-1.0.71.dmg",
};
export class ExoInstall {
  readonly home: string;
  readonly directory: string;
  readonly cache: string;
  private child: ChildProcess | null = null;
  private installing: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private phase = "idle";
  private downloaded = 0;
  private error = "";
  private output = "";
  constructor(directory: string) {
    this.directory = join(
      directory,
      "local-engines",
      "exo-" + EXO_RELEASE.version,
    );
    this.home = join(directory, "local-engines", "exo-data");
    this.cache = join(
      directory,
      "local-engines",
      "exo-" + EXO_RELEASE.version + ".dmg",
    );
  }
  get supported() {
    const [a, b] = release().split(".").map(Number);
    return (
      process.platform === "darwin" &&
      process.arch === "arm64" &&
      (a > 25 || (a === 25 && b >= 2))
    );
  }
  get installed() {
    return existsSync(join(this.directory, "exo"));
  }
  get running() {
    return (
      !!this.child && this.child.exitCode === null && !this.child.signalCode
    );
  }
  status() {
    return {
      supported: this.supported,
      installed: this.installed,
      running: this.running,
      phase: this.phase,
      downloaded: this.downloaded,
      total: EXO_RELEASE.bytes,
      version: EXO_RELEASE.version,
      error: this.error,
      diagnostic: this.output.slice(-1800),
    };
  }
  install() {
    if (!this.supported)
      throw Error(
        "O instalador EXO integrado requer Mac Apple Silicon com macOS 26.2 ou superior. Em Linux, conecte um EXO instalado pelo projeto oficial.",
      );
    if (this.installed || this.installing) return this.status();
    this.controller = new AbortController();
    this.phase = "downloading";
    this.error = "";
    this.installing = this.perform(this.controller.signal)
      .catch((e) => {
        this.phase = "error";
        this.error =
          e?.name === "AbortError"
            ? "Instalação cancelada."
            : String(e.message).slice(0, 500);
      })
      .finally(() => {
        this.installing = null;
        this.controller = null;
      });
    return this.status();
  }
  private async perform(signal: AbortSignal) {
    mkdirSync(join(this.directory, ".."), { recursive: true, mode: 0o700 });
    if (
      !existsSync(this.cache) ||
      statSync(this.cache).size !== EXO_RELEASE.bytes
    ) {
      const response = await fetch(EXO_RELEASE.url, {
        signal,
        redirect: "follow",
      });
      const dest = new URL(response.url);
      if (
        !response.ok ||
        !response.body ||
        ![
          "github.com",
          "release-assets.githubusercontent.com",
          "objects.githubusercontent.com",
        ].includes(dest.hostname)
      )
        throw Error("O download oficial do EXO não respondeu.");
      const handle = await open(this.cache + ".part", "w", 0o600);
      this.downloaded = 0;
      try {
        for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
          signal.throwIfAborted();
          this.downloaded += chunk.byteLength;
          if (this.downloaded > EXO_RELEASE.bytes)
            throw Error("Pacote EXO com tamanho inesperado.");
          let written = 0;
          while (written < chunk.byteLength)
            written += (await handle.write(chunk.subarray(written)))
              .bytesWritten;
        }
      } finally {
        await handle.close();
      }
      if (this.downloaded !== EXO_RELEASE.bytes)
        throw Error("Download EXO incompleto.");
      await rename(this.cache + ".part", this.cache);
    }
    this.downloaded = EXO_RELEASE.bytes;
    this.phase = "verifying";
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(this.cache)) {
      signal.throwIfAborted();
      hash.update(chunk);
    }
    if (hash.digest("hex") !== EXO_RELEASE.sha256) {
      await rm(this.cache, { force: true });
      throw Error("A assinatura SHA-256 do pacote EXO não confere.");
    }
    const mount = await mkdtemp(join(tmpdir(), "localneuron-exo-"));
    let mounted = false;
    const staging = this.directory + ".installing";
    try {
      this.phase = "installing";
      signal.throwIfAborted();
      await exec(
        "/usr/bin/hdiutil",
        ["attach", this.cache, "-readonly", "-nobrowse", "-mountpoint", mount],
        { timeout: 60000, maxBuffer: 1024 ** 2 },
      );
      mounted = true;
      signal.throwIfAborted();
      const source = join(mount, "EXO.app", "Contents", "Resources", "exo");
      if (!existsSync(join(source, "exo")))
        throw Error("O pacote EXO não contém o motor esperado.");
      await rm(staging, { recursive: true, force: true });
      await cp(source, staging, {
        recursive: true,
        dereference: false,
        verbatimSymlinks: true,
      });
      signal.throwIfAborted();
      writeFileSync(
        join(staging, "localneuron-release.json"),
        JSON.stringify(EXO_RELEASE),
        { mode: 0o600 },
      );
      await rename(staging, this.directory);
      this.phase = "installed";
    } finally {
      if (mounted)
        await exec("/usr/bin/hdiutil", ["detach", mount], { timeout: 30000 })
          .then(() => {
            mounted = false;
          })
          .catch(() => {});
      if (!mounted) await rm(mount, { recursive: true, force: true });
      await rm(staging, { recursive: true, force: true });
    }
  }
  async cancel() {
    this.controller?.abort();
    await this.installing;
    return this.status();
  }
  async start(network: string, offline: boolean) {
    if (!this.supported || !this.installed)
      throw Error("Instale o motor EXO antes de iniciar este nó.");
    if (this.running) return;
    mkdirSync(join(this.home, "models"), { recursive: true, mode: 0o700 });
    const env = {
      HOME: homedir(),
      TMPDIR: tmpdir(),
      LANG: "en_US.UTF-8",
      PATH: [
        this.directory,
        join(this.directory, "_internal"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ].join(":"),
      EXO_RUNTIME_DIR: this.directory,
      EXO_HOME: this.home,
      EXO_DEFAULT_MODELS_DIR: join(this.home, "models"),
      EXO_LIBP2P_NAMESPACE: network,
      EXO_OFFLINE: String(offline),
      EXO_ENABLE_IMAGE_MODELS: "false",
      EXO_TRACING_ENABLED: "false",
    };
    this.output = "";
    this.error = "";
    const child = spawn(join(this.directory, "exo"), ["--api-port", "52415"], {
      cwd: this.home,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child = child;
    const log = (b: Buffer) => {
      this.output = (this.output + b.toString()).slice(-8000);
    };
    child.stdout?.on("data", log);
    child.stderr?.on("data", log);
    child.on("error", (e) => {
      this.error = e.message;
      this.phase = "error";
    });
    child.on("exit", (code) => {
      if (this.child === child) {
        this.child = null;
        if (code) {
          this.error =
            "O EXO encerrou com código " + code + ". Confira o diagnóstico.";
          this.phase = "error";
        }
      }
    });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    this.phase = "running";
  }
  async stop() {
    const child = this.child;
    if (!child?.pid) return;
    const exited = new Promise<void>((r) => child.once("exit", () => r()));
    const kill = (signal: NodeJS.Signals) => {
      try {
        process.kill(-child.pid!, signal);
      } catch {}
    };
    kill("SIGTERM");
    const timer = setTimeout(() => kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timer);
    this.child = null;
    this.phase = this.installed ? "installed" : "idle";
  }
  async close() {
    await this.cancel();
    await this.stop();
  }
}
