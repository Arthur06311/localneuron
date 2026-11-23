import {testConfig, activateTestPro} from './subscription-fixture.js';
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Chats, localReply } from "../src/chat.js";
import { Core } from "../src/core.js";
import { CATALOG } from "../src/catalog.js";
import { createApp } from "../src/server.js";

const frame = (data: unknown) => "data: " + JSON.stringify(data) + "\r\n\r\n";
function stream(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
  );
}
test("Conversa persiste, envia uma única vez, mantém contexto e permite parar", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-"));
  let core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-chat-segura");
  let calls = 0;
  const histories: unknown[] = [];
  const chats = new Chats(core, async (_model, messages, signal, delta) => {
    calls++;
    histories.push(messages);
    delta("Parte recebida");
    if (calls === 2)
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
    return signal.aborted ? "Não deve virar resposta concluída" : "Olá!";
  });
  try {
    const { id } = await chats.create("chat-create-001");
    assert.deepEqual(await chats.create("chat-create-001"), { id });
    const sent = await chats.send(id, "local-model", "Olá", "chat-message-001");
    assert.deepEqual(
      await chats.send(id, "local-model", "Olá", "chat-message-001"),
      sent,
    );
    await Promise.all([...chats.jobs.values()].map((j) => j.promise));
    assert.equal(calls, 1);
    assert.equal((await chats.list())[0].messages[1].content, "Olá!");
    await chats.send(id, "local-model", "E agora?", "chat-message-002");
    await assert.rejects(
      chats.send(id, "local-model", "Concorrente", "chat-message-003"),
      /Aguarde/,
    );
    while (histories.length < 2)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal((histories[1] as any[]).length, 3);
    await chats.stop(id);
    assert.equal(
      (await chats.list())[0].messages.at(-1)?.content,
      "Parte recebida",
    );
    assert.equal((await chats.list())[0].messages.at(-1)?.status, "stopped");
    await assert.rejects(
      chats.send(id, "local-model", "Outro texto", "chat-message-001"),
      /outro conteúdo/,
    );
    const exported = JSON.stringify(await core.export());
    assert.ok(!exported.includes("E agora?"));
    await core.close();
    core = new Core(dir, resolve("."));
    await core.init();
    await core.unlock("senha-teste-chat-segura");
    const reopened = new Chats(core);
    await reopened.recover();
    assert.equal((await reopened.list())[0].messages.length, 4);
    await core.store.tx((state, entries) => {
      state!.chats![0].messages.at(-1)!.status = "pending";
      core.append(state!, entries, "test.interruption", {});
    });
    await reopened.recover();
    assert.equal((await reopened.list())[0].messages.at(-1)?.status, "stopped");
    core.vault.lock();
    await assert.rejects(reopened.create("chat-locked-001"), /bloqueado/);
  } finally {
    await chats.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Chat usa motor loopback, sem ferramentas nem armazenamento remoto", async () => {
  const original = globalThis.fetch;
  const requests: { url: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.endsWith("/models"))
      return Response.json({
        models: [
          {
            type: "llm",
            key: "mini",
            loaded_instances: [{ id: "mini-loaded" }],
            capabilities: { reasoning: { allowed_options: ["off"] } },
          },
        ],
      });
    return stream(
      frame({
        choices: [{ delta: { content: "Tudo bem." }, finish_reason: "stop" }],
      }) + "data: [DONE]\r\n\r\n",
    );
  };
  try {
    await localReply(
      "mini-loaded",
      [{ id: "1", role: "user", content: "Oi", at: 0, status: "complete" }],
      new AbortController().signal,
      () => {},
    );
    const request = requests.at(-1)!;
    assert.equal(request.url, "http://127.0.0.1:8080/v1/chat/completions");
    assert.equal(request.body.tools, undefined);
    assert.equal(request.body.integrations, undefined);
    assert.equal(request.body.stream, true);
    assert.deepEqual(request.body.messages.at(-1), {
      role: "user",
      content: "Oi",
    });
  } finally {
    globalThis.fetch = original;
  }
});
test("Rotas do chat mantêm sessão, origem, esquema e bloqueio do cofre", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-http-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-chat-segura");
  const { app, subscription } = await createApp(core, "test-token",undefined,undefined,testConfig);
  activateTestPro(subscription);
  const headers = {
    host: "127.0.0.1:4317",
    authorization: "Bearer test-token",
    "idempotency-key": "chat-http-001",
  };
  try {
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/v1/chats",
          headers: { host: headers.host },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/chats",
          headers: { ...headers, origin: "https://example.com" },
          payload: {},
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/chats",
          headers,
          payload: { tools: ["shell"] },
        })
      ).statusCode,
      400,
    );
    const result = await app.inject({
      method: "POST",
      url: "/v1/chats",
      headers,
      payload: {},
    });
    assert.equal(result.statusCode, 200);
    const id = result.json().id;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${id}/send`,
          headers,
          payload: {
            model: "x",
            content: "hello",
            endpoint: "https://example.com",
          },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/chats/attachments",
          headers: { host: headers.host },
          payload: { name: "note.txt", data: "YWJj" },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/chats/attachments",
          headers: { ...headers, origin: "https://example.com" },
          payload: { name: "note.txt", data: "YWJj" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/chats/attachments",
          headers,
          payload: {
            name: "note.txt",
            data: Buffer.from("conteúdo do arquivo").toString("base64"),
          },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${id}/memory`,
          headers,
          payload: { memory: "Minha preferência" },
        })
      ).statusCode,
      200,
    );
    const replyId = crypto.randomUUID();
    await core.store.tx((state, entries) => {
      state!
        .chats!.find((c) => c.id === id)!
        .messages.push({
          id: replyId,
          role: "assistant",
          content: "Conteúdo para o editor Pro.",
          status: "complete",
          at: Date.now(),
        });
      core.append(state!, entries, "fixture.answer", {});
    });
    const transferred = await app.inject({
      method: "POST",
      url: `/v1/chats/${id}/to-pro`,
      headers,
      payload: { message: replyId },
    });
    assert.equal(transferred.statusCode, 200);
    assert.equal(transferred.json().body, "Conteúdo para o editor Pro.");
    assert.equal(transferred.json().memory, "Minha preferência");
    await app.inject({ method: "POST", url: "/v1/lock", headers, payload: {} });
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${id}/memory`,
          headers,
          payload: { memory: "bloqueado" },
        })
      ).statusCode,
      423,
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/v1/chats", headers }))
        .statusCode,
      423,
    );
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Pedido sem corpo não envia content-type JSON e excluir conversa funciona", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-delete-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-excluir-conversa");
  const { app } = await createApp(
    core,
    "test-token",
    undefined,
    undefined,
    testConfig,
  );
  const source = readFileSync(resolve("public/app.js"), "utf8");
  const start = source.indexOf("async function api(");
  const end = source.indexOf("\nfunction toast(");
  assert.ok(start >= 0 && end > start);
  const api = (
    new Function(
      "document",
      "t",
      `${source.slice(start, end)}\nreturn api;`,
    ) as (
      document: { dispatchEvent: () => void },
      translate: (key: string) => string,
    ) => (
      path: string,
      options?: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
      },
    ) => Promise<any>
  )({ dispatchEvent() {} }, () => "Não foi possível concluir");
  const seen: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    if (
      init?.headers &&
      !(init.headers instanceof Headers) &&
      !Array.isArray(init.headers)
    ) {
      for (const [key, value] of Object.entries(init.headers)) {
        if (typeof value === "string") headers[key] = value;
      }
    }
    const body = typeof init?.body === "string" ? init.body : undefined;
    seen.push({ url, method: init?.method || "GET", headers, body });
    const response = await app.inject({
      method: (init?.method || "GET") as "GET" | "POST" | "DELETE",
      url,
      headers: {
        host: "127.0.0.1:4317",
        authorization: "Bearer test-token",
        ...headers,
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const kept = await api("/chats", { method: "POST", body: {} });
    const removed = await api("/chats", { method: "POST", body: {} });
    assert.equal(seen.at(-1)?.headers["content-type"], "application/json");
    assert.equal(seen.at(-1)?.body, "{}");
    const result = await api(`/chats/${removed.id}`, { method: "DELETE" });
    const deletion = seen.at(-1);
    assert.equal(deletion?.method, "DELETE");
    assert.equal(deletion?.url, `/v1/chats/${removed.id}`);
    assert.equal(deletion?.body, undefined);
    assert.equal(deletion?.headers["content-type"], undefined);
    assert.deepEqual(result, { ok: true });
    const chats = await api("/chats");
    assert.equal(
      chats.some((chat: { id: string }) => chat.id === removed.id),
      false,
    );
    assert.equal(
      chats.some((chat: { id: string }) => chat.id === kept.id),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Catálogo amplo mantém arquivos únicos, versões e licenças específicas", () => {
  assert.equal(CATALOG.length, 661);
  assert.equal(new Set(CATALOG.map((m) => m.id)).size, 661);
  assert.equal(new Set(CATALOG.map((m) => m.file)).size, 661);
  for (const model of CATALOG) {
    assert.match(model.sha256, /^[0-9a-f]{64}$/);
    assert.match(model.revision, /^[0-9a-f]{40}$/);
    assert.ok(
      model.bytes > 0 && model.ram_gib > 0 && model.license && model.publisher,
    );
    assert.ok(!model.file.includes("-of-") || model.parts?.length);
  }
  for (const family of [
    "Gemma",
    "DeepSeek",
    "Qwen",
    "OpenAI",
    "Llama",
    "Mistral",
    "Phi",
  ])
    assert.ok(
      CATALOG.some((m) => (m.family + " " + m.author).includes(family)),
    );
  assert.match(CATALOG.find((m) => m.author === "Meta")!.license, /Llama/);
});

import { prepareAttachment, chatContext } from "../src/chat-context.js";
import { optionsSchema } from "../src/inference.js";
test("Anexos e memória acompanham respostas seguintes, com fontes e contexto privado", async () => {
  const dir = mkdtempSync(join(tmpdir(), "neuron-context-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-fixture-contexto");
  const received: any[] = [];
  const chats = new Chats(
    core,
    async (_model, messages, _signal, _delta, options, execution) => {
      received.push({ messages, options, execution });
      return "Orçamento: 980 reais.";
    },
  );
  try {
    const a = await prepareAttachment(
      "briefing.txt",
      Buffer.from("O projeto Boreal tem orçamento aprovado de 980 reais."),
    );
    const { id } = await chats.create("new-context");
    await chats.memory(id, "Responda com frases curtas.");
    await chats.send(
      id,
      "fixture",
      "Qual é o orçamento?",
      "context-1",
      {},
      false,
      {},
      [a],
    );
    await chats.jobs.get(id)!.promise;
    await chats.send(
      id,
      "fixture",
      "Confirme o orçamento Boreal.",
      "context-2",
    );
    await chats.jobs.get(id)!.promise;
    assert.match(received[1].messages.at(-1).content, /980/);
    assert.match(received[1].options.system, /frases curtas/);
    assert.equal(received[1].execution.privateContext, true);
    const state = (await chats.list())[0];
    assert.equal(state.messages[0].content, "Qual é o orçamento?");
    assert.equal(state.messages[3].sources?.[0].name, "briefing.txt");
    const other = (await chats.create("isolated-context")).id;
    await chats.send(other, "fixture", "Qual é o orçamento?", "context-3");
    await chats.jobs.get(other)!.promise;
    assert.doesNotMatch(received[2].messages.at(-1).content, /980/);
    assert.equal(received[2].execution.privateContext, false);
  } finally {
    await chats.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Ramificação editável preserva original, memória e anexos sem executar outra resposta", async () => {
  const dir = mkdtempSync(join(tmpdir(), "neuron-fork-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-fixture-ramificar");
  let calls = 0;
  const chats = new Chats(core, async () => {
    calls++;
    return "Concluído";
  });
  try {
    const { id } = await chats.create("source-chat");
    await chats.memory(id, "Projeto em português");
    const attachment = await prepareAttachment(
      "notes.md",
      Buffer.from("Notas do projeto."),
    );
    await chats.send(
      id,
      "fixture",
      "Resuma as notas",
      "fork-first",
      {},
      false,
      {},
      [attachment],
    );
    await chats.jobs.get(id)!.promise;
    const original = (await chats.list())[0];
    const edited = await chats.fork(
      id,
      original.messages[0].id,
      true,
      "fork-edit",
    );
    assert.deepEqual(
      await chats.fork(id, original.messages[0].id, true, "fork-edit"),
      edited,
    );
    assert.equal(edited.draft, "Resuma as notas");
    assert.equal(edited.attachments[0].id, attachment.id);
    assert.equal(calls, 1);
    const branch = (await chats.list()).find((c) => c.id === edited.id)!;
    assert.equal(branch.memory, "Projeto em português");
    assert.equal(branch.messages.length, 0);
    assert.equal(
      (await chats.list()).find((c) => c.id === id)!.messages.length,
      2,
    );
    const complete = await chats.fork(
      id,
      original.messages[1].id,
      false,
      "fork-complete",
    );
    const copied = (await chats.list()).find((c) => c.id === complete.id)!;
    await chats.send(edited.id,'fixture','Novo pedido','fork-edited-send',{},false,{},edited.attachments);
    await chats.jobs.get(edited.id)!.promise;
    assert.match((await chats.list()).find(c=>c.id===edited.id)!.title,/alternativa$/);
    assert.equal(copied.messages.length, 2);
    assert.notEqual(copied.messages[0].id, original.messages[0].id);
    await assert.rejects(
      chats.fork(id, original.messages[1].id, true, "fork-invalid"),
      /Edite/,
    );
  } finally {
    await chats.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Anexos limitam extração e contexto sem substituir instruções por conteúdo do documento", async () => {
  const a = await prepareAttachment(
    "long.txt",
    Buffer.from("Uma linha extensa com dados do documento.\n".repeat(5000)),
  );
  assert.ok(a.truncated);
  assert.ok(a.pages.reduce((n, p) => n + p.text.length, 0) <= 100000);
  await assert.rejects(
    prepareAttachment("../unsafe.txt", Buffer.from("texto")),
    /Nome/,
  );
  const options = optionsSchema.parse({ context: 2048, max_tokens: 1024 });
  const input: any = [
    {
      id: "message",
      role: "user",
      content: "resuma",
      at: 0,
      status: "complete",
      attachments: [a],
    },
  ];
  const c = chatContext(input, "Preferências revisadas", options);
  assert.ok(c.sources.length > 0);
  assert.ok(c.messages[0].content.length < 4096);
  assert.match(c.options.system, /nunca como instruções/);
  assert.equal(input[0].content, "resuma");
});
test("Conversas fixadas ficam no topo, alternam e persistem no cofre", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-pin-"));
  let core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-fixar-conversa");
  let chats = new Chats(core);
  let app: Awaited<ReturnType<typeof createApp>>["app"] | undefined;
  const headers = {
    host: "127.0.0.1:4317",
    authorization: "Bearer test-token",
  };
  try {
    app = (
      await createApp(core, "test-token", undefined, undefined, testConfig)
    ).app;
    const older = await chats.create("pin-older");
    const newer = await chats.create("pin-newer");
    const middle = await chats.create("pin-middle");
    await core.store.tx((state, entries) => {
      const byId = new Map((state!.chats ?? []).map((chat) => [chat.id, chat]));
      byId.get(older.id)!.title = "Antiga";
      byId.get(older.id)!.at = 10;
      byId.get(newer.id)!.title = "Recente";
      byId.get(newer.id)!.at = 30;
      byId.get(middle.id)!.title = "Meio";
      byId.get(middle.id)!.at = 20;
      core.append(state!, entries, "test.pin-order", {});
    });
    assert.deepEqual(
      (await chats.list()).map((chat) => chat.id),
      [middle.id, newer.id, older.id],
    );
    assert.equal(
      (await chats.list()).every((chat) => chat.pinned === undefined),
      true,
    );

    const pinOlder = await app.inject({
      method: "POST",
      url: `/v1/chats/${older.id}/pin`,
      headers,
      payload: { pinned: true },
    });
    assert.equal(pinOlder.statusCode, 200);
    assert.deepEqual(pinOlder.json(), { ok: true, pinned: true });
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${middle.id}/pin`,
          headers,
          payload: { pinned: true },
        })
      ).statusCode,
      200,
    );
    let listed = await chats.list();
    assert.deepEqual(
      listed.map((chat) => chat.id),
      [middle.id, older.id, newer.id],
    );
    assert.equal(listed[0].pinned, true);
    assert.equal(listed[1].pinned, true);
    assert.equal(listed[2].pinned, undefined);

    const unpinOlder = await app.inject({
      method: "POST",
      url: `/v1/chats/${older.id}/pin`,
      headers,
      payload: { pinned: false },
    });
    assert.equal(unpinOlder.statusCode, 200);
    assert.deepEqual(unpinOlder.json(), { ok: true, pinned: false });
    listed = await chats.list();
    assert.deepEqual(
      listed.map((chat) => chat.id),
      [middle.id, newer.id, older.id],
    );
    assert.equal(
      listed.find((chat) => chat.id === older.id)?.pinned,
      undefined,
    );

    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${older.id}/pin`,
          headers,
          payload: { pinned: true },
        })
      ).json().pinned,
      true,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${older.id}/pin`,
          headers,
          payload: {},
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${older.id}/pin`,
          headers,
          payload: { pinned: true, extra: true },
        })
      ).statusCode,
      400,
    );
    const missing = await app.inject({
      method: "POST",
      url: `/v1/chats/${crypto.randomUUID()}/pin`,
      headers,
      payload: { pinned: true },
    });
    assert.equal(missing.statusCode, 400);
    assert.match(missing.json().error, /não encontrada/);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${older.id}/pin`,
          headers: { host: headers.host },
          payload: { pinned: false },
        })
      ).statusCode,
      401,
    );
    core.vault.lock();
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/v1/chats/${older.id}/pin`,
          headers,
          payload: { pinned: false },
        })
      ).statusCode,
      423,
    );
    await core.unlock("senha-teste-fixar-conversa");

    await app.close();
    app = undefined;
    await chats.close();
    await core.close();
    core = new Core(dir, resolve("."));
    await core.init();
    await core.unlock("senha-teste-fixar-conversa");
    chats = new Chats(core);
    listed = await chats.list();
    assert.deepEqual(
      listed.filter((chat) => chat.pinned).map((chat) => chat.id),
      [middle.id, older.id],
    );
    assert.equal(listed[0].id, middle.id);
    assert.equal(listed[0].title, "Meio");
    assert.equal(
      listed.find((chat) => chat.id === newer.id)?.pinned,
      undefined,
    );

    assert.deepEqual(await chats.pin(middle.id, false), {
      ok: true,
      pinned: false,
    });
    assert.deepEqual(await chats.pin(older.id, false), {
      ok: true,
      pinned: false,
    });
    assert.equal(
      (await chats.list()).some((chat) => chat.pinned),
      false,
    );
    assert.deepEqual(await chats.pin(newer.id, true), { ok: true, pinned: true });
    assert.equal((await chats.list())[0].id, newer.id);
    assert.equal((await chats.list())[0].pinned, true);
    assert.deepEqual(await chats.pin(newer.id, false), {
      ok: true,
      pinned: false,
    });
    assert.equal((await chats.list())[0].pinned, undefined);
    await assert.rejects(chats.pin(crypto.randomUUID(), true), /não encontrada/);
    core.vault.lock();
    await assert.rejects(chats.pin(newer.id, true), /bloqueado/);
  } finally {
    await chats.close();
    if (app) await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Editar a última mensagem substitui o texto e guarda a resposta anterior", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-edit-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-editar-chat");
  const seen: string[][] = [];
  let release = () => {};
  let gate = Promise.resolve();
  const chats = new Chats(core, async (_model, messages) => {
    seen.push(messages.map((message) => message.content));
    await gate;
    return "Resposta " + seen.length;
  });
  try {
    const { id } = await chats.create("edit-create-01");
    await chats.send(id, "local", "Primeira", "edit-send-0001");
    await chats.jobs.get(id)!.promise;
    await chats.send(id, "local", "Segunda", "edit-send-0002");
    await chats.jobs.get(id)!.promise;
    const before = (await chats.list())[0];
    assert.equal(before.messages.length, 4);
    assert.equal(before.title, "Primeira");
    const older = before.messages[0];
    const lastUser = before.messages[2];
    await assert.rejects(
      chats.send(
        id,
        "local",
        "Não esta",
        "edit-older-01",
        {},
        false,
        {},
        [],
        undefined,
        older.id,
      ),
      /última mensagem/,
    );
    assert.equal((await chats.list())[0].messages[0].content, "Primeira");
    assert.equal((await chats.list())[0].messages[2].content, "Segunda");
    assert.equal((await chats.list())[0].messages[1].versions, undefined);

    gate = new Promise((resolve) => {
      release = resolve;
    });
    const edited = await chats.send(
      id,
      "local",
      "Segunda revisada",
      "edit-replace-01",
      {},
      false,
      {},
      [],
      undefined,
      lastUser.id,
    );
    const pending = (await chats.list())[0];
    assert.equal(pending.messages.length, 4);
    assert.equal(pending.messages[0].id, older.id);
    assert.equal(pending.messages[0].content, "Primeira");
    assert.equal(pending.messages[1].content, "Resposta 1");
    assert.equal(pending.messages[1].versions, undefined);
    assert.equal(pending.messages[2].id, lastUser.id);
    assert.equal(pending.messages[2].content, "Segunda revisada");
    assert.equal(pending.messages[3].status, "pending");
    assert.equal(pending.messages[3].id, edited.message_id);
    assert.equal(pending.messages[3].versions?.length, 1);
    assert.equal(pending.messages[3].versions?.[0].content, "Resposta 2");
    assert.equal(pending.messages[3].versions?.[0].question, "Segunda");
    assert.equal(pending.title, "Primeira");
    await assert.rejects(
      chats.send(
        id,
        "local",
        "Durante a resposta",
        "edit-while-busy1",
        {},
        false,
        {},
        [],
        undefined,
        lastUser.id,
      ),
      /Aguarde/,
    );
    assert.equal((await chats.list())[0].messages.length, 4);
    assert.equal((await chats.list())[0].messages[3].versions?.length, 1);
    const job = chats.jobs.get(id)!.promise;
    release();
    await job;
    const saved = (await chats.list())[0];
    assert.equal(saved.messages.length, 4);
    assert.equal(saved.messages[0].content, "Primeira");
    assert.equal(saved.messages[1].content, "Resposta 1");
    assert.equal(saved.messages[2].content, "Segunda revisada");
    assert.equal(saved.messages[3].content, "Resposta 3");
    assert.equal(saved.messages[3].status, "complete");
    assert.equal(saved.messages[3].versions?.length, 1);
    assert.equal(saved.messages[3].versions?.[0].content, "Resposta 2");
    assert.equal(saved.messages[3].versions?.[0].question, "Segunda");
    assert.deepEqual(seen[2], ["Primeira", "Resposta 1", "Segunda revisada"]);
    const replay = await chats.send(
      id,
      "local",
      "Segunda revisada",
      "edit-replace-01",
      {},
      false,
      {},
      [],
      undefined,
      lastUser.id,
    );
    assert.equal(replay.message_id, edited.message_id);
    assert.equal(seen.length, 3);
    assert.equal((await chats.list())[0].messages[3].versions?.length, 1);
    await chats.send(
      id,
      "local",
      "Terceira",
      "edit-again-0001",
      {},
      false,
      {},
      [],
      undefined,
      lastUser.id,
    );
    await chats.jobs.get(id)!.promise;
    const twice = (await chats.list())[0];
    assert.equal(twice.messages.length, 4);
    assert.equal(twice.messages[0].content, "Primeira");
    assert.equal(twice.messages[2].content, "Terceira");
    assert.equal(twice.messages[3].content, "Resposta 4");
    assert.equal(twice.messages[3].versions?.[0].content, "Resposta 2");
    assert.equal(twice.messages[3].versions?.[0].question, "Segunda");
    assert.equal(twice.messages[3].versions?.[1].content, "Resposta 3");
    assert.equal(twice.messages[3].versions?.[1].question, "Segunda revisada");
  } finally {
    release();
    await chats.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("O servidor entrega /chat-edit.js para o módulo do Chat", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-edit-static-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-chat-estatico");
  const { app } = await createApp(
    core,
    "test-token",
    undefined,
    undefined,
    testConfig,
  );
  try {
    const response = await app.inject({
      method: "GET",
      url: "/chat-edit.js",
      headers: { host: "127.0.0.1:4317" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /javascript/);
    assert.match(response.body, /export function editButton/);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("O servidor entrega /chat-drop.js para soltar arquivos no Chat", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colmeia-chat-drop-static-"));
  const core = new Core(dir, resolve("."));
  await core.init();
  await core.setup("senha-teste-chat-estatico");
  const { app } = await createApp(
    core,
    "test-token",
    undefined,
    undefined,
    testConfig,
  );
  try {
    const response = await app.inject({
      method: "GET",
      url: "/chat-drop.js",
      headers: { host: "127.0.0.1:4317" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /javascript/);
    assert.match(response.body, /export function createChatDrop/);
    assert.match(response.body, /export function dragCarriesFiles/);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
