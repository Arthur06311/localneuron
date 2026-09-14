import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Pro, sealBackup, openBackup, chooseModel } from "../src/pro.js";
import {
  extractDocument,
  retrieve,
  exportDocument,
  checkedZip,
} from "../src/pro-documents.js";
import { unzipSync, zipSync, strToU8 } from "fflate";
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "pro-test-"));
  const calls: any[] = [];
  const pro = new Pro(dir, {
    canRun: () => true,
    models: async () => [{ key: "test-model", size_bytes: 100 }],
    run: async (key, messages, options, signal, delta) => {
      signal.throwIfAborted();
      calls.push({ key, messages, options });
      delta("parcial");
      return "Resposta com fonte [documento:1]";
    },
  });
  return {
    dir,
    pro,
    calls,
    close: async () => {
      await pro.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
};
async function done(pro: Pro, id: string) {
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    const job = pro.state.jobs.find((j) => j.id === id)!;
    if (!["queued", "running"].includes(job.state)) return job;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Job timeout");
}
test("Pro salva revisões, rejeita conflito e preserva memória por projeto", async () => {
  const f = fixture();
  try {
    const p = f.pro.project({ name: "Projeto" });
    f.pro.project({
      id: p.id,
      name: p.name,
      body: "v1",
      memory: "Preferência aprovada",
      expected: 0,
    });
    f.pro.project({ id: p.id, name: p.name, body: "v2", expected: 1 });
    assert.equal(p.versions.at(-1)?.body, "v1");
    assert.throws(
      () =>
        f.pro.project({ id: p.id, name: p.name, body: "perdido", expected: 0 }),
      /Versão mudou/,
    );
    assert.equal(p.body, "v2");
    assert.equal(p.memory, "Preferência aprovada");
  } finally {
    await f.close();
  }
});
test("Documentos têm localização, busca retorna evidência e não mistura projetos", async () => {
  const f = fixture();
  try {
    const a = f.pro.project({ name: "A" }),
      b = f.pro.project({ name: "B" });
    await f.pro.document({
      project: a.id,
      name: "dados.txt",
      data: Buffer.from(
        "O projeto Aurora tem orçamento aprovado de 120 reais.",
      ).toString("base64"),
    });
    assert.match(f.pro.search(a.id, "Aurora orçamento")[0].text, /120/);
    assert.equal(f.pro.search(b.id, "Aurora orçamento").length, 0);
    assert.throws(
      () =>
        f.pro.enqueue({
          project: b.id,
          prompt: "resuma",
          kind: "batch",
          documents: [f.pro.state.documents[0].id],
        }),
      /não pertence/,
    );
  } finally {
    await f.close();
  }
});
test("Lote processa arquivos, assistente e memória chegam ao modelo, cancelamento de fila funciona", async () => {
  const f = fixture();
  try {
    const p = f.pro.project({ name: "Lote" });
    f.pro.project({
      id: p.id,
      name: p.name,
      memory: "Prefira frases curtas",
      expected: 0,
    });
    for (const name of ["um.txt", "dois.txt"])
      await f.pro.document({
        project: p.id,
        name,
        data: Buffer.from(name + " conteúdo único").toString("base64"),
      });
    const assistant = {
      id: crypto.randomUUID(),
      name: "Editor",
      instructions: "Revise em português",
      model: "test-model",
      temperature: 0.2,
    };
    f.pro.assistant(assistant);
    const job = f.pro.enqueue({
      project: p.id,
      prompt: "Revise",
      kind: "batch",
      assistant: assistant.id,
      documents: f.pro.state.documents.map((d) => d.id),
    });
    const result = await done(f.pro, job.id);
    assert.equal(result.state, "complete");
    assert.equal(result.results.length, 2);
    assert.match(f.calls[0].messages[0].content, /Prefira frases curtas/);
    assert.match(f.calls[0].messages[0].content, /Revise em português/);
    assert.equal(f.calls[0].options.temperature, 0.2);
    const cancelled = f.pro.enqueue({ project: p.id, prompt: "não executar" });
    await f.pro.cancel(cancelled.id);
    assert.equal(cancelled.state, "cancelled");
  } finally {
    await f.close();
  }
});
test("Pesquisa exige Internet e seleção automática respeita memória e especialidade", () => {
  const models = [
    { key: "large", size_bytes: 40 * 1024 ** 3 },
    { key: "coder", display_name: "Qwen Coder", size_bytes: 3 * 1024 ** 3 },
    { key: "chat", size_bytes: 4 * 1024 ** 3 },
  ];
  assert.equal(
    chooseModel(models, "Corrija este código Python", 8 * 1024 ** 3).key,
    "coder",
  );
  assert.throws(() => chooseModel(models, "Olá", 100), /memória/);
});
test("Backup AES-GCM detecta adulteração e senha errada; histórico cifrado restaura dados", async () => {
  const f = fixture();
  try {
    const p = f.pro.project({ name: "Sigiloso" }),
      password = "senha-do-backup-teste";
    const backup = f.pro.backup(password, []);
    assert.equal(f.pro.backups().length, 1);
    assert.ok(!JSON.stringify(backup).includes("Sigiloso"));
    assert.equal(openBackup(backup, password).pro.projects[0].name, "Sigiloso");
    assert.throws(() => openBackup(backup, "senha-errada"), /Senha incorreta/);
    const broken = {
      ...backup,
      data: Buffer.from("alterado").toString("base64"),
    };
    assert.throws(() => openBackup(broken, password));
    f.pro.project({ id: p.id, name: "Outra versão", expected: 0 });
    f.pro.restore(backup, password);
    assert.equal(f.pro.state.projects[0].name, "Sigiloso");
  } finally {
    await f.close();
  }
});
test("Exportações DOCX, XLSX e PPTX são pacotes válidos e documentos retornam texto", async () => {
  for (const format of ["docx", "xlsx", "pptx"]) {
    const file = await exportDocument(
      "Relatório Aurora",
      "# Aurora\n\n## Resultado\nReceita | Valor\nProjeto | 120",
      format,
    );
    const zip = unzipSync(file.buffer);
    assert.ok(zip["[Content_Types].xml"]);
    if (format !== "pptx") {
      const pages = await extractDocument("arquivo." + format, file.buffer);
      assert.match(pages.map((p) => p.text).join("\n"), /Aurora|120/);
    }
  }
});
test("Leitura rejeita formatos inválidos e expansão excessiva", async () => {
  await assert.rejects(
    extractDocument("x.exe", Buffer.from("binário")),
    /Use PDF/,
  );
  await assert.rejects(
    extractDocument("x.txt", Buffer.from("a\0b")),
    /binário/,
  );
  assert.throws(
    () =>
      checkedZip(
        Buffer.from(zipSync({ "large.xml": new Uint8Array(9 * 1024 ** 2) })),
      ),
    /compactado/,
  );
});

test("Cancelar tarefa ativa interrompe o motor e deixa a fila seguir", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pro-cancel-"));
  let started = false;
  const pro = new Pro(dir, {
    canRun: () => true,
    models: async () => [{ key: "test", size_bytes: 100 }],
    run: async (_key, messages, _options, signal) => {
      if (messages[1].content.startsWith("segunda")) return "concluída";
      started = true;
      await new Promise<void>((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelada")), {
          once: true,
        }),
      );
      return "não deve chegar";
    },
  });
  try {
    const p = pro.project({ name: "Cancelamento" });
    const first = pro.enqueue({
      project: p.id,
      prompt: "primeira",
      model: "test",
    });
    const second = pro.enqueue({
      project: p.id,
      prompt: "segunda",
      model: "test",
    });
    const deadline = Date.now() + 3000;
    while (!started && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 50));
    assert.ok(started);
    await pro.cancel(first.id);
    assert.equal(first.state, "cancelled");
    assert.equal((await done(pro, second.id)).output, "concluída");
  } finally {
    await pro.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Reabrir o espaço preserva projetos e marca fila anterior como interrompida", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pro-restart-"));
  const adapter = {
    canRun: () => false,
    models: async () => [],
    run: async () => "",
  };
  const first = new Pro(dir, adapter);
  const p = first.project({ name: "Persistente" });
  first.enqueue({ project: p.id, prompt: "pendente" });
  await first.close();
  const second = new Pro(dir, adapter);
  try {
    assert.equal(second.state.projects[0].name, "Persistente");
    assert.equal(second.state.jobs[0].state, "interrupted");
  } finally {
    await second.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
