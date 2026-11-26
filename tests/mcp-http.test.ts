import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { agentReply } from "../src/agent.js";
import { Toolbox } from "../src/agent-tools.js";
import { optionsSchema } from "../src/inference.js";
import { callMcpTool, McpHttpError, probeMcp } from "../src/mcp-http.js";
import { McpServers } from "../src/mcp-servers.js";

type Body = { method?: string; id?: unknown; params?: Record<string, unknown> };

async function readJson(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}") as Body;
}

function reply(res: import("node:http").ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function listen(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { port, url: `http://127.0.0.1:${port}/api/mcp` };
}

async function close(server: ReturnType<typeof createServer>) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

const jogoTool = {
  name: "jogo.definir",
  description: "Cria a ficha do jogo.",
  inputSchema: { type: "object", properties: { titulo: { type: "string" } } },
};

test("lista as ferramentas depois de initialize", async () => {
  const seen: string[] = [];
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    seen.push(String(body.method));
    if (body.method === "notifications/initialized") return reply(res, 200, { jsonrpc: "2.0", id: null, result: {} });
    if (body.method === "initialize")
      return reply(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: { protocolVersion: "2024-11-05", serverInfo: { name: "neuralgames-mcp" }, instructions: "teste" },
      });
    if (body.method === "tools/list")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { tools: [jogoTool] } });
    return reply(res, 200, { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "método" } });
  });
  const { url } = await listen(server);
  try {
    const probe = await probeMcp(url, 2000);
    assert.equal(probe.serverName, "neuralgames-mcp");
    assert.equal(probe.tools.length, 1);
    assert.equal(probe.tools[0].name, "jogo.definir");
    assert.deepEqual(seen, ["initialize", "notifications/initialized", "tools/list"]);
  } finally {
    await close(server);
  }
});

test("uma chamada devolve o texto e a seguinte reenvia o documento", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neuron-mcp-ok-"));
  const seen: Body[] = [];
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    seen.push(body);
    if (body.method === "notifications/initialized") return reply(res, 200, { jsonrpc: "2.0", id: null, result: {} });
    if (body.method === "initialize")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "fixture" } } });
    if (body.method === "tools/list")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { tools: [jogoTool] } });
    const titulo = String((body.params?.arguments as { titulo?: string } | undefined)?.titulo || "");
    const anterior = (body.params?.jogo as { titulo?: string } | undefined)?.titulo;
    const jogo = { titulo, anterior: anterior || "" };
    return reply(res, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: { content: [{ type: "text", text: `ficha ${titulo}` }], structuredContent: { jogo }, isError: false },
    });
  });
  const { url } = await listen(server);
  const registry = new McpServers(directory);
  try {
    assert.deepEqual(registry.list(), []);
    const added = await registry.add({ url });
    assert.equal(added.connected, true);
    assert.equal(added.tools[0].name, "jogo.definir");
    const chat = randomUUID();
    const name = registry.definitions()[0].function.name;
    const first = await registry.call(name, { titulo: "Pulo" }, chat, AbortSignal.timeout(2000));
    const second = await registry.call(name, { titulo: "Pulo 2" }, chat, AbortSignal.timeout(2000));
    assert.equal(first.text, "ficha Pulo");
    assert.equal(first.documentUpdated, true);
    assert.equal(second.text, "ficha Pulo 2");
    const calls = seen.filter((body) => body.method === "tools/call");
    assert.equal(calls[0].params?.jogo, undefined);
    assert.equal((calls[1].params?.jogo as { titulo?: string }).titulo, "Pulo");
    const restored = new McpServers(directory);
    assert.equal(restored.list()[0].url, url);
    assert.equal(restored.list()[0].connected, false);
    await restored.test(added.id);
    const third = await restored.call(restored.definitions()[0].function.name, { titulo: "Pulo 3" }, chat, AbortSignal.timeout(2000));
    assert.equal(third.text, "ficha Pulo 3");
    const last = seen.filter((body) => body.method === "tools/call").at(-1);
    assert.equal((last?.params?.jogo as { titulo?: string }).titulo, "Pulo 2");
    await registry.remove(added.id);
    assert.deepEqual(registry.list(), []);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("erro do servidor MCP chega com a mensagem", async () => {
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    reply(res, 200, { jsonrpc: "2.0", id: body.id ?? null, error: { code: -32603, message: "falha de teste" } });
  });
  const { url } = await listen(server);
  try {
    await assert.rejects(callMcpTool(url, "jogo.definir", {}, { timeoutMs: 2000 }), (error: unknown) => {
      assert.ok(error instanceof McpHttpError);
      assert.equal(error.kind, "rpc");
      assert.equal(error.message, "falha de teste");
      return true;
    });
  } finally {
    await close(server);
  }
});

test("tempo esgotado não fica esperando", { timeout: 5000 }, async () => {
  const server = createServer(() => {});
  const { url } = await listen(server);
  try {
    await assert.rejects(probeMcp(url, 80), (error: unknown) => {
      assert.ok(error instanceof McpHttpError);
      assert.equal(error.kind, "timeout");
      assert.match(error.message, /não respondeu a tempo/);
      return true;
    });
  } finally {
    await close(server);
  }
});

