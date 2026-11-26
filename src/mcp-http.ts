export type McpFailure = "timeout" | "unreachable" | "http" | "rpc" | "protocol";

export class McpHttpError extends Error {
  readonly kind: McpFailure;
  constructor(message: string, kind: McpFailure) {
    super(message);
    this.name = "McpHttpError";
    this.kind = kind;
  }
}

export type McpToolInfo = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpProbe = {
  protocolVersion: string;
  serverName: string;
  instructions: string;
  tools: McpToolInfo[];
};

export type McpCallResult = {
  text: string;
  isError: boolean;
  jogo?: unknown;
};

const MAX_BODY = 1_000_000;
let rpcId = 0;

function timeoutSignal(timeoutMs: number) {
  return AbortSignal.timeout(Math.max(1, timeoutMs));
}

function failure(error: unknown, timeout: AbortSignal, parent?: AbortSignal): McpHttpError {
  if (parent?.aborted) throw error;
  if (timeout.aborted) return new McpHttpError("O servidor MCP não respondeu a tempo.", "timeout");
  const code = (error as { cause?: { code?: string } }).cause?.code ?? "";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT")
    return new McpHttpError("O servidor MCP não respondeu a tempo.", "timeout");
  return new McpHttpError("Não foi possível alcançar o servidor MCP.", "unreachable");
}

async function readBody(response: Response) {
  const text = await response.text();
  if (text.length > MAX_BODY) throw new McpHttpError("Resposta MCP grande demais.", "protocol");
  return text;
}

export async function mcpRpc(
  url: string,
  method: string,
  params: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
  notification = false,
): Promise<unknown> {
  const timeout = timeoutSignal(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const body = notification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: (rpcId += 1), method, params };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: combined,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw failure(error, timeout, signal);
  }
  if (notification) {
    await response.body?.cancel().catch(() => {});
    if (!response.ok && response.status !== 202)
      throw new McpHttpError(`O servidor MCP respondeu HTTP ${response.status}.`, "http");
    return {};
  }
  const text = await readBody(response);
  if (!response.ok) throw new McpHttpError(`O servidor MCP respondeu HTTP ${response.status}.`, "http");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new McpHttpError("Resposta MCP inválida.", "protocol");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new McpHttpError("Resposta MCP inválida.", "protocol");
  const record = payload as { jsonrpc?: unknown; error?: { message?: unknown }; result?: unknown };
  if (record.jsonrpc !== "2.0") throw new McpHttpError("Resposta MCP inválida.", "protocol");
  if (record.error) {
    const message = typeof record.error.message === "string" ? record.error.message : "Erro do servidor MCP.";
    throw new McpHttpError(message.slice(0, 300), "rpc");
  }
  return record.result;
}

function toolInfo(value: unknown): McpToolInfo | undefined {
  if (!value || typeof value !== "object") return;
  const tool = value as { name?: unknown; description?: unknown; inputSchema?: unknown };
  if (typeof tool.name !== "string" || !/^[\w.-]{1,80}$/.test(tool.name)) return;
  const schema =
    tool.inputSchema && typeof tool.inputSchema === "object" && !Array.isArray(tool.inputSchema)
      ? (tool.inputSchema as Record<string, unknown>)
      : { type: "object", properties: {} };
  const compact = JSON.stringify(schema).length > 8000 ? { type: "object", properties: {} } : schema;
  return {
    name: tool.name,
    description: typeof tool.description === "string" ? tool.description.slice(0, 400) : "",
    inputSchema: compact,
  };
}

export async function probeMcp(url: string, timeoutMs: number, signal?: AbortSignal): Promise<McpProbe> {
  const initialized = await mcpRpc(
    url,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "LocalNeuron", version: "0.28.1" },
    },
    timeoutMs,
    signal,
  );
  if (!initialized || typeof initialized !== "object") throw new McpHttpError("Resposta MCP inválida.", "protocol");
  const info = initialized as {
    protocolVersion?: unknown;
    serverInfo?: { name?: unknown };
    instructions?: unknown;
  };
  if (typeof info.protocolVersion !== "string" || !info.protocolVersion)
    throw new McpHttpError("O servidor não informou a versão do protocolo.", "protocol");
  try {
    await mcpRpc(url, "notifications/initialized", {}, Math.min(timeoutMs, 4000), signal, true);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof McpHttpError && (error.kind === "timeout" || error.kind === "unreachable")) throw error;
  }
  const listed = await mcpRpc(url, "tools/list", {}, timeoutMs, signal);
  const tools = (listed as { tools?: unknown })?.tools;
  if (!listed || typeof listed !== "object" || !Array.isArray(tools))
    throw new McpHttpError("O servidor não listou ferramentas.", "protocol");
  return {
    protocolVersion: info.protocolVersion.slice(0, 40),
    serverName: typeof info.serverInfo?.name === "string" ? info.serverInfo.name.slice(0, 80) : "",
    instructions: typeof info.instructions === "string" ? info.instructions.slice(0, 500) : "",
    tools: tools.map(toolInfo).filter((tool): tool is McpToolInfo => Boolean(tool)).slice(0, 64),
  };
}

export async function callMcpTool(
  url: string,
  name: string,
  args: Record<string, unknown>,
  options: { timeoutMs: number; signal?: AbortSignal; jogo?: unknown },
): Promise<McpCallResult> {
  const params: Record<string, unknown> = { name, arguments: args };
  if (options.jogo !== undefined) params.jogo = options.jogo;
  const result = await mcpRpc(url, "tools/call", params, options.timeoutMs, options.signal);
  if (!result || typeof result !== "object") throw new McpHttpError("Resposta MCP inválida.", "protocol");
  const record = result as { content?: unknown; isError?: unknown; structuredContent?: unknown };
  const content = Array.isArray(record.content) ? record.content : [];
  const text = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const value = (item as { text?: unknown }).text;
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
  const structured = record.structuredContent;
  const jogo =
    structured && typeof structured === "object" && "jogo" in structured
      ? (structured as { jogo?: unknown }).jogo
      : undefined;
  return { text, isError: record.isError === true, ...(jogo !== undefined ? { jogo } : {}) };
}
