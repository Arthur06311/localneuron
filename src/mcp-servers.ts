import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { assertMcpUrl } from "./connections.js";
import { assertMcpResolved } from "./fetch-guard.js";
import type { ToolDefinition } from "./inference.js";
import { callMcpTool, McpHttpError, probeMcp, type McpToolInfo } from "./mcp-http.js";

const storedSchema = z.object({
  id: z.string().uuid(),
  url: z.string().trim().min(1).max(2048),
});
type Stored = z.infer<typeof storedSchema>;
const fileSchema = z.object({ servers: z.array(storedSchema).max(8) });
const documentSchema = z.object({
  chatId: z.string().uuid(),
  serverId: z.string().uuid(),
  at: z.number().int().nonnegative(),
  jogo: z.record(z.string(), z.unknown()),
});
type DocumentRow = z.infer<typeof documentSchema>;

type Live = {
  tools: McpToolInfo[];
  connected: boolean;
  error?: string;
  serverName: string;
  protocol: string;
};

const exposed = /^mcphttp_([a-f0-9]{32})_(\d+)$/;
const DOCUMENT_LIMIT = 180_000;

function atomic(path: string, value: unknown) {
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  renameSync(tmp, path);
}

function asDocument(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const json = JSON.stringify(value);
  if (json.length > DOCUMENT_LIMIT) return;
  return JSON.parse(json) as Record<string, unknown>;
}

export function mcpToolName(serverId: string, index: number) {
  return `mcphttp_${serverId.replaceAll("-", "")}_${index}`;
}

