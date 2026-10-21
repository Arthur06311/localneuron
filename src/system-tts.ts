import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

// TODO(sherpa-onnx-2.0.0): voltar à voz neural quando o sherpa-onnx 2.0.0
// publicar um build sem eSpeak NG. Acompanhar
// https://github.com/k2-fsa/sherpa-onnx/issues/3731
// Até lá a narração usa só a voz do sistema (say, SAPI ou spd-say).

export const LEGACY_VOICE_ID = "faber-pt-br";

export const TTS_MESSAGES = {
  linuxMissing:
    "A narração está desativada neste Linux. Instale o speech-dispatcher (comando spd-say) para usar a voz do sistema. O LocalNeuron não embute um motor de voz.",
  linuxNoRecorder:
    "O speech-dispatcher está instalado, mas este sistema não tem como gravar a narração em arquivo. Instale o PulseAudio (parecord e pactl) ou o PipeWire (pw-record e pactl).",
  noBrazilian:
    "Não há voz em português brasileiro neste sistema. Instale uma voz pt-BR nas configurações de fala do sistema para narrar.",
  europeanOnly:
    "Não há voz em português brasileiro neste sistema. A voz em português encontrada é de Portugal. Instale uma voz pt-BR para narrar.",
  macMissing:
    "A narração está desativada neste Mac porque o comando say não está disponível.",
  windowsMissing:
    "A narração está desativada neste Windows porque o PowerShell ou a síntese SAPI não está disponível.",
  unsupported:
    "A narração por voz do sistema não está disponível nesta plataforma.",
  listFailed: "Não foi possível consultar as vozes do sistema.",
  failed: "A narração foi interrompida ou a voz do sistema falhou.",
} as const;

export type SystemVoice = {
  id: string;
  name: string;
  language: string;
  brazilian: boolean;
};

export type TtsEngine =
  | "macos-say"
  | "windows-sapi"
  | "linux-speech-dispatcher"
  | "unavailable";

export type TtsInspection = {
  engine: TtsEngine;
  available: boolean;
  brazilian: boolean;
  ready: boolean;
  voices: SystemVoice[];
  message: string | null;
};

export type VoicePreference = { id: string | null; legacyId: string | null };

export type VoiceChoice = VoicePreference & {
  notice: string | null;
};

type ExecResult = { code: number | null; stdout: string; stderr: string };

export type ActiveProcess = {
  stop: () => void;
  exited: Promise<number | null>;
};

export interface CommandRunner {
  which: (name: string) => boolean;
  exec: (
    command: string,
    args: string[],
    opts?: { env?: NodeJS.ProcessEnv; timeoutMs?: number },
  ) => Promise<ExecResult>;
  spawn: (
    command: string,
    args: string[],
    opts?: { env?: NodeJS.ProcessEnv },
  ) => ActiveProcess;
  stop: () => void;
}

const WINDOWS_LIST_SCRIPT = `
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
foreach ($voice in $synth.GetInstalledVoices()) {
  if ($voice.Enabled) {
    Write-Output ($voice.VoiceInfo.Name + [char]9 + $voice.VoiceInfo.Culture.Name)
  }
}
$synth.Dispose()
`.trim();

const WINDOWS_SPEAK_SCRIPT = `
param(
  [Parameter(Mandatory = $true)][string]$TextPath,
  [Parameter(Mandatory = $true)][string]$WavPath,
  [Parameter(Mandatory = $true)][string]$Voice,
  [Parameter(Mandatory = $true)][int]$Rate
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SetOutputToWaveFile($WavPath)
  $synth.SelectVoice($Voice)
  $bounded = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $synth.Rate = $bounded
  $text = [IO.File]::ReadAllText($TextPath, [Text.UTF8Encoding]::new($false))
  $synth.Speak($text)
} finally {
  $synth.Dispose()
}
`.trim();

