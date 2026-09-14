import { createHash, randomUUID } from "node:crypto";
import {
  readdirSync,
  lstatSync,
  readFileSync,
  realpathSync,
  promises as fs,
  statfsSync,
} from "node:fs";
import { join, basename, resolve, isAbsolute } from "node:path";

export function inspectMlx(folder: string) {
  const path = realpathSync(folder);
  if (lstatSync(folder).isSymbolicLink() || !lstatSync(path).isDirectory())
    throw new Error("Escolha uma pasta real de modelo MLX.");
  const entries = readdirSync(path, { withFileTypes: true });
  const allowed =
    /^(config\.json|generation_config\.json|tokenizer.*\.(json|model)|special_tokens_map\.json|added_tokens\.json|vocab\.(json|txt)|merges\.txt|chat_template\.jinja|.*\.safetensors(\.index\.json)?|README\.md|LICENSE(\.txt|\.md)?)$/;
  const files = entries.filter((e) => allowed.test(e.name));
  if (files.some((e) => !e.isFile() || e.isSymbolicLink()))
    throw new Error("O modelo contém links ou arquivos inválidos.");
  const names = files.map((e) => e.name);
  if (
    !names.includes("config.json") ||
    !names.some((n) => /^tokenizer.*\.(json|model)$/.test(n)) ||
    !names.some((n) => n.endsWith(".safetensors"))
  )
    throw new Error(
      "A pasta precisa conter config.json, tokenizer e pesos .safetensors.",
    );
  const configFile = join(path, "config.json");
  if (lstatSync(configFile).size > 2 * 1024 ** 2)
    throw new Error("Configuração de modelo excessiva.");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  if (typeof config.model_type !== "string")
    throw new Error("Arquitetura do modelo ausente.");
  for (const name of names.filter((n) =>
    n.endsWith(".safetensors.index.json"),
  )) {
    if (lstatSync(join(path, name)).size > 8 * 1024 ** 2)
      throw new Error("Índice de pesos excessivo.");
    const index = JSON.parse(readFileSync(join(path, name), "utf8"));
    if (
      !index.weight_map ||
      !Object.keys(index.weight_map).length ||
      Object.values(index.weight_map).some(
        (n) =>
          typeof n !== "string" ||
          !names.includes(n) ||
          basename(n) !== n ||
          !n.endsWith(".safetensors"),
      )
    )
      throw new Error("Faltam partes dos pesos MLX ou o índice é inválido.");
  }
  const sizes = files.map((e) => ({
    name: e.name,
    bytes: lstatSync(join(path, e.name)).size,
  }));
  const size_bytes = sizes
    .filter((f) => f.name.endsWith(".safetensors"))
    .reduce((n, f) => n + f.bytes, 0);
  if (
    size_bytes <= 0 ||
    sizes.some(
      (f) => !f.name.endsWith(".safetensors") && f.bytes > 64 * 1024 ** 2,
    )
  )
    throw new Error("Tamanho dos arquivos do modelo inválido.");
  return {
    path,
    files: sizes,
    size_bytes,
    key: "mlx:" + createHash("sha256").update(path).digest("hex").slice(0, 24),
    display_name:
      basename(path)
        .replace(/^mlx-/, "")
        .replace(/-[a-f0-9]{8}$/, "")
        .replace(/[-_]/g, " ") + " · MLX integrado",
  };
}

export async function importMlx(folder: string, destination: string) {
  if (!isAbsolute(folder) || resolve(folder) === resolve(destination))
    throw new Error("Escolha o caminho completo de uma pasta de modelo MLX.");
  const model = inspectMlx(folder);
  const total = model.files.reduce((n, f) => n + f.bytes, 0),
    disk = statfsSync(destination);
  if (disk.bavail * disk.bsize < total + 1024 ** 3)
    throw new Error(
      "Falta espaço para copiar o modelo e preservar a margem de disco.",
    );
  const target = join(
    destination,
    "mlx-" +
      basename(model.path)
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 90) +
      "-" +
      model.key.slice(4, 12),
  );
  try {
    await fs.lstat(target);
    throw new Error("Este modelo já foi copiado para a LocalNeuron.");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const temporary = join(destination, ".import-" + randomUUID());
  await fs.mkdir(temporary, { mode: 0o700 });
  try {
    for (const file of model.files) {
      const source = join(model.path, file.name),
        before = await fs.lstat(source);
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        before.size !== file.bytes
      )
        throw new Error("O modelo mudou durante a cópia.");
      await fs.copyFile(source, join(temporary, file.name));
      const after = await fs.lstat(source);
      if (
        before.mtimeMs !== after.mtimeMs ||
        before.ino !== after.ino ||
        before.size !== after.size
      )
        throw new Error("O modelo mudou durante a cópia.");
    }
    inspectMlx(temporary);
    await fs.rename(temporary, target);
    return inspectMlx(target);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
