import { attachmentSchema, chatContext } from "./chat-context.js";
import type { Execution } from "./agent.js";
import { accessSchema, type Activity } from "./agent-tools.js";
import { randomUUID } from "node:crypto";
import { Core } from "./core.js";
import {
  complete,
  optionsSchema,
  type GenerationOptions,
  type Generation,
} from "./inference.js";
import type { Chat, ChatMessage } from "./types.js";

export type Reply = (
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  delta: (text: string, phase?: string) => void,
  options?: GenerationOptions,
  execution?: Execution,
) => Promise<string | Generation>;
export const localReply: Reply = async (
  model,
  messages,
  signal,
  delta,
  settings,
) => {
  const options = optionsSchema.parse(settings || {});
  return complete(
    model,
    [
      { role: "system", content: options.system },
      ...messages.map(({ role, content }) => ({ role, content })),
    ],
    options,
    signal,
    delta,
  );
};

type Job = {
  controller: AbortController;
  promise: Promise<void>;
  content: string;
  replyId: string;
  phase?: string;
  activities: Activity[];
};
export class Chats {
  jobs = new Map<string, Job>();
  constructor(
    private core: Core,
    private reply: Reply = localReply,
  ) {}
  get busy() {
    return this.jobs.size > 0;
  }
  async recover() {
    await this.core.store.tx((state, entries) => {
      if (!state || this.core.vault.locked) throw new Error("Cofre bloqueado");
      for (const chat of state.chats ?? [])
        if (!this.jobs.has(chat.id))
          for (const message of chat.messages)
            if (message.status === "pending") {
              message.status = "stopped";
              message.error =
                "Resposta interrompida ao fechar o aplicativo. Envie uma nova mensagem para continuar.";
              this.core.append(
                state,
                entries,
                "chat.recovered",
                { chat_id: chat.id, message_id: message.id },
                "service",
              );
            }
    });
  }
  async list() {
    const state = await this.core.snapshot();
    return (state.chats ?? []).map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) => ({
        ...message,
        ...(this.jobs.get(chat.id)?.replyId === message.id
          ? {
              phase: this.jobs.get(chat.id)?.phase,
              activities: this.jobs.get(chat.id)?.activities,
            }
          : {}),
        content:
          this.jobs.get(chat.id)?.replyId === message.id
            ? this.jobs.get(chat.id)!.content
            : message.content,
      })),
    }));
  }
  async create(key: string, metadata: {bot_id?:string;preferred_model?:string} = {}) {
    if (this.core.vault.locked) throw new Error("Cofre bloqueado");
    return this.core.idempotent(
      key,
      { operation: "chat.create", ...metadata },
      (state, entries) => {
        if(metadata.bot_id&&!state.experience?.bots.some(b=>b.id===metadata.bot_id))throw Error("Bot não encontrado.");
        const chat: Chat = {
          ...metadata,
          id: randomUUID(),
          title: "Nova conversa",
          at: Date.now(),
          messages: [],
        };
        (state.chats ??= []).unshift(chat);
        this.core.append(state, entries, "chat.created", { id: chat.id });
        return { id: chat.id };
      },
    );
  }
  async send(
    id: string,
    model: string,
    content: string,
    key: string,
    settings?: unknown,
    retry = false,
    toolAccess?: unknown,
    attachmentValues: unknown[] = [],
    modelKey?: string,
  ) {
    if (this.core.vault.locked) throw new Error("Cofre bloqueado");
    const options = optionsSchema.parse(settings || {}),
      access = accessSchema.parse(toolAccess || {});
    if (attachmentValues.length > 4)
      throw Error("Use até quatro anexos por mensagem.");
    const attachments = attachmentValues.map((a) => attachmentSchema.parse(a));
    if (retry && attachments.length)
      throw Error("Gerar novamente usa os anexos da mensagem original.");
    let fresh = false;
    const result = await this.core.idempotent(
      key,
      {
        operation: "chat.send",
        ...(modelKey?{model_key:modelKey}:{}),
        id,
        model,
        content,
        options_json: JSON.stringify(options),
        access_json: JSON.stringify(access),
        attachments_json: JSON.stringify(attachments),
        retry,
      },
      (state, entries) => {
        const chat = state.chats?.find((c) => c.id === id);
        if (!chat) throw new Error("Conversa não encontrada");
        chat.preferred_model=modelKey||model;
        if(chat.bot_id){const bot=state.experience?.bots.find(b=>b.id===chat.bot_id);if(!bot)throw Error("Bot não encontrado.");options.system=[bot.instructions,bot.memory?"Memória exclusiva deste bot: "+bot.memory:"",options.system].filter(Boolean).join("\n").slice(0,12000);for(const permission of ['web','computer','files','terminal','enabled'] as const)access[permission]=access[permission]&&bot.access[permission];access.readOnly=access.readOnly||bot.access.readOnly;}

        if (
          this.busy ||
          state.chats?.some((c) =>
            c.messages.some((m) => m.status === "pending"),
          )
        )
          throw new Error("Aguarde a resposta atual ou clique em Parar.");
        if (state.tasks.some((task) => task.state === "running"))
          throw new Error("Pause a entrega em andamento antes de conversar.");
        if (
          chat.messages.length >= 2000 ||
          JSON.stringify(chat).length +
            JSON.stringify(attachments).length +
            content.length >
            8 * 1024 * 1024
        )
          throw new Error(
            "Esta conversa atingiu o limite de armazenamento. Exporte-a e comece outra.",
          );
        if (
          retry &&
          (!chat.messages.length || chat.messages.at(-1)?.role !== "assistant")
        )
          throw new Error("Nenhuma resposta disponível para gerar novamente.");
        const user: ChatMessage = {
          id: randomUUID(),
          role: "user",
          ...(attachments.length ? { attachments } : {}),
          content,
          at: Date.now(),
          status: "complete",
        };
        const answer: ChatMessage = {
          id: randomUUID(),
          role: "assistant",
          content: "",
          model,
          options_json: JSON.stringify(options),
          access_json: JSON.stringify(access),
          at: Date.now(),
          status: "pending",
        };
        if (retry) {
          const previous = chat.messages.pop()!;
          const { versions, ...last } = previous;
          answer.versions = [...(versions || []), last].slice(-20);
        } else chat.messages.push(user);
        chat.messages.push(answer);
        chat.at = user.at;
        if (!retry && chat.messages.length === 2)
          chat.title =
            content.slice(0, 65) + (chat.forked_from ? " · alternativa" : "");
        this.core.append(state, entries, "chat.sent", {
          chat_id: id,
          message: user,
          model,
        });
        fresh = true;
        return { id, message_id: answer.id };
      },
    );
    if (fresh) {
      const job: Job = {
        controller: new AbortController(),
        promise: Promise.resolve(),
        content: "",
        activities: [],
        replyId: result.message_id,
      };
      this.jobs.set(id, job);
      job.promise = this.run(id, model, job).finally(() =>
        this.jobs.delete(id),
      );
    }
    return result;
  }
  private async run(id: string, model: string, job: Job) {
    let result: Generation | undefined;
    let sources: import("./chat-context.js").ChatSource[] = [];
    let status: ChatMessage["status"] = "complete",
      error: string | undefined;
    try {
      const snapshot=await this.core.snapshot();
      const chat = snapshot.chats!.find(
        (c) => c.id === id,
      )!;
      const context = chatContext(
        chat.messages.filter((m) => m.status === "complete"),
        chat.memory || "",
        optionsSchema.parse(
          JSON.parse(chat.messages.at(-1)?.options_json || "{}"),
        ),
      );
      sources = context.sources;
      const complete = await this.reply(
        model,
        context.messages,
        job.controller.signal,
        (text, phase) => {
          if (!job.controller.signal.aborted) {
            job.content = text;
            job.phase = phase;
          }
        },
        context.options,
        {
          chatId: id,
          connections:chat.bot_id?snapshot.experience?.bots.find(b=>b.id===chat.bot_id)?.connections:[],
          privateContext: context.privateContext||Boolean(chat.bot_id&&snapshot.experience?.bots.find(b=>b.id===chat.bot_id)?.memory),
          access: JSON.parse(chat.messages.at(-1)?.access_json || "{}"),
          activity: (value) => {
            if (job.controller.signal.aborted) return;
            const index = job.activities.findIndex((a) => a.id === value.id);
            if (index >= 0) job.activities[index] = value;
            else if (job.activities.length < 100) job.activities.push(value);
            job.phase = value.status === "approval" ? "approval" : "tools";
          },
        },
      );
      if (job.controller.signal.aborted) status = "stopped";
      else {
        job.content = typeof complete === "string" ? complete : complete.text;
        result = typeof complete === "string" ? undefined : complete;
      }
    } catch (failure) {
      status = job.controller.signal.aborted ? "stopped" : "error";
      error =
        status === "stopped"
          ? "Resposta interrompida por você."
          : (failure as Error).message;
    }
    if (status !== "complete")
      job.activities = job.activities.map((a) =>
        ["running", "approval"].includes(a.status)
          ? {
              ...a,
              status: "denied",
              detail:
                "Ação interrompida; nenhum resultado foi confirmado pelo agente.",
            }
          : a,
      );
    await this.core.store.tx((state, entries) => {
      if (!state || this.core.vault.locked) throw new Error("Cofre bloqueado");
      const message = state.chats
        ?.find((c) => c.id === id)
        ?.messages.find((m) => m.id === job.replyId);
      if (!message || message.status !== "pending") return;
      Object.assign(message, {
        content: job.content,
        ...(sources.length ? { sources } : {}),
        status,
        ...(job.activities.length ? { activities: job.activities } : {}),
        ...(result ? { stats: (({ text, ...stats }) => stats)(result) } : {}),
        ...(error ? { error } : {}),
      });
      this.core.append(
        state,
        entries,
        "chat." + status,
        { chat_id: id, message },
        "service",
      );
    });
  }
  async memory(id: string, memory: string) {
    if (memory.length > 6000)
      throw Error("Memória limitada a 6.000 caracteres.");
    if (this.jobs.has(id))
      throw Error("Pare a resposta antes de editar a memória.");
    return this.core.store.tx((state, entries) => {
      if (!state || this.core.vault.locked) throw Error("Cofre bloqueado");
      const chat = state.chats?.find((c) => c.id === id);
      if (!chat) throw Error("Conversa não encontrada");
      chat.memory = memory;
      this.core.append(state, entries, "chat.memory", { id, memory });
      return { ok: true };
    });
  }
  async fork(id: string, messageId: string, edit: boolean, key: string) {
    if (this.core.vault.locked) throw Error("Cofre bloqueado");
    return this.core.idempotent(
      key,
      { operation: "chat.fork", id, messageId, edit },
      (state, entries) => {
        const source = state.chats?.find((c) => c.id === id);
        if (!source) throw Error("Conversa não encontrada");
        if (source.messages.some((m) => m.status === "pending"))
          throw Error("Pare a resposta antes de criar uma ramificação.");
        const index = source.messages.findIndex((m) => m.id === messageId);
        if (index < 0) throw Error("Mensagem não encontrada");
        const message = source.messages[index];
        if (edit && message.role !== "user")
          throw Error("Edite uma mensagem sua.");
        const chat: Chat = {
          id: randomUUID(),
          title: (source.title + " · alternativa").slice(0, 100),
          at: Date.now(),
          memory: source.memory || "",
          forked_from: id,
          ...(source.bot_id?{bot_id:source.bot_id}:{}),
          ...(source.preferred_model?{preferred_model:source.preferred_model}:{}),
          messages: structuredClone(
            source.messages.slice(0, index + (edit ? 0 : 1)),
          ).map((m) => ({ ...m, id: randomUUID() })),
        };
        state.chats!.unshift(chat);
        this.core.append(state, entries, "chat.forked", {
          id: chat.id,
          source: id,
          messageId,
          edit,
        });
        return {
          id: chat.id,
          draft: edit ? message.content : "",
          attachments: edit ? message.attachments || [] : [],
        };
      },
    );
  }
  async rename(id: string, title: string) {
    return this.core.store.tx((state, entries) => {
      if (!state || this.core.vault.locked) throw new Error("Cofre bloqueado");
      const chat = state.chats?.find((c) => c.id === id);
      if (!chat) throw new Error("Conversa não encontrada");
      chat.title = title;
      this.core.append(state, entries, "chat.renamed", { id, title });
      return { ok: true };
    });
  }
  async remove(id: string) {
    if (this.jobs.has(id)) throw new Error("Pare a resposta antes de excluir.");
    return this.core.store.tx((state, entries) => {
      if (!state || this.core.vault.locked) throw new Error("Cofre bloqueado");
      state.chats = (state.chats || []).filter((c) => c.id !== id);
      this.core.append(state, entries, "chat.deleted", { id });
      return { ok: true };
    });
  }
  async stop(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.controller.abort();
      await job.promise;
    }
    return { ok: true };
  }
  async close() {
    for (const job of this.jobs.values()) job.controller.abort();
    await Promise.allSettled([...this.jobs.values()].map((job) => job.promise));
  }
}