export function commandExists(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
) {
  const dirs = (env.PATH || "").split(delimiter).filter(Boolean);
  const exts =
    platform === "win32"
      ? (env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];
  return dirs.some((dir) =>
    exts.some((ext) => {
      const file = name.toLowerCase().endsWith(ext.toLowerCase())
        ? name
        : name + ext;
      return existsSync(join(dir, file));
    }),
  );
}

export function createCommandRunner(
  platform: NodeJS.Platform = process.platform,
): CommandRunner {
  let current: ChildProcess | null = null;
  const track = (child: ChildProcess) => {
    current = child;
    const clear = () => {
      if (current === child) current = null;
    };
    child.once("exit", clear);
    child.once("error", clear);
    return child;
  };
  return {
    which: (name) => commandExists(name, process.env, platform),
    stop: () => {
      current?.kill("SIGINT");
      const child = current;
      if (child)
        setTimeout(() => {
          if (current === child) child.kill("SIGKILL");
        }, 2000).unref();
    },
    exec: (command, args, opts) =>
      new Promise((resolve, reject) => {
        let child: ChildProcess;
        try {
          child = track(
            spawn(command, args, {
              shell: false,
              windowsHide: true,
              env: opts?.env ?? process.env,
              stdio: ["ignore", "pipe", "pipe"],
            }),
          );
        } catch (error) {
          reject(error);
          return;
        }
        let stdout = "";
        let stderr = "";
        child.stdout?.on(
          "data",
          (chunk) => (stdout = (stdout + chunk).slice(-20000)),
        );
        child.stderr?.on(
          "data",
          (chunk) => (stderr = (stderr + chunk).slice(-4000)),
        );
        const timer = setTimeout(
          () => child.kill("SIGKILL"),
          opts?.timeoutMs ?? 20000,
        );
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          resolve({ code, stdout, stderr });
        });
      }),
    spawn: (command, args, opts) => {
      const child = track(
        spawn(command, args, {
          shell: false,
          windowsHide: true,
          env: opts?.env ?? process.env,
          stdio: ["ignore", "ignore", "pipe"],
        }),
      );
      const exited = new Promise<number | null>((resolve) => {
        child.once("error", () => resolve(null));
        child.once("exit", (code) => resolve(code));
      });
      return {
        exited,
        stop: () => {
          child.kill("SIGINT");
          setTimeout(() => child.kill("SIGKILL"), 2000).unref();
        },
      };
    },
  };
}

export function macosRate(speed: number) {
  return Math.min(450, Math.max(80, Math.round(175 * speed)));
}

export function windowsRate(speed: number) {
  return Math.min(10, Math.max(-10, Math.round((speed - 1) * 10)));
}

export function linuxRate(speed: number) {
  return Math.min(100, Math.max(-100, Math.round((speed - 1) * 100)));
}

export function narrationText(text: string) {
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean || clean.length > 4000) throw Error("Texto de narração inválido.");
  return clean;
}

export function assertVoiceId(id: string) {
  if (!/^[\p{L}\p{N} ._()+\-]{1,120}$/u.test(id)) throw Error("Voz inválida.");
}

function languageCode(language: string) {
  return language.toLowerCase().replace(/_/g, "-");
}

function speechLanguage(language: string) {
  const lang = language.replace(/_/g, "-");
  if (/^pt$/i.test(lang)) return "pt";
  if (/^pt-br$/i.test(lang)) return "pt-BR";
  if (/^pt-/i.test(lang)) return lang;
  return "pt-BR";
}

export function isBrazilianVoice(language: string, name: string) {
  const lang = languageCode(language);
  if (lang.startsWith("pt-pt")) return false;
  if (/(portugal|portugu[eê]s europeu)/i.test(name)) return false;
  if (lang.startsWith("pt-br")) return true;
  if (/(brasil|brazil)/i.test(name)) return true;
  return lang === "pt";
}

export function isEuropeanPortuguese(language: string, name: string) {
  const lang = languageCode(language);
  return (
    lang.startsWith("pt-pt") || /(portugal|portugu[eê]s europeu)/i.test(name)
  );
}