export class McpServers {
  private file: string;
  private documentsFile: string;
  private live = new Map<string, Live>();
  private attempted = new Set<string>();
  private documents: DocumentRow[] = [];
  constructor(directory: string) {
    this.file = join(directory, "mcp-servers.json");
    this.documentsFile = join(directory, "mcp-documents.json");
    this.documents = this.readDocuments();
  }
  private read(): Stored[] {
    if (!existsSync(this.file)) return [];
    return fileSchema.parse(JSON.parse(readFileSync(this.file, "utf8"))).servers;
  }
  private write(servers: Stored[]) {
    atomic(this.file, { servers });
  }
  private readDocuments(): DocumentRow[] {
    if (!existsSync(this.documentsFile)) return [];
    try {
      const parsed = z.array(documentSchema).max(40).parse(JSON.parse(readFileSync(this.documentsFile, "utf8")));
      return parsed.filter((row) => JSON.stringify(row.jogo).length <= DOCUMENT_LIMIT);
    } catch {
      return [];
    }
  }
  private writeDocuments() {
    atomic(this.documentsFile, this.documents.slice(-40));
  }
  private present(config: Stored) {
    const live = this.live.get(config.id);
    return {
      id: config.id,
      url: config.url,
      connected: live?.connected ?? false,
      ...(live?.error ? { error: live.error } : {}),
      ...(live?.serverName ? { server: live.serverName } : {}),
      ...(live?.protocol ? { protocol: live.protocol } : {}),
      tools: (live?.tools ?? []).map((tool) => ({ name: tool.name, description: tool.description })),
    };
  }
  list() {
    return this.read().map((config) => this.present(config));
  }
  private locate(name: string) {
    const match = exposed.exec(name);
    if (!match) return;
    const server = this.read().find((item) => item.id.replaceAll("-", "") === match[1]);
    const live = server ? this.live.get(server.id) : undefined;
    const tool = live?.tools[Number(match[2])];
    if (!server || !live?.connected || !tool) return;
    return { server, tool };
  }
  label(name: string) {
    return this.locate(name)?.tool.name || name;
  }
  definitions(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const config of this.read()) {
      const live = this.live.get(config.id);
      if (!live?.connected) continue;
      live.tools.forEach((tool, index) => {
        tools.push({
          type: "function",
          function: {
            name: mcpToolName(config.id, index),
            description: `${tool.name}: ${tool.description || "Ferramenta MCP"}`.slice(0, 500),
            parameters: tool.inputSchema,
          },
        });
      });
    }
    return tools.slice(0, 64);
  }
  private document(chatId: string, serverId: string) {
    return [...this.documents].reverse().find((row) => row.chatId === chatId && row.serverId === serverId)?.jogo;
  }
  private remember(chatId: string, serverId: string, jogo: Record<string, unknown>) {
    const parsed = z.string().uuid().safeParse(chatId);
    if (!parsed.success) return;
    this.documents = this.documents.filter((row) => !(row.chatId === chatId && row.serverId === serverId));
    this.documents.push({ chatId, serverId, at: Date.now(), jogo });
    this.documents = this.documents.slice(-40);
    this.writeDocuments();
  }
  private forget(serverId: string) {
    const next = this.documents.filter((row) => row.serverId !== serverId);
    if (next.length === this.documents.length) return;
    this.documents = next;
    this.writeDocuments();
  }
  async connect(id: string, timeoutMs = 12000, signal?: AbortSignal) {
    const config = this.read().find((item) => item.id === id);
    if (!config) throw new Error("Servidor MCP não encontrado.");
    this.attempted.add(id);
    assertMcpUrl(config.url);
    await assertMcpResolved(new URL(config.url), false, lookup);
    const live: Live = { tools: [], connected: false, serverName: "", protocol: "" };
    this.live.set(id, live);
    try {
      const probe = await probeMcp(config.url, timeoutMs, signal);
      if (!this.read().some((item) => item.id === id)) throw new Error("Servidor MCP removido.");
      live.tools = probe.tools;
      live.connected = true;
      live.serverName = probe.serverName;
      live.protocol = probe.protocolVersion;
    } catch (error) {
      live.connected = false;
      live.tools = [];
      live.error = (error instanceof McpHttpError ? error.message : (error as Error).message).slice(0, 300);
    }
    const current = this.read().find((item) => item.id === id);
    if (!current) {
      this.live.delete(id);
      throw new Error("Servidor MCP não encontrado.");
    }
    return this.present(current);
  }
  async prepare(signal?: AbortSignal) {
    const pending = this.read().filter((item) => !this.attempted.has(item.id));
    await Promise.all(pending.map((item) => this.connect(item.id, 12000, signal).catch(() => {})));
  }
  async add(input: unknown) {
    const url = z.strictObject({ url: z.string().trim().min(1).max(2048) }).parse(input).url;
    assertMcpUrl(url);
    await assertMcpResolved(new URL(url), false, lookup);
    const servers = this.read();
    if (servers.length >= 8) throw new Error("Limite de 8 servidores MCP.");
    if (servers.some((item) => item.url === url)) throw new Error("Este servidor já está na lista.");
    const row = { id: randomUUID(), url };
    this.write([...servers, row]);
    return this.connect(row.id);
  }
  async test(id: string) {
    return this.connect(id);
  }
  async remove(id: string) {
    const servers = this.read();
    if (!servers.some((item) => item.id === id)) throw new Error("Servidor MCP não encontrado.");
    this.write(servers.filter((item) => item.id !== id));
    this.live.delete(id);
    this.attempted.delete(id);
    this.forget(id);
    return { ok: true };
  }
  async call(name: string, raw: unknown, chatId: string, signal: AbortSignal) {
    const located = this.locate(name);
    if (!located) throw new Error("Servidor MCP desconectado ou ferramenta indisponível. Teste a conexão.");
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Argumentos da ferramenta inválidos.");
    const args = raw as Record<string, unknown>;
    if (JSON.stringify(args).length > 100_000) throw new Error("Argumentos da ferramenta grandes demais.");
    assertMcpUrl(located.server.url);
    await assertMcpResolved(new URL(located.server.url), false, lookup);
    const jogo = this.document(chatId, located.server.id);
    const result = await callMcpTool(located.server.url, located.tool.name, args, {
      timeoutMs: 20000,
      signal,
      jogo,
    });
    const next = asDocument(result.jogo);
    if (next) this.remember(chatId, located.server.id, next);
    return {
      tool: located.tool.name,
      text: result.text || (result.isError ? "O servidor recusou a ferramenta." : "Sem texto."),
      isError: result.isError,
      documentUpdated: Boolean(next),
    };
  }
}
