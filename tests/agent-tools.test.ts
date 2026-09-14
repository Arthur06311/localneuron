import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Toolbox, accessSchema } from "../src/agent-tools.js";
import { publicAddress, publicPage } from "../src/web-tools.js";
const signal = () => new AbortController().signal;
test("Ferramentas respeitam pasta, credenciais, links, permissões e aprovação do conteúdo", async () => {
  const data = await mkdtemp(join(tmpdir(), "colmeia-tools-")),
    folder = await mkdtemp(join(tmpdir(), "colmeia-project-"));
  const box = new Toolbox(data);
  await box.chooseFolder(folder);
  const access = accessSchema.parse({ files: true, terminal: true });
  const context = {
    chat: "fixture",
    signal: signal(),
    privateRead: false,
    notify: () => {},
  };
  try {
    await writeFile(join(folder, "notes.md"), "Conteúdo original");
    await writeFile(join(folder, ".env"), "SENHA=segredo");
    assert.deepEqual(
      await box.run(
        "files_read",
        JSON.stringify({ path: "notes.md" }),
        access,
        context,
      ),
      { path: "notes.md", text: "Conteúdo original" },
    );
    for (const path of ["../fora.txt", "/etc/passwd", ".env"])
      await assert.rejects(() =>
        box.run("files_read", JSON.stringify({ path }), access, context),
      );
    if (process.platform !== "win32") {
      await symlink(join(folder, "notes.md"), join(folder, "link.md"));
      await assert.rejects(
        () =>
          box.run(
            "files_read",
            JSON.stringify({ path: "link.md" }),
            access,
            context,
          ),
        /simbólicos/,
      );
    }
    await assert.rejects(
      () =>
        box.run(
          "terminal_run",
          '{"command":"echo teste"}',
          accessSchema.parse({}),
          context,
        ),
      /não habilitada/,
    );
    const pending = box.run(
      "files_write",
      JSON.stringify({ path: "notes.md", content: "Novo conteúdo" }),
      access,
      context,
    );
    while (!box.status().approvals.length)
      await new Promise((r) => setTimeout(r, 5));
    assert.equal(
      await readFile(join(folder, "notes.md"), "utf8"),
      "Conteúdo original",
    );
    assert.match(box.status().approvals[0].preview, /Novo conteúdo/);
    box.approve(box.status().approvals[0].id, true);
    await pending;
    assert.equal(
      await readFile(join(folder, "notes.md"), "utf8"),
      "Novo conteúdo",
    );
    const denied = box.run(
      "files_write",
      JSON.stringify({ path: "new.md", content: "Recusado" }),
      access,
      context,
    );
    const checked = assert.rejects(denied, /recusada/);
    while (!box.status().approvals.length)
      await new Promise((r) => setTimeout(r, 5));
    box.approve(box.status().approvals[0].id, false);
    await checked;
    await assert.rejects(() => readFile(join(folder, "new.md")));
  } finally {
    await rm(data, { recursive: true, force: true });
    await rm(folder, { recursive: true, force: true });
  }
});
test("Cancelar revisão não executa; mudança após prévia exige nova revisão; comando autorizado é real", async () => {
  const data = await mkdtemp(join(tmpdir(), "colmeia-tools-")),
    folder = await mkdtemp(join(tmpdir(), "colmeia-project-"));
  const box = new Toolbox(data);
  await box.chooseFolder(folder);
  const access = accessSchema.parse({ files: true, terminal: true });
  const controller = new AbortController();
  const context = {
    chat: "fixture",
    signal: controller.signal,
    privateRead: false,
    notify: () => {},
  };
  try {
    const pending = box.run(
      "terminal_run",
      JSON.stringify({ command: "echo COLMEIA_TESTE" }),
      access,
      context,
    );
    const rejected = assert.rejects(pending, /recusado/);
    while (!box.status().approvals.length)
      await new Promise((r) => setTimeout(r, 5));
    controller.abort();
    await rejected;
    assert.equal(box.status().approvals.length, 0);
    await writeFile(join(folder, "file.md"), "Antes");
    const write = box.run(
      "files_write",
      JSON.stringify({ path: "file.md", content: "Depois" }),
      access,
      { ...context, signal: signal() },
    );
    const stale = assert.rejects(write, /mudou/);
    while (!box.status().approvals.length)
      await new Promise((r) => setTimeout(r, 5));
    await writeFile(join(folder, "file.md"), "Alterado pelo usuário");
    box.approve(box.status().approvals[0].id, true);
    await stale;
    const command = box.run(
      "terminal_run",
      JSON.stringify({ command: "echo COLMEIA_TESTE" }),
      access,
      { ...context, signal: signal() },
    );
    while (!box.status().approvals.length)
      await new Promise((r) => setTimeout(r, 5));
    box.approve(box.status().approvals[0].id, true);
    const result = (await command) as any;
    assert.equal(result.exit_code, 0);
    assert.match(result.output, /COLMEIA_TESTE/);
  } finally {
    await rm(data, { recursive: true, force: true });
    await rm(folder, { recursive: true, force: true });
  }
});
test("Web rejeita loopback, rede privada, IPv6 mapeado e DNS misto antes de conectar", async () => {
  for (const ip of [
    "127.0.0.1",
    "192.168.1.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "100.64.0.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("1.1.1.1"), true);
  await assert.rejects(
    () =>
      publicPage("https://public.example/", signal(), (async () => [
        { address: "1.1.1.1", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]) as any),
    /internos/,
  );
  for (const url of [
    "file:///etc/passwd",
    "http://user:pass@example.com",
    "http://example.com:8080",
  ])
    await assert.rejects(() => publicPage(url, signal()));
});
test("Consulta web após ler arquivos requer revisão e não sai quando recusada", async () => {
  const data = await mkdtemp(join(tmpdir(), "colmeia-tools-"));
  const box = new Toolbox(data);
  try {
    const pending = box.run(
      "web_search",
      '{"query":"Texto local"}',
      accessSchema.parse({ web: true }),
      {
        chat: "fixture",
        signal: signal(),
        privateRead: true,
        notify: () => {},
      },
    );
    const checked = assert.rejects(pending, /não autorizada/);
    while (!box.status().approvals.length)
      await new Promise((r) => setTimeout(r, 5));
    box.approve(box.status().approvals[0].id, false);
    await checked;
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});

test("Offline por padrão não concede ferramentas de internet ou terminal", async () => {
  const data = await mkdtemp(join(tmpdir(), "colmeia-offline-"));
  try {
    const box = new Toolbox(data),
      access = accessSchema.parse({});
    const names = box.definitions(access).map((t) => t.function.name);
    assert.ok(
      !names.includes("web_search") &&
        !names.includes("web_read") &&
        !names.includes("terminal_run"),
    );
    await assert.rejects(
      box.run("web_search", '{"query":"teste"}', access, {
        chat: "fixture",
        signal: signal(),
        privateRead: false,
        notify: () => {},
      }),
      /habilitada|autorizada|disponível/,
    );
    assert.equal(box.status().approvals.length, 0);
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});

test('Perfil somente leitura bloqueia escrita e terminal mesmo com permissões individuais ativas',async()=>{
 const data=await mkdtemp(join(tmpdir(),'neuron-readonly-')),folder=await mkdtemp(join(tmpdir(),'neuron-readonly-files-'));const box=new Toolbox(data);await box.chooseFolder(folder);const access=accessSchema.parse({files:true,terminal:true,readOnly:true});const ctx={chat:'fixture',signal:signal(),privateRead:false,notify:()=>{}};
 try{await writeFile(join(folder,'notes.txt'),'Original');const names=box.definitions(access).map(t=>t.function.name);assert.ok(names.includes('files_read'));assert.ok(!names.includes('files_write'));assert.ok(!names.includes('terminal_run'));
 for(const[name,args]of [['files_write',{path:'notes.txt',content:'alterado'}],['terminal_run',{command:'echo alterado'}]] as const)await assert.rejects(box.run(name,JSON.stringify(args),access,ctx),/não habilitada/);
 assert.equal(await readFile(join(folder,'notes.txt'),'utf8'),'Original');assert.equal(box.status().approvals.length,0);
 }finally{await rm(data,{recursive:true,force:true});await rm(folder,{recursive:true,force:true});}
});