function voice(id: string, language: string, name = id): SystemVoice {
  return { id, name, language, brazilian: isBrazilianVoice(language, name) };
}

export function parseMacVoices(stdout: string) {
  const voices: SystemVoice[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^(.+?)\s{2,}([A-Za-z]{2}(?:[_-][A-Za-z0-9]+)?)\s+#/.exec(
      line,
    );
    if (!match) continue;
    const name = match[1].trim();
    if (name) voices.push(voice(name, match[2], name));
  }
  return voices;
}

export function parseWindowsVoices(stdout: string) {
  const voices: SystemVoice[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const [name, language] = line.split("\t").map((part) => part.trim());
    if (!name || !language || !/^[a-z]{2}(?:[-_][A-Za-z0-9]+)?$/i.test(language))
      continue;
    voices.push(voice(name, language, name));
  }
  return voices;
}

export function parseDispatcherVoices(stdout: string) {
  const voices: SystemVoice[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^name\b/i.test(line)) continue;
    const cols = (
      line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/)
    )
      .map((part) => part.trim())
      .filter(Boolean);
    const langIndex = cols.findIndex((col) =>
      /^(?:pt|en|es|fr|de|it|pl|ru|zh|ja|ko|nl|sv|da|fi|ar|el|hu|cs|ro|tr|uk)(?:[-_][A-Za-z0-9]+)?$/i.test(
        col,
      ),
    );
    if (langIndex < 0 || cols.length < 2) continue;
    const language = cols[langIndex];
    const id = cols[langIndex === 0 ? 1 : 0];
    if (id) voices.push(voice(id, language, id));
  }
  return voices;
}

export function bestBrazilian(voices: SystemVoice[]) {
  const ranked = voices.filter((item) => item.brazilian);
  ranked.sort((a, b) => score(b) - score(a));
  return ranked[0] ?? null;
}

function score(item: SystemVoice) {
  const lang = languageCode(item.language);
  if (lang.startsWith("pt-br")) return 3;
  if (/(brasil|brazil)/i.test(item.name)) return 2;
  if (lang === "pt") return 1;
  return 0;
}

export function chooseVoice(
  voices: SystemVoice[],
  saved: VoicePreference,
  legacyInstalled: boolean,
): VoiceChoice {
  const brazilian = bestBrazilian(voices);
  const legacy =
    saved.legacyId === LEGACY_VOICE_ID ||
    saved.id === LEGACY_VOICE_ID ||
    legacyInstalled;
  const legacyId = legacy ? LEGACY_VOICE_ID : saved.legacyId;
  const match = saved.id
    ? voices.find((item) => item.id === saved.id)
    : undefined;
  if (match && saved.id !== LEGACY_VOICE_ID) {
    return {
      id: match.id,
      legacyId,
      notice: legacy
        ? `A narração usa a voz do sistema «${match.name}» no lugar da voz Faber que estava instalada.`
        : null,
    };
  }
  if (saved.id && saved.id !== LEGACY_VOICE_ID && brazilian) {
    return {
      id: brazilian.id,
      legacyId,
      notice: `A voz “${saved.id}” não está neste sistema. A narração passou a usar “${brazilian.name}”.`,
    };
  }
  if (brazilian) {
    return {
      id: brazilian.id,
      legacyId,
      notice: legacy
        ? `A narração usa a voz do sistema «${brazilian.name}» no lugar da voz Faber que estava instalada.`
        : null,
    };
  }
  return { id: null, legacyId, notice: null };
}

export function isWav(buffer: Buffer) {
  return (
    buffer.length > 44 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  );
}

function empty(engine: TtsEngine, message: string): TtsInspection {
  return {
    engine,
    available: false,
    brazilian: false,
    ready: false,
    voices: [],
    message,
  };
}