test("servidor inalcançável explica a falha", async () => {
  const server = createServer((_req, res) => res.end("ok"));
  const { url } = await listen(server);
  await close(server);
  await assert.rejects(probeMcp(url, 1000), (error: unknown) => {
    assert.ok(error instanceof McpHttpError);
    assert.equal(error.kind, "unreachable");
    assert.match(error.message, /Não foi possível alcançar/);
    return true;
  });
});

function runtime(nativeTools?: boolean) {
  return {
    identity: () => ({ application: "LocalNeuron", inference: "local", engine: "fixture", model: "fixture" }),
    backend: () => ({
      endpoint: "http://127.0.0.1:9",
      headers: {},
      ...(nativeTools === false ? { nativeTools: false } : {}),
      status: async () => ({
        models: ["fixture"],
        model_info: [],
        available_memory_bytes: 8 * 1024 ** 3,
        pressure_free_percent: null,
      }),
    }),
  } as any;
}

function modelResponse(payload: unknown) {
  return new Response("data: " + JSON.stringify(payload) + "\n\ndata: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream" },
  });
}

test("o Chat mostra a chamada e o resultado da ferramenta", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neuron-mcp-chat-"));
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    if (body.method === "notifications/initialized") return reply(res, 200, { jsonrpc: "2.0", id: null, result: {} });
    if (body.method === "initialize")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "fixture" } } });
    if (body.method === "tools/list")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { tools: [jogoTool] } });
    return reply(res, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: { content: [{ type: "text", text: "prévia em /jogar/abc" }], isError: false },
    });
  });
  const { url, port } = await listen(server);
  const registry = new McpServers(directory);
  const box = new Toolbox(directory);
  box.mcpServers = registry;
  const added = await registry.add({ url });
  const tool = registry.definitions()[0].function.name;
  const original = globalThis.fetch;
  let modelCalls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith(`http://127.0.0.1:${port}`)) return original(input, init);
    const body = JSON.parse(String(init?.body));
    modelCalls += 1;
    if (modelCalls === 1) {
      assert.ok(body.tools.some((item: { function: { name: string } }) => item.function.name === tool));
      assert.match(body.messages[0].content, /mcphttp_/);
      return modelResponse({
        choices: [{
          delta: { tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: tool, arguments: '{"titulo":"Pulo"}' } }] },
          finish_reason: "tool_calls",
        }],
      });
    }
    assert.equal(body.messages.at(-1).role, "tool");
    assert.match(body.messages.at(-1).content, /prévia em \/jogar\/abc/);
    return modelResponse({ choices: [{ delta: { content: "Abra /jogar/abc no NeuralGames." }, finish_reason: "stop" }] });
  };
  const activities: { tool: string; status: string; detail?: string; label: string }[] = [];
  try {
    const result = await agentReply(runtime(), box)(
      "fixture",
      [{ id: "user", role: "user", content: "Crie um jogo simples.", at: Date.now(), status: "complete" }],
      AbortSignal.timeout(5000),
      () => {},
      optionsSchema.parse({}),
      {
        chatId: randomUUID(),
        access: { enabled: true, computer: false, web: false, files: false, terminal: false, readOnly: false, format: "native" },
        activity: (value) => activities.push(value),
      },
    );
    assert.equal(typeof result === "string" ? result : result.text, "Abra /jogar/abc no NeuralGames.");
    const done = activities.find((item) => item.status === "complete");
    assert.equal(done?.label, "jogo.definir");
    assert.match(done?.detail || "", /jogo\.definir/);
    assert.match(done?.detail || "", /prévia em \/jogar\/abc/);
    assert.equal(added.connected, true);
  } finally {
    globalThis.fetch = original;
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("modelo sem chamada de ferramenta avisa em vez de falhar em silêncio", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neuron-mcp-unsupported-"));
  let calls = 0;
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    if (body.method === "tools/call") calls += 1;
    if (body.method === "notifications/initialized") return reply(res, 200, { jsonrpc: "2.0", id: null, result: {} });
    if (body.method === "initialize")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "fixture" } } });
    if (body.method === "tools/list")
      return reply(res, 200, { jsonrpc: "2.0", id: body.id, result: { tools: [jogoTool] } });
    return reply(res, 500, { jsonrpc: "2.0", id: body.id, error: { code: -32603, message: "não deveria chamar" } });
  });
  const { url } = await listen(server);
  const registry = new McpServers(directory);
  const box = new Toolbox(directory);
  box.mcpServers = registry;
  await registry.add({ url });
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.tools, undefined);
    assert.doesNotMatch(body.messages[0].content, /mcphttp_/);
    return modelResponse({ choices: [{ delta: { content: "Posso responder em texto." }, finish_reason: "stop" }] });
  };
  const activities: { tool: string }[] = [];
  try {
    const result = await agentReply(runtime(false), box)(
      "fixture",
      [{ id: "user", role: "user", content: "Crie um jogo.", at: Date.now(), status: "complete" }],
      AbortSignal.timeout(5000),
      () => {},
      optionsSchema.parse({}),
      {
        chatId: randomUUID(),
        access: { enabled: true, computer: false, web: false, files: false, terminal: false, readOnly: false, format: "native" },
        activity: (value) => activities.push(value),
      },
    );
    assert.equal(typeof result === "string" ? result : result.text, "Posso responder em texto.");
    assert.ok(activities.some((item) => item.tool === "mcp_unsupported"));
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});
