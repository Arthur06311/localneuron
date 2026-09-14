import { z } from "zod";
import { localModels } from "./model.js";
export const optionsSchema = z.strictObject({
  context: z.number().int().min(2048).max(131072).default(16384),
  max_tokens: z.number().int().min(1).max(32768).default(8192),
  temperature: z.number().min(0).max(2).default(0.7),
  top_p: z.number().min(0.01).max(1).default(0.95),
  reasoning: z.enum(["auto", "off", "low", "medium", "high"]).default("auto"),
  system: z
    .string()
    .max(16000)
    .default(
      "Você é um assistente prestativo. Responda em português, salvo pedido em outro idioma. Desenvolva sua resposta conforme a pergunta. Reconheça incertezas. Use Markdown quando ajudar a leitura.",
    ),
});
export type GenerationOptions = z.infer<typeof optionsSchema>;
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
export type Backend = {
  model?: string;
  endpoint: string;
  headers: Record<string, string>;
  integrated?: boolean;
  nativeTools?: boolean;
  status: typeof localModels;
};
export type Step = Omit<Generation, "finish_reason"> & {
  finish_reason: "stop" | "length" | "tool_calls";
  tool_calls?: ToolCall[];
};
export type Generation = {
  text: string;
  finish_reason: "stop" | "length";
  prompt_tokens?: number;
  completion_tokens?: number;
  elapsed_ms: number;
  review_ms?: number;
  omitted_messages: number;
  context: number;
};
export const estimateTokens = (text: string) =>
  Math.ceil(Buffer.byteLength(text, "utf8") / 3) + 8;
