import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url),
  sherpa = require("sherpa-onnx-node");
const [folder, input, output] = process.argv.slice(2);
const settings = JSON.parse(readFileSync(input, "utf8"));
const tts = new sherpa.OfflineTts({
  model: {
    vits: {
      model: join(folder, "pt_BR-faber-medium.onnx"),
      tokens: join(folder, "tokens.txt"),
      dataDir: join(folder, "espeak-ng-data"),
    },
    numThreads: 4,
    provider: "cpu",
    debug: false,
  },
  maxNumSentences: 1,
});
const result = tts.generate({
  text: settings.text,
  sid: 0,
  speed: settings.speed,
});
sherpa.writeWave(output, {
  samples: result.samples,
  sampleRate: result.sampleRate,
});