function finish(
  engine: TtsEngine,
  available: boolean,
  voices: SystemVoice[],
  blocked: string | null = null,
): TtsInspection {
  const brazilian = voices.some((item) => item.brazilian);
  const european = voices.some((item) =>
    isEuropeanPortuguese(item.language, item.name),
  );
  const message =
    blocked ??
    (available && !brazilian
      ? european
        ? TTS_MESSAGES.europeanOnly
        : TTS_MESSAGES.noBrazilian
      : null);
  return {
    engine,
    available,
    brazilian,
    ready: available && brazilian,
    voices,
    message,
  };
}

export class SystemTts {
  constructor(
    private runner: CommandRunner,
    private platform: NodeJS.Platform,
    private settleMs = 300,
  ) {}

  stop() {
    this.runner.stop();
  }

  async inspect(): Promise<TtsInspection> {
    if (this.platform === "darwin") return this.inspectMac();
    if (this.platform === "win32") return this.inspectWindows();
    if (this.platform === "linux") return this.inspectLinux();
    return empty("unavailable", TTS_MESSAGES.unsupported);
  }

  async synthesize(input: {
    text: string;
    speed: number;
    voice: SystemVoice;
    wavPath: string;
    textPath: string;
  }) {
    assertVoiceId(input.voice.id);
    const text = narrationText(input.text);
    writeFileSync(input.textPath, text, { mode: 0o600 });
    if (this.platform === "darwin") await this.speakMac(input);
    else if (this.platform === "win32") await this.speakWindows(input);
    else if (this.platform === "linux") await this.speakLinux(input);
    else throw Error(TTS_MESSAGES.unsupported);
    if (!existsSync(input.wavPath) || !isWav(readFileSync(input.wavPath)))
      throw Error(TTS_MESSAGES.failed);
  }

  private async inspectMac() {
    if (!this.runner.which("say"))
      return empty("macos-say", TTS_MESSAGES.macMissing);
    const listed = await this.runner.exec("say", ["-v", "?"], {
      timeoutMs: 15000,
    });
    if (listed.code !== 0) return empty("macos-say", TTS_MESSAGES.listFailed);
    return finish("macos-say", true, parseMacVoices(listed.stdout));
  }

