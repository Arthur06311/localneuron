import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProMedia } from "../src/pro-media.js";
import {
  LEGACY_VOICE_ID,
  SystemTts,
  TTS_MESSAGES,
  assertVoiceId,
  bestBrazilian,
  chooseVoice,
  linuxRate,
  macosRate,
  parseDispatcherVoices,
  parseMacVoices,
  parseWindowsVoices,
  windowsRate,
  type ActiveProcess,
  type CommandRunner,
  type SystemVoice,
} from "../src/system-tts.js";

const MAC = [
  "Luciana             pt_BR    # Olá, o meu nome é Luciana.",
  "Joana               pt_PT    # Olá de Portugal.",
  "Alex                en_US    # Hello.",
].join("\n");

function wav() {
  const buffer = Buffer.alloc(46);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(38, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24);
  buffer.writeUInt32LE(44100, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(2, 40);
  return buffer;
}

function runner(
  bins: Record<string, boolean>,
  exec: (
    command: string,
    args: string[],
  ) => { code: number | null; stdout: string; stderr: string },
) {
  const calls: { command: string; args: string[]; spawn?: boolean }[] = [];
  const fake: CommandRunner & { calls: typeof calls } = {
    calls,
    which: (name) => Boolean(bins[name]),
    stop: () => undefined,
    exec: async (command, args) => {
      calls.push({ command, args });
      return exec(command, args);
    },
    spawn: (command, args): ActiveProcess => {
      calls.push({ command, args, spawn: true });
      let finish = (_code: number | null) => {
        void _code;
      };
      const exited = new Promise<number | null>((resolve) => {
        finish = resolve;
      });
      return {
        exited,
        stop: () => {
          const output = args.find(
            (arg) => arg.endsWith(".wav") || arg.includes(".wav"),
          );
          if (output) writeFileSync(output, wav());
          finish(0);
        },
      };
    },
  };
  return fake;
}

function macRunner() {
  return runner({ say: true, afconvert: true }, (command, args) => {
    if (command === "say" && args[1] === "?")
      return { code: 0, stdout: MAC, stderr: "" };
    if (command === "say") {
      const output = args[args.indexOf("-o") + 1];
      if (output) writeFileSync(output, wav());
      return { code: 0, stdout: "", stderr: "" };
    }
    return { code: 1, stdout: "", stderr: "inesperado" };
  });
}

test("listas do sistema reconhecem pt-BR e separam pt-PT", () => {
  const mac = parseMacVoices(MAC);
  assert.deepEqual(
    mac.map((item) => [item.id, item.brazilian]),
    [
      ["Luciana", true],
      ["Joana", false],
      ["Alex", false],
    ],
  );
  const windows = parseWindowsVoices(
    "Microsoft Maria Desktop\tpt-BR\nMicrosoft Helia\tpt-PT\n",
  );
  assert.equal(bestBrazilian(windows)?.id, "Microsoft Maria Desktop");
  const linux = parseDispatcherVoices(
    "NAME\tLANGUAGE\nfemale1\tpt-BR\ndefault\nmale1\ten-US\n",
  );
  assert.equal(linux.find((item) => item.brazilian)?.id, "female1");
  assert.equal(parseDispatcherVoices("pt-BR\tfemale1\n")[0].id, "female1");
});

test("preferência Faber e voz ausente migram para a voz pt-BR do sistema", () => {
  const voices: SystemVoice[] = parseMacVoices(MAC);
  const migrated = chooseVoice(
    voices,
    { id: LEGACY_VOICE_ID, legacyId: null },
    true,
  );
  assert.equal(migrated.id, "Luciana");
  assert.equal(migrated.legacyId, LEGACY_VOICE_ID);
  assert.match(migrated.notice || "", /Faber/);
  const kept = chooseVoice(voices, { id: "Alex", legacyId: null }, false);
  assert.equal(kept.id, "Alex");
  assert.equal(kept.notice, null);
  const missing = chooseVoice(voices, { id: "Sumiu", legacyId: null }, false);
  assert.equal(missing.id, "Luciana");
  assert.match(missing.notice || "", /Sumiu/);
  assert.equal(
    chooseVoice(
      voices.filter((item) => item.id === "Joana"),
      { id: null, legacyId: null },
      false,
    ).id,
    null,
  );
});

test("velocidade fica dentro do intervalo de cada sistema e o id da voz é fechado", () => {
  assert.equal(macosRate(1), 175);
  assert.equal(macosRate(0.5), 88);
  assert.equal(macosRate(3), 450);
  assert.equal(windowsRate(1), 0);
  assert.equal(windowsRate(0.5), -5);
  assert.equal(windowsRate(2), 10);
  assert.equal(linuxRate(0.5), -50);
  assert.equal(linuxRate(2), 100);
  assert.throws(() => assertVoiceId("Luciana;rm -rf /"));
  assert.doesNotThrow(() => assertVoiceId("Microsoft Maria Desktop"));
});

test("narração no Mac grava WAV sem shell e troca Faber pela voz do sistema", async () => {
  const dir = mkdtempSync(join(tmpdir(), "localneuron-tts-"));
  const legacy = join(dir, "pro-media", "vits-piper-pt_BR-faber-medium");
  mkdirSync(legacy, { recursive: true });
  writeFileSync(join(legacy, "verified.json"), "{}");
  const fake = macRunner();
  const media = new ProMedia(dir, dir, new SystemTts(fake, "darwin", 0));
  try {
    const status = await media.status();
    assert.equal(status.voice.ready, true);
    assert.equal(status.voice.id, "Luciana");
    assert.equal(status.voice.legacyId, LEGACY_VOICE_ID);
    assert.equal(status.download, null);
    const spoken = await media.speak("segredo de narração", 1, LEGACY_VOICE_ID);
    assert.equal(spoken.voice, "Luciana");
    assert.equal(media.audio(spoken.id).toString("ascii", 0, 4), "RIFF");
    const say = fake.calls.filter(
      (call) => call.command === "say" && call.args.includes("-o"),
    );
    assert.equal(say.length, 1);
    assert.equal(say[0].args.includes("segredo de narração"), false);
    assert.ok(say[0].args.includes("Luciana"));
    assert.equal(
      JSON.parse(
        readFileSync(join(dir, "pro-media", "tts-voice.json"), "utf8"),
      ).id,
      "Luciana",
    );
    await assert.rejects(
      () => media.speak("oi", 1, "voz\ninjetada"),
      /não está disponível|Voz inválida|português brasileiro/,
    );
  } finally {
    await media.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("voz do sistema já escolhida continua selecionada", async () => {
  const dir = mkdtempSync(join(tmpdir(), "localneuron-tts-"));
  mkdirSync(join(dir, "pro-media"), { recursive: true });
  writeFileSync(
    join(dir, "pro-media", "tts-voice.json"),
    JSON.stringify({ id: "Alex", legacyId: null }),
  );
  const media = new ProMedia(dir, dir, new SystemTts(macRunner(), "darwin", 0));
  try {
    const status = await media.status();
    assert.equal(status.voice.id, "Alex");
    const spoken = await media.speak("olá", 1);
    assert.equal(spoken.voice, "Alex");
  } finally {
    await media.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sem voz pt-BR a narração é recusada com mensagem clara", async () => {
  const dir = mkdtempSync(join(tmpdir(), "localneuron-tts-"));
  const european = runner({ say: true }, (command, args) =>
    command === "say" && args[1] === "?"
      ? {
          code: 0,
          stdout: "Joana               pt_PT    # Olá de Portugal.\n",
          stderr: "",
        }
      : { code: 0, stdout: "", stderr: "" },
  );
  const media = new ProMedia(
    dir,
    dir,
    new SystemTts(european, "darwin", 0),
  );
  try {
    const status = await media.status();
    assert.equal(status.voice.ready, false);
    assert.equal(status.voice.message, TTS_MESSAGES.europeanOnly);
    await assert.rejects(() => media.speak("olá"), /português brasileiro/);
    await assert.rejects(() => media.select("Joana"), /português brasileiro/);
  } finally {
    await media.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Linux sem spd-say desativa a narração e não baixa voz", async () => {
  const dir = mkdtempSync(join(tmpdir(), "localneuron-tts-"));
  const fake = runner({}, () => {
    throw Error("não deveria executar comando");
  });
  const media = new ProMedia(dir, dir, new SystemTts(fake, "linux", 0));
  try {
    const status = await media.install();
    assert.equal(status.voice.ready, false);
    assert.equal(status.voice.message, TTS_MESSAGES.linuxMissing);
    assert.equal(status.download, null);
    assert.equal(fake.calls.length, 0);
    await assert.rejects(() => media.speak("olá"), /spd-say/);
  } finally {
    await media.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Linux com spd-say grava WAV pela voz pt-BR e sem gravador explica a falta", async () => {
  const dir = mkdtempSync(join(tmpdir(), "localneuron-tts-"));
  const listed = { code: 0, stdout: "female1\tpt-BR\n", stderr: "" };
  const missingRecorder = runner({ "spd-say": true }, () => listed);
  const blocked = new ProMedia(
    dir,
    dir,
    new SystemTts(missingRecorder, "linux", 0),
  );
  const status = await blocked.status();
  assert.equal(status.voice.message, TTS_MESSAGES.linuxNoRecorder);
  await blocked.close();
  const fake = runner(
    { "spd-say": true, pactl: true, parecord: true },
    (command, args) => {
      if (command === "spd-say" && args[0] === "--list-synthesis-voices")
        return listed;
      if (command === "pactl" && args[0] === "load-module")
        return { code: 0, stdout: "42\n", stderr: "" };
      if (command === "spd-say") return { code: 0, stdout: "", stderr: "" };
      if (command === "pactl") return { code: 0, stdout: "", stderr: "" };
      return { code: 1, stdout: "", stderr: command };
    },
  );
  const media = new ProMedia(dir, dir, new SystemTts(fake, "linux", 0));
  try {
    const spoken = await media.speak("olá brasil", 1);
    assert.equal(spoken.voice, "female1");
    const speech = fake.calls.find(
      (call) => call.command === "spd-say" && call.args[0] === "-w",
    );
    assert.ok(speech);
    assert.deepEqual(speech.args.slice(0, 8), [
      "-w",
      "-l",
      "pt-BR",
      "-y",
      "female1",
      "-r",
      "0",
      "--",
    ]);
    assert.equal(speech.args.at(-1), "olá brasil");
    assert.equal(
      fake.calls.some((call) => call.command === "bash" || call.command === "sh"),
      false,
    );
    assert.throws(() => media.audio("não-é-uuid"), /Áudio inválido/);
  } finally {
    await media.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
