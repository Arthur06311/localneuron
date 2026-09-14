import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentReply } from "../src/agent.js";
import { Toolbox } from "../src/agent-tools.js";
import { optionsSchema } from "../src/inference.js";
import { Core } from "../src/core.js";
import { Chats } from "../src/chat.js";
test("Agente usa ferramenta real, reenvia resultado com papel tool e persiste atividade assinada", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colmeia-agent-"));
  const box = new Toolbox(directory),
    core = new Core(directory, process.cwd());
  await core.init();
  await core.setup("senha-ficticia-do-teste-05");
  const original = globalThis.fetch;
  let calls = 0;
  const runtime = {
    identity: () => ({
      application: "Colmeia",
      inference: "local",
      engine: "fixture",
      model: "fixture",
    }),
    backend: () => ({
      endpoint: "http://127.0.0.1:9999",
      headers: {},
      status: async () => ({
        models: ["fixture"],
        model_info: [],
        available_memory_bytes: 8 * 1024 ** 3,
        pressure_free_percent: null,
      }),
    }),
  } as any;
  globalThis.fetch = async (_url, input) => {
    const body = JSON.parse(String(input?.body));
    assert.match(
      body.messages[0].content,
      /Ambiente confirmado pelo aplicativo/,
    );
    assert.match(body.messages[0].content, /"inference":"local"/);
    calls++;
    let event: any;
    if (calls === 1) {
      assert.ok(
        body.tools.some((t: any) => t.function.name === "computer_info"),
      );
      event = {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call-fixture",
                  type: "function",
                  function: { name: "computer_info", arguments: "{}" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      };
    } else {
      assert.equal(body.messages.at(-1).role, "tool");
      assert.ok(JSON.parse(body.messages.at(-1).content).total_ram_bytes > 0);
      event = {
        choices: [
          {
            delta: { content: "Consultei a memória real." },
            finish_reason: "stop",
          },
        ],
      };
    }
    return new Response(
      "data: " + JSON.stringify(event) + "\n\ndata: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    );
  };
  try {
    const chats = new Chats(core, agentReply(runtime, box));
    const { id } = await chats.create("create-agent-test");
    await chats.send(
      id,
      "fixture",
      "Quanta RAM eu tenho?",
      "send-agent-test",
      {},
      false,
      {},
    );
    await Promise.all([...chats.jobs.values()].map((j) => j.promise));
    const result = (await chats.list())[0].messages.at(-1)!;
    assert.equal(result.status, "complete", result.error);
    assert.equal(result.content, "Consultei a memória real.");
    assert.equal(result.activities?.[0].status, "complete");
    assert.equal(calls, 2);
    assert.ok((await core.export()).manifest);
  } finally {
    globalThis.fetch = original;
    await core.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Modelo MLX sem parser nativo seleciona JSON automaticamente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colmeia-agent-json-"));
  const box = new Toolbox(directory);
  const original = globalThis.fetch;
  let calls = 0;
  const runtime = {
    identity: () => ({
      application: "Colmeia",
      inference: "local",
      engine: "fixture",
      model: "fixture",
    }),
    backend: () => ({
      endpoint: "http://127.0.0.1:9999",
      nativeTools: false,
      headers: {},
      status: async () => ({
        models: ["fixture"],
        model_info: [],
        available_memory_bytes: 8 * 1024 ** 3,
        pressure_free_percent: null,
      }),
    }),
  } as any;
  globalThis.fetch = async (_url, input) => {
    const body = JSON.parse(String(input?.body));
    assert.equal(body.tools, undefined);
    calls++;
    const content =
      calls === 1
        ? '{"tool":"computer_info","arguments":{}}'
        : "Consulta concluída.";
    return new Response(
      "data: " +
        JSON.stringify({
          choices: [{ delta: { content }, finish_reason: "stop" }],
        }) +
        "\n\ndata: [DONE]\n\n",
    );
  };
  try {
    const activity: any[] = [];
    const result = await agentReply(runtime, box)(
      "fixture",
      [
        {
          id: "user",
          role: "user",
          content: "Consulte meu computador.",
          at: Date.now(),
          status: "complete",
        },
      ],
      new AbortController().signal,
      () => {},
      optionsSchema.parse({}),
      {
        chatId: "test",
        access: {},
        activity: (a) => activity.push(a),
      },
    );
    assert.equal(
      typeof result === "string" ? result : result.text,
      "Consulta concluída.",
    );
    assert.equal(calls, 2);
    assert.ok(
      activity.some(
        (a) => a.tool === "computer_info" && a.status === "complete",
      ),
    );
  } finally {
    globalThis.fetch = original;
    await rm(directory, { recursive: true, force: true });
  }
});
