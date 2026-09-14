import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  symlink,
  rm,
  mkdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectMlx, importMlx } from "../src/mlx-models.js";

test("MLX: importar cria uma cópia independente, exclui código e preserva origem", async () => {
  const root = await mkdtemp(join(tmpdir(), "colmeia-mlx-"));
  const source = join(root, "modelo"),
    destination = join(root, "models");
  await mkdir(source);
  await mkdir(destination);
  try {
    await writeFile(
      join(source, "config.json"),
      JSON.stringify({ model_type: "qwen3", quantization: { bits: 4 } }),
    );
    await writeFile(join(source, "tokenizer.json"), "{}");
    await writeFile(join(source, "model.safetensors"), "pesos fictícios");
    await writeFile(join(source, "model.py"), "não deve ser copiado");
    const imported = await importMlx(source, destination);
    assert.match(imported.key, /^mlx:/);
    assert.notEqual(imported.path, source);
    assert.equal(
      await readFile(join(imported.path, "model.safetensors"), "utf8"),
      "pesos fictícios",
    );
    await assert.rejects(readFile(join(imported.path, "model.py")), /ENOENT/);
    await rm(source, { recursive: true });
    assert.equal(
      inspectMlx(imported.path).size_bytes,
      Buffer.byteLength("pesos fictícios"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("MLX: partes ausentes, índice fora da pasta e links são recusados", async () => {
  const root = await mkdtemp(join(tmpdir(), "colmeia-mlx-invalid-"));
  try {
    await writeFile(join(root, "config.json"), "{}");
    assert.throws(() => inspectMlx(root), /precisa conter/);
    await writeFile(join(root, "config.json"), '{"model_type":"qwen3"}');
    await writeFile(join(root, "tokenizer.json"), "{}");
    await writeFile(join(root, "model.safetensors"), "fixture");
    await writeFile(
      join(root, "model.safetensors.index.json"),
      '{"weight_map":{"w":"../outside.safetensors"}}',
    );
    assert.throws(() => inspectMlx(root), /Faltam partes/);
    await rm(join(root, "model.safetensors.index.json"));
    await rm(join(root, "tokenizer.json"));
    await symlink(join(root, "config.json"), join(root, "tokenizer.json"));
    assert.throws(() => inspectMlx(root), /links/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
