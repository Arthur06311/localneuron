import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, delimiter, resolve, relative, isAbsolute } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { x as extract } from "tar";
const require = createRequire(import.meta.url);
export const VOICE = {
  id: "faber-pt-br",
  name: "Faber · Português brasileiro",
  license: "CC0 (dataset da voz); componentes eSpeak NG GPL-3.0",
  source:
    "https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD",
  bytes: 67183065,
  sha256: "7add3f923ad6bc25ca8a192805fd1a64d1b3893e4611c4a9719545a825039a83",
  url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-pt_BR-faber-medium.tar.bz2",
};
export class ProMedia {
  private folder: string;
  private child: ChildProcess | null = null;
  private running: Promise<any> | null = null;
  private downloading: Promise<void> | null = null;
  private controller: AbortController | null = null;
  download: any = null;
  constructor(
    directory: string,
    private root: string,
  ) {
    this.folder = join(directory, "pro-media");
    mkdirSync(this.folder, { recursive: true, mode: 0o700 });
  }
  get busy() {
    return Boolean(this.child);
  }
  voiceFolder() {
    return join(this.folder, "vits-piper-pt_BR-faber-medium");
  }
  installed() {
    return (
      existsSync(join(this.voiceFolder(), "verified.json")) &&
      existsSync(join(this.voiceFolder(), "pt_BR-faber-medium.onnx"))
    );
  }
  status() {
    return {
      voice: { ...VOICE, installed: this.installed() },
      busy: this.busy,
      download: this.download,
    };
  }
  async install() {
    if (this.installed()) return this.status();
    if (this.downloading) return this.status();
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.download = { state: "downloading", bytes: 0, total: VOICE.bytes };
    const stage = join(this.folder, "stage-" + randomUUID());
    mkdirSync(stage, { mode: 0o700 });
    this.downloading = (async () => {
      try {
        const r = await fetch(VOICE.url, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
        });
        if (!r.ok || !r.body) throw Error("Não foi possível baixar a voz.");
        const chunks: Uint8Array[] = [];
        let total = 0;
        const hash = createHash("sha256");
        for await (const chunk of r.body as any) {
          signal.throwIfAborted();
          total += chunk.length;
          if (total > VOICE.bytes)
            throw Error("Download excedeu o tamanho esperado.");
          chunks.push(chunk);
          hash.update(chunk);
          this.download.bytes = total;
        }
        if (total !== VOICE.bytes || hash.digest("hex") !== VOICE.sha256)
          throw Error("Hash da voz divergente.");
        this.download.state = "extracting";
        const decoded: Buffer = require("seek-bzip").decode(
          Buffer.concat(chunks),
        );
        const tar = join(stage, "voice.tar");
        writeFileSync(tar, decoded, { mode: 0o600 });
        await extract({
          file: tar,
          cwd: stage,
          strict: true,
          filter: (path, entry) => {
            if (
              !path.startsWith("vits-piper-pt_BR-faber-medium/") ||
              relative(stage, resolve(stage, path)).startsWith("..") ||
              isAbsolute(relative(stage, resolve(stage, path)))
            )
              throw Error("Caminho inválido no pacote de voz.");
            return ["File", "Directory"].includes((entry as any).type);
          },
        });
        signal.throwIfAborted();
        writeFileSync(
          join(stage, "vits-piper-pt_BR-faber-medium", "verified.json"),
          JSON.stringify(VOICE),
          { mode: 0o600 },
        );
        if (existsSync(this.voiceFolder()))
          throw Error("Pasta de voz já existe; confira a instalação anterior.");
        renameSync(
          join(stage, "vits-piper-pt_BR-faber-medium"),
          this.voiceFolder(),
        );
        this.download.state = "installed";
      } catch (e) {
        this.download.state = signal.aborted ? "cancelled" : "failed";
        this.download.error = (e as Error).message;
      } finally {
        rmSync(stage, { recursive: true, force: true });
        this.downloading = null;
        this.controller = null;
      }
    })();
    return this.status();
  }
  async speak(text: string, speed = 1) {
    if (!this.installed()) throw Error("Instale a voz Faber antes de narrar.");
    if (this.busy) throw Error("Aguarde a narração atual.");
    const id = randomUUID(),
      dir = join(this.folder, "outputs", id);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const input = join(dir, "input.json"),
      out = join(dir, "narration.wav");
    writeFileSync(input, JSON.stringify({ text, speed }), { mode: 0o600 });
    const native = join(
      this.root,
      "node_modules",
      "sherpa-onnx-" +
        (process.platform === "win32" ? "win" : process.platform) +
        "-" +
        process.arch,
    );
    const executable = join(
      this.root,
      "runtime",
      "voice-node-" + process.platform + "-" + process.arch,
      process.platform === "win32" ? "node.exe" : "node",
    );
    if (!existsSync(executable)) {
      rmSync(input, { force: true });
      throw Error(
        "Runtime de voz ausente. Reinstale o pacote completo do LocalNeuron.",
      );
    }
    this.running = new Promise((resolveTask, reject) => {
      const child = spawn(
        executable,
        [
          join(this.root, "dist/src/tts-worker.js"),
          this.voiceFolder(),
          input,
          out,
        ],
        {
          cwd: this.root,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            DYLD_LIBRARY_PATH: native,
            LD_LIBRARY_PATH: native,
            PATH: native + delimiter + (process.env.PATH || ""),
          },
          stdio: ["ignore", "ignore", "pipe"],
          windowsHide: true,
          shell: false,
        },
      );
      this.child = child;
      let failure = "";
      child.stderr?.on("data", (v) => (failure = (failure + v).slice(-1000)));
      const timer = setTimeout(() => this.stop(), 180000);
      const end = () => {
        clearTimeout(timer);
        this.child = null;
        rmSync(input, { force: true });
      };
      child.once("error", () => {
        end();
        reject(Error("Não foi possível iniciar a voz nesta plataforma."));
      });
      child.once("exit", (code) => {
        end();
        if (code === 0 && existsSync(out)) {
          const result = {
            id,
            file: "/v1/pro/media/audio/" + id,
            bytes: statSync(out).size,
            voice: VOICE.id,
          };
          resolveTask(result);
        } else
          reject(
            Error("A narração foi interrompida ou o motor de voz falhou."),
          );
      });
    });
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }
  audio(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Áudio inválido.");
    return readFileSync(join(this.folder, "outputs", id, "narration.wav"));
  }
  stop() {
    const child = this.child;
    child?.kill("SIGTERM");
    if (child)
      setTimeout(() => {
        if (this.child === child) child.kill("SIGKILL");
      }, 2000).unref();
  }
  async close() {
    this.controller?.abort();
    this.stop();
    await Promise.allSettled([this.running, this.downloading].filter(Boolean));
  }
}