  private async inspectWindows() {
    const exe = this.powershell();
    if (!exe) return empty("windows-sapi", TTS_MESSAGES.windowsMissing);
    const listed = await this.runner.exec(
      exe,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_LIST_SCRIPT,
      ],
      { timeoutMs: 20000 },
    );
    if (listed.code !== 0)
      return empty("windows-sapi", TTS_MESSAGES.listFailed);
    return finish("windows-sapi", true, parseWindowsVoices(listed.stdout));
  }

  private async inspectLinux() {
    if (!this.runner.which("spd-say"))
      return empty("unavailable", TTS_MESSAGES.linuxMissing);
    const recorder = this.runner.which("parecord")
      ? "parecord"
      : this.runner.which("pw-record")
        ? "pw-record"
        : null;
    const available = Boolean(recorder && this.runner.which("pactl"));
    const listed = await this.runner.exec(
      "spd-say",
      ["--list-synthesis-voices"],
      { timeoutMs: 15000 },
    );
    let voices =
      listed.code === 0 ? parseDispatcherVoices(listed.stdout) : [];
    if (!voices.length) {
      const fallback = await this.runner.exec("spd-say", ["-L"], {
        timeoutMs: 15000,
      });
      if (fallback.code === 0)
        voices = parseDispatcherVoices(fallback.stdout);
    }
    return finish(
      "linux-speech-dispatcher",
      available,
      voices,
      available ? null : TTS_MESSAGES.linuxNoRecorder,
    );
  }

  private async speakMac(input: {
    speed: number;
    voice: SystemVoice;
    wavPath: string;
    textPath: string;
  }) {
    const rate = String(macosRate(input.speed));
    const wave = await this.runner.exec(
      "say",
      [
        "-v",
        input.voice.id,
        "-r",
        rate,
        "-f",
        input.textPath,
        "-o",
        input.wavPath,
        "--file-format=WAVE",
        "--data-format=LEI16@22050",
      ],
      { timeoutMs: 180000 },
    );
    if (wave.code === 0 && existsSync(input.wavPath) && isWav(readFileSync(input.wavPath)))
      return;
    const aiff = input.wavPath + ".aiff";
    const spoken = await this.runner.exec(
      "say",
      ["-v", input.voice.id, "-r", rate, "-f", input.textPath, "-o", aiff],
      { timeoutMs: 180000 },
    );
    if (spoken.code !== 0) throw Error(TTS_MESSAGES.failed);
    const converted = await this.runner.exec(
      "afconvert",
      ["-f", "WAVE", "-d", "LEI16@22050", aiff, input.wavPath],
      { timeoutMs: 30000 },
    );
    rmSync(aiff, { force: true });
    if (converted.code !== 0) throw Error(TTS_MESSAGES.failed);
  }

  private async speakWindows(input: {
    speed: number;
    voice: SystemVoice;
    wavPath: string;
    textPath: string;
  }) {
    const exe = this.powershell();
    if (!exe) throw Error(TTS_MESSAGES.windowsMissing);
    const script = join(dirname(input.wavPath), "speak.ps1");
    writeFileSync(script, WINDOWS_SPEAK_SCRIPT, { mode: 0o600 });
    try {
      const spoken = await this.runner.exec(
        exe,
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          script,
          "-TextPath",
          input.textPath,
          "-WavPath",
          input.wavPath,
          "-Voice",
          input.voice.id,
          "-Rate",
          String(windowsRate(input.speed)),
        ],
        { timeoutMs: 180000 },
      );
      if (spoken.code !== 0) throw Error(TTS_MESSAGES.failed);
    } finally {
      rmSync(script, { force: true });
    }
  }

  private async speakLinux(input: {
    text: string;
    speed: number;
    voice: SystemVoice;
    wavPath: string;
  }) {
    const recorder = this.runner.which("parecord")
      ? "parecord"
      : this.runner.which("pw-record")
        ? "pw-record"
        : null;
    if (!recorder || !this.runner.which("pactl"))
      throw Error(TTS_MESSAGES.linuxNoRecorder);
    const sink = "lntts";
    const loaded = await this.runner.exec(
      "pactl",
      [
        "load-module",
        "module-null-sink",
        `sink_name=${sink}`,
        "sink_properties=device.description=LocalNeuron",
      ],
      { timeoutMs: 15000 },
    );
    const moduleId = loaded.stdout.trim().split(/\s+/).pop() || "";
    if (loaded.code !== 0 || !/^\d+$/.test(moduleId))
      throw Error(TTS_MESSAGES.linuxNoRecorder);
    const args =
      recorder === "parecord"
        ? [
            `--device=${sink}.monitor`,
            "--file-format=wav",
            "--rate=22050",
            "--channels=1",
            "--format=s16le",
            input.wavPath,
          ]
        : [
            "--target",
            `${sink}.monitor`,
            "--rate",
            "22050",
            "--channels",
            "1",
            input.wavPath,
          ];
    const capture = this.runner.spawn(recorder, args, {
      env: { ...process.env, PULSE_SINK: sink },
    });
    try {
      await delay(this.settleMs);
      const spoken = await this.runner.exec(
        "spd-say",
        [
          "-w",
          "-l",
          speechLanguage(input.voice.language),
          "-y",
          input.voice.id,
          "-r",
          String(linuxRate(input.speed)),
          "--",
          narrationText(input.text),
        ],
        { env: { ...process.env, PULSE_SINK: sink }, timeoutMs: 180000 },
      );
      await delay(this.settleMs);
      if (spoken.code !== 0) throw Error(TTS_MESSAGES.failed);
    } finally {
      capture.stop();
      await capture.exited;
      await this.runner.exec("pactl", ["unload-module", moduleId], {
        timeoutMs: 15000,
      });
    }
  }

  private powershell() {
    if (this.runner.which("powershell.exe")) return "powershell.exe";
    if (this.runner.which("powershell")) return "powershell";
    return null;
  }
}

function delay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
