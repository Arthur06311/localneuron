import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import {
  LEGACY_VOICE_ID,
  SystemTts,
  TTS_MESSAGES,
  chooseVoice,
  createCommandRunner,
  isWav,
  type SystemVoice,
  type TtsInspection,
  type VoicePreference,
} from "./system-tts.js";

// TODO(sherpa-onnx-2.0.0): a narração voltará ao motor neural quando o
// sherpa-onnx 2.0.0 sair sem eSpeak NG.
// https://github.com/k2-fsa/sherpa-onnx/issues/3731

export class ProMedia {
  private folder: string;
  private running: Promise<{
    id: string;
    file: string;
    bytes: number;
    voice: string;
  }> | null = null;
  private cache: { at: number; inspection: TtsInspection } | null = null;
  constructor(
    directory: string,
    _root: string,
    private tts = new SystemTts(createCommandRunner(), process.platform),
  ) {
    this.folder = join(directory, "pro-media");
    mkdirSync(this.folder, { recursive: true, mode: 0o700 });
  }
  get busy() {
    return Boolean(this.running);
  }
  legacyInstalled() {
    const folder = join(this.folder, "vits-piper-pt_BR-faber-medium");
    return (
      existsSync(join(folder, "pt_BR-faber-medium.onnx")) ||
      existsSync(join(folder, "verified.json"))
    );
  }
  private preferencePath() {
    return join(this.folder, "tts-voice.json");
  }
  private readPref(): VoicePreference {
    try {
      const data = JSON.parse(readFileSync(this.preferencePath(), "utf8"));
      return {
        id: typeof data.id === "string" ? data.id : null,
        legacyId: typeof data.legacyId === "string" ? data.legacyId : null,
      };
    } catch {
      return { id: null, legacyId: null };
    }
  }
  private writePref(next: VoicePreference) {
    if (!next.id && !next.legacyId) return;
    const current = this.readPref();
    if (!next.id && current.id) return;
    if (current.id === next.id && current.legacyId === next.legacyId) return;
    writeFileSync(this.preferencePath(), JSON.stringify(next), {
      mode: 0o600,
    });
  }
  private async inspection(force = false) {
    if (!force && this.cache && Date.now() - this.cache.at < 10000)
      return this.cache.inspection;
    const inspection = await this.tts.inspect();
    this.cache = { at: Date.now(), inspection };
    const choice = chooseVoice(
      inspection.voices,
      this.readPref(),
      this.legacyInstalled(),
    );
    this.writePref({ id: choice.id, legacyId: choice.legacyId });
    return inspection;
  }
  async status() {
    const inspection = await this.inspection();
    const saved = this.readPref();
    const choice = chooseVoice(
      inspection.voices,
      saved,
      this.legacyInstalled(),
    );
    const selected =
      inspection.voices.find((item) => item.id === choice.id) ?? null;
    return {
      voice: {
        id: selected?.id ?? null,
        name: selected?.name ?? "Voz do sistema",
        installed: inspection.ready,
        ready: inspection.ready,
        engine: inspection.engine,
        portuguese: inspection.brazilian,
        voices: inspection.voices,
        message: inspection.message,
        notice: choice.notice,
        legacyId: choice.legacyId,
        source: "system",
      },
      busy: this.busy,
      download: null,
    };
  }
  async install() {
    return this.status();
  }
  async select(id: string) {
    const inspection = await this.inspection(true);
    if (!inspection.brazilian)
      throw Error(inspection.message || TTS_MESSAGES.noBrazilian);
    const resolved = this.resolve(id, inspection.voices);
    if (!resolved) throw Error(inspection.message || "Essa voz não está disponível no sistema.");
    const saved = this.readPref();
    this.writePref({
      id: resolved.id,
      legacyId:
        id === LEGACY_VOICE_ID ? LEGACY_VOICE_ID : saved.legacyId,
    });
    this.cache = null;
    return this.status();
  }
  private resolve(id: string | undefined, voices: SystemVoice[]) {
    if (!id || id === LEGACY_VOICE_ID) {
      const choice = chooseVoice(voices, this.readPref(), this.legacyInstalled());
      return voices.find((item) => item.id === choice.id) ?? null;
    }
    return voices.find((item) => item.id === id) ?? null;
  }
  async speak(text: string, speed = 1, voiceId?: string) {
    if (this.busy) throw Error("Aguarde a narração atual.");
    const inspection = await this.inspection(true);
    const voice = this.resolve(voiceId, inspection.voices);
    if (!inspection.available)
      throw Error(inspection.message || TTS_MESSAGES.failed);
    if (!inspection.brazilian)
      throw Error(inspection.message || TTS_MESSAGES.noBrazilian);
    if (!voice) throw Error("Essa voz não está disponível no sistema.");
    const saved = this.readPref();
    this.writePref({
      id: voice.id,
      legacyId:
        voiceId === LEGACY_VOICE_ID || saved.legacyId === LEGACY_VOICE_ID
          ? LEGACY_VOICE_ID
          : saved.legacyId,
    });
    const id = randomUUID();
    const dir = join(this.folder, "outputs", id);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const textPath = join(dir, "input.txt");
    const wavPath = join(dir, "narration.wav");
    this.running = this.tts
      .synthesize({ text, speed, voice, wavPath, textPath })
      .then(() => {
        rmSync(textPath, { force: true });
        if (!existsSync(wavPath) || !isWav(readFileSync(wavPath)))
          throw Error(TTS_MESSAGES.failed);
        return {
          id,
          file: "/v1/pro/media/audio/" + id,
          bytes: statSync(wavPath).size,
          voice: voice.id,
        };
      })
      .catch((error) => {
        rmSync(dir, { recursive: true, force: true });
        throw error;
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
    this.tts.stop();
  }
  async close() {
    this.stop();
    await Promise.allSettled([this.running].filter(Boolean));
  }
}