export function contextWindow(
  messages: Message[],
  options: GenerationOptions,
  effectiveContext?: number | null,
  toolTokens = 0,
) {
  const context = Math.min(
    options.context,
    Number.isSafeInteger(effectiveContext) && effectiveContext! > 0
      ? effectiveContext!
      : options.context,
  );
  const output = Math.min(options.max_tokens, Math.floor(context / 2));
  const system = messages.filter((m) => m.role === "system");
  const turns = messages.filter((m) => m.role !== "system");
  let budget =
    context -
    toolTokens -
    output -
    128 -
    system.reduce(
      (sum, m) =>
        sum +
        estimateTokens(
          m.content + (m.tool_calls ? JSON.stringify(m.tool_calls) : ""),
        ),
      0,
    );
  const kept: Message[] = [];
  // Retain whole recent turns so an assistant answer never loses its question.
  for (let i = turns.length - 1; i >= 0;) {
    let start = i;
    while (start > 0 && turns[start].role !== "user") start--;
    const group = turns.slice(start, i + 1),
      cost = group.reduce(
        (sum, m) =>
          sum +
          estimateTokens(
            m.content + (m.tool_calls ? JSON.stringify(m.tool_calls) : ""),
          ),
        0,
      );
    if (cost > budget) {
      if (!kept.length)
        throw new Error(
          "A mensagem não cabe no contexto selecionado. Aumente o contexto ou reduza o texto.",
        );
      break;
    }
    kept.unshift(...group);
    budget -= cost;
    i = start - 1;
  }
  if (budget < 0 || !kept.length)
    throw new Error("Contexto insuficiente para as instruções e a mensagem.");
  return {
    messages: [...system, ...kept],
    max_tokens: output,
    context,
    omitted_messages: turns.length - kept.length,
  };
}
export async function inferenceStep(
  model: string,
  messages: Message[],
  options: GenerationOptions,
  signal: AbortSignal,
  delta: (text: string, phase?: string) => void,
  backend?: Backend,
  tools?: ToolDefinition[],
): Promise<Step> {
  const status = await (backend?.status || localModels)();
  if (!status.models.includes(model))
    throw new Error(
      "Prepare a IA antes de conversar. Ela pode ter sido liberada da memória.",
    );
  if (
    status.available_memory_bytes < 256 * 1024 ** 2 ||
    (status.pressure_free_percent !== null && status.pressure_free_percent < 3)
  )
    throw new Error(
      "A memória do computador está no limite. Libere uma IA ou feche outros aplicativos.",
    );
  const window = contextWindow(
    messages,
    options,
    status.model_info.find((m) => m.id === model)?.context_length,
    tools?.length ? estimateTokens(JSON.stringify(tools)) : 0,
  );
  const body = {
    model: backend?.model || model,
    messages: window.messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: options.temperature,
    top_p: options.top_p,
    max_tokens: window.max_tokens,
    ...(options.reasoning === "auto"
      ? {}
      : {
          reasoning_effort:
            options.reasoning === "off" ? "none" : options.reasoning,
        }),
    chat_template_kwargs: { enable_thinking: options.reasoning !== "off" },
    ...(tools?.length
      ? { tools, tool_choice: "auto", parallel_tool_calls: false }
      : {}),
    ...(backend?.integrated
      ? {
          cache_prompt: true,
          reasoning_budget: Math.min(Math.floor(window.max_tokens / 2),
            options.reasoning === "off" ? 0 : options.reasoning === "low" ? 512 : options.reasoning === "high" ? 4096 : 1536),
        }
      : {}),
  };
  const started = Date.now();
  const combined = AbortSignal.any([
    signal,
    AbortSignal.timeout(20 * 60 * 1000),
  ]);
  const response = await fetch(
    (backend?.endpoint || "http://127.0.0.1:8080") + "/v1/chat/completions",
    {
      method: "POST",
      redirect: "error",
      signal: combined,
      headers: { "content-type": "application/json", ...backend?.headers },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    let detail = "Confira o contexto ou tente o raciocínio Padrão do modelo.";
    if (backend?.integrated) {
      try {
        const error = (await response.json()) as { error?: unknown };
        if (typeof error.error === "string") detail = error.error.slice(0, 600);
      } catch {}
    }
    throw new Error(`A IA retornou HTTP ${response.status}. ${detail}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Resposta vazia do motor.");
  const decoder = new TextDecoder();
  let buffer = "",
    text = "",
    bytes = 0,
    done = false,
    finish: "stop" | "length" | "tool_calls" | null = null,
    usage: any = {};
  const calls = new Map<number, ToolCall>();
  try {
    for (;;) {
      combined.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16 * 1024 * 1024)
        throw new Error("O motor excedeu o limite de segurança da resposta.");
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        if (data === "[DONE]") {
          done = true;
          continue;
        }
        if (done) throw new Error("Resposta fora de ordem.");
        const event = JSON.parse(data);
        if (event.error)
          throw new Error(
            "O motor interrompeu a resposta. Tente reduzir o contexto.",
          );
        if (event.usage) usage = event.usage;
        const choice = event.choices?.[0];
        if (!choice) continue;
        if (choice.delta?.reasoning_content || choice.delta?.reasoning)
          delta(text, "thinking");
        if (typeof choice.delta?.content === "string") {
          text += choice.delta.content;
          if (text.length > 524288) throw new Error("Resposta grande demais.");
          delta(text, "answering");
        }
        if (choice.delta?.tool_calls) {
          if (!tools?.length)
            throw new Error(
              "Este chat aceita respostas de texto; chamadas de ferramentas não são executadas.",
            );
          for (const item of choice.delta.tool_calls) {
            if (
              !Number.isInteger(item.index) ||
              item.index < 0 ||
              item.index > 7
            )
              throw new Error("Índice de ferramenta inválido.");
            const call = calls.get(item.index) || {
              id: "",
              type: "function" as const,
              function: { name: "", arguments: "" },
            };
            if (item.id) call.id += item.id;
            if (item.function?.name) call.function.name += item.function.name;
            if (item.function?.arguments)
              call.function.arguments += item.function.arguments;
            if (
              call.function.arguments.length > 131072 ||
              call.function.name.length > 100 ||
              call.id.length > 200
            )
              throw new Error("Chamada de ferramenta grande demais.");
            calls.set(item.index, call);
          }
        }
        if (choice.finish_reason) {
          if (
            ![
              "stop",
              "length",
              ...(tools?.length ? ["tool_calls"] : []),
            ].includes(choice.finish_reason)
          )
            throw new Error(
              "Este chat aceita respostas de texto; chamadas de ferramentas não são executadas.",
            );
          finish = choice.finish_reason;
        }
      }
      if (buffer.length > 1048576)
        throw new Error("Evento do motor grande demais.");
    }
    combined.throwIfAborted();
    if (!done || !finish)
      throw new Error(
        "Conexão interrompida. O trecho recebido foi preservado.",
      );
    if (
      finish === "tool_calls" &&
      (!calls.size ||
        [...calls.values()].some((c) => !c.id || !c.function.name))
    )
      throw new Error("Chamada de ferramenta incompleta.");
    if (!text.trim() && finish !== "tool_calls")
      throw new Error(
        "A IA consumiu a resposta sem produzir texto final. Aumente o limite de saída ou use outro nível de raciocínio.",
      );
    return {
      text,
      finish_reason: finish,
      ...(calls.size ? { tool_calls: [...calls.values()] } : {}),
      elapsed_ms: Date.now() - started,
      omitted_messages: window.omitted_messages,
      context: window.context,
      ...(Number.isSafeInteger(usage.prompt_tokens) && usage.prompt_tokens >= 0
        ? { prompt_tokens: usage.prompt_tokens }
        : {}),
      ...(Number.isSafeInteger(usage.completion_tokens) &&
      usage.completion_tokens >= 0
        ? { completion_tokens: usage.completion_tokens }
        : {}),
    };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function complete(
  model: string,
  messages: Message[],
  options: GenerationOptions,
  signal: AbortSignal,
  delta: (text: string, phase?: string) => void,
  backend?: Backend,
): Promise<Generation> {
  const step = await inferenceStep(
    model,
    messages,
    options,
    signal,
    delta,
    backend,
  );
  if (step.finish_reason === "tool_calls")
    throw new Error("Ferramentas não habilitadas nesta chamada.");
  const { tool_calls, ...result } = step;
  return { ...result, finish_reason: step.finish_reason };
}
