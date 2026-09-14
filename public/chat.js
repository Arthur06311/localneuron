import { mascotHTML } from "./mascot.js";
import { createChatAssist } from "./chat-assist.js";
import { icon } from "./icons.js";
import { createVoice } from "./voice.js";
import { marked } from "./vendor/marked.js";
import DOMPurify from "./vendor/purify.js";
marked.setOptions({ gfm: true, breaks: true });
function markdown(text) {
  // A standalone numeric answer is text, not an empty Markdown list item.
  if (/^\s*\d+[.)]\s*$/.test(text)) return `<p>${text.trim()}</p>`;
  return DOMPurify.sanitize(marked.parse(text), {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "del",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "a",
    ],
    ALLOWED_ATTR: ["href", "title", "start"],
    ALLOW_DATA_ATTR: false,
  });
}
export function createChatUI({
  api,
  escape,
  toast,
  showLibrary,
  isVisible,
  openProject,
}) {
  const $ = (selector) => document.querySelector(selector),
    drafts = new Map();
  const voice = createVoice({
    api,
    toast,
    escape,
    isVisible,
    captureTarget: () => current || "new",
    insert: (text, target) => {
      const input = $("#chat-input");
      if (input && isVisible() && target === (current || "new")) {
        input.value += (input.value ? "\n" : "") + text;
        drafts.set(target, input.value);
        input.focus();
      } else {
        const draft = drafts.get(target) || "";
        drafts.set(target, draft + (draft ? "\n" : "") + text);
      }
    },
  });
  const defaults = {
    context: 16384,
    max_tokens: 8192,
    temperature: 0.7,
    top_p: 0.95,
    reasoning: "auto",
    system:
      "Você é um assistente prestativo. Responda em português, salvo pedido em outro idioma. Desenvolva sua resposta conforme a pergunta. Reconheça incertezas. Use Markdown quando ajudar a leitura.",
  };
  let optimization = localStorage.getItem('localneuron-optimization') || 'manual';
  let options = { ...defaults };
  try {
    options = {
      ...defaults,
      ...JSON.parse(localStorage.getItem("colmeia-generation") || "{}"),
    };
  } catch {}
  let access = {
    enabled: true,
    web: false,
    computer: true,
    files: false,
    terminal: false,
    readOnly: false,
    format: "native",
  };
  try {
    access = {
      ...access,
      ...JSON.parse(localStorage.getItem("colmeia-access") || "{}"),
    };
  } catch {}
  let assistant = { folder: null, approvals: [] };
  let chats = [],
    current = null,
    models = null,
    preferred = localStorage.getItem("colmeia-model") || "",
    preparing = false,
    refreshBusy = false,
    panelOpen = false,
    lastHTML = "";
  function renameDialog(title, label = "Nome da conversa", max = 100) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.innerHTML = `<form method="dialog"><h2>${escape(label)}</h2><label>${escape(label)}<input name="title" maxlength="${max}" required value="${escape(title)}"></label><div class="actions"><button class="primary" value="save">Salvar</button><button class="secondary" value="cancel" formnovalidate>Cancelar</button></div></form>`;
      document.body.append(dialog);
      dialog.addEventListener(
        "close",
        () => {
          const value =
            dialog.returnValue === "save"
              ? dialog.querySelector("input").value
              : null;
          dialog.remove();
          resolve(value);
        },
        { once: true },
      );
      dialog.showModal();
      dialog.querySelector("input").select();
    });
  }
  const efforts = [
    ["off", "Desligado"],
    ["auto", "Automático"],
    ["low", "Baixo"],
    ["medium", "Médio"],
    ["high", "Alto"],
  ];
  const selected = () => chats.find((c) => c.id === current),
    pending = () =>
      chats.some((c) => c.messages.some((m) => m.status === "pending"));
  const assist = createChatAssist({
    api,
    E: escape,
    toast,
    isVisible,
    current: () => current,
    getChat: selected,
    isBusy: () => preparing || pending() || voice.busy(),
    getFolder: () => assistant.folder,
    getAccess: () => access,
    setAccess: (value) => {
      access = value;
      localStorage.setItem("colmeia-access", JSON.stringify(access));
      syncQuick();
    },
    ensureChat: async () => {
      if (!current) {
        const previous = "new";
        current = (await api("/chats", { method: "POST", body: {} })).id;
        assist.move(previous, current);
        if (drafts.has(previous)) {
          drafts.set(current, drafts.get(previous));
          drafts.delete(previous);
        }
      }
      chats = await api("/chats");
      draw();
      return selected();
    },
    insert: (text) => {
      const input = $("#chat-input");
      input.value += (input.value ? "\n\n" : "") + text;
      drafts.set(current || "new", input.value);
      input.focus();
    },
    onFork: async (result) => {
      await voice.stop();
      current = result.id;
      chats = await api("/chats");
      drafts.set(current, result.draft);
      $("#chat-input").value = result.draft;
      lastHTML = "";
      draw();
      $("#chat-input").focus();
    },
    onProject: (id) => openProject(id),
  });
  const accessHTML = () =>
    `<details class="assistant-access"><summary>Ferramentas · ${access.enabled ? "assistente ativo" : "só conversa"} <span class="muted">· ajustar acesso</span></summary><label class="mode-label"><input type="checkbox" data-access="enabled" ${access.enabled ? "checked" : ""}> Assistente com ferramentas</label><button type="button" class="quiet" data-agent-offline>Usar offline · desativar Internet e Terminal</button><div class="capability-row">${[
      ["computer", "Computador"],
      ["web", "Internet"],
      ["files", "Arquivos"],
      ["terminal", "Terminal"],
      ["readOnly", "Somente leitura"],
    ]
      .map(
        ([key, label]) =>
          `<label><input type="checkbox" data-access="${key}" ${access[key] ? "checked" : ""}> ${label}</label>`,
      )
      .join(
        "",
      )}<button class="quiet" type="button" data-agent-folder>Escolher pasta</button></div><p id="agent-folder">${assistant.folder ? "Pasta: " + escape(assistant.folder) : "Escolha uma pasta para ler arquivos, criar documentos e usar o terminal."}</p><details><summary>Compatibilidade com o modelo</summary><label>Formato das ações<select data-access="format"><option value="native" ${access.format === "native" ? "selected" : ""}>Automático · nativo quando disponível</option><option value="json" ${access.format === "json" ? "selected" : ""}>JSON · modelos sem ferramentas nativas</option></select></label></details><p class="muted">Ações aparecem na conversa. Arquivos e comandos são revisados antes de executar. Consultas web são enviadas à internet.</p></details>`;
  const optionsHTML = () =>
    `<details class="generation-settings" ${panelOpen ? "open" : ""}><summary>Ajustar minha IA <span id="settings-summary">· contexto ${(options.context / 1024).toFixed(0)}k · respostas até ${Math.min(options.max_tokens, options.context / 2)} tokens</span></summary><div class="generation-grid"><label>Janela de contexto<select data-option="context">${[2048, 4096, 8192, 16384, 32768, 65536, 131072].map((n) => `<option value="${n}" ${options.context === n ? "selected" : ""}>${n / 1024}k tokens</option>`).join("")}</select></label><label>Tamanho máximo da resposta<select data-option="max_tokens">${[512, 2048, 4096, 8192, 16384, 32768].map((n) => `<option value="${n}" ${options.max_tokens === n ? "selected" : ""}>${n.toLocaleString("pt-BR")} tokens</option>`).join("")}</select></label><label>Criatividade<input type="number" min="0" max="2" step="0.1" data-option="temperature" value="${options.temperature}"></label><label>Raciocínio<select data-option="reasoning">${[
      ["auto", "Padrão do modelo"],
      ["off", "Desligado, se suportado"],
      ["low", "Baixo"],
      ["medium", "Médio"],
      ["high", "Alto"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${options.reasoning === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="system-instructions">Como você quer que a IA responda?<textarea rows="3" maxlength="16000" data-option="system">${escape(options.system)}</textarea></label></div><p>Contexto é a quantidade de texto que a IA considera por vez. A conversa inteira continua salva; mensagens antigas saem da janela quando necessário. Mais contexto pode usar mais RAM. Até metade da janela fica reservada para a resposta. Raciocínio depende do suporte do modelo e do motor.</p><button type="button" class="quiet" data-chat-reset>Restaurar ajustes</button></details>`;
  async function render(model) {
    if (model) preferred = model;
    $("#content").innerHTML = '<div class="loading">Abrindo suas IAs…</div>';
    try {
      [chats, models, assistant] = await Promise.all([
        api("/chats"),
        api("/model-library"),
        api("/assistant"),
      ]);
      if (!isVisible()) return;
      if (
        !models.available &&
        !models.integrated_available &&
        models.lms_available
      ) {
        try {
          await api("/model-library/engine", { method: "POST", body: {} });
          models = await api("/model-library");
        } catch {}
      }
      if (model)
        preferred =
          models.installed.find(
            (m) =>
              m.key === model ||
              m.loaded_instances?.some((i) => i.id === model),
          )?.key || model;
      const available = models.installed.length
        ? models.installed.map((m) => ({
            id: m.key,
            name: m.display_name || m.key,
          }))
        : models.models.map((id) => ({ id, name: id }));
      if (!available.some((m) => m.id === preferred))
        preferred =
          models.installed.find(
            (m) => m.key.startsWith("gguf:") && m.size_bytes >= 1500000000,
          )?.key ||
          models.installed.find(
            (m) => m.loaded_instances?.length && m.size_bytes >= 1500000000,
          )?.key ||
          models.installed.find((m) => m.loaded_instances?.length)?.key ||
          available[0]?.id ||
          "";
      $("#content").innerHTML =
        `<div class="chat-layout"><aside class="chat-history" id="chat-history" aria-label="Histórico de conversas" hidden><div class="chat-history-head"><strong>Conversas</strong><button class="quiet" data-chat-history aria-label="Fechar histórico">×</button></div><button class="secondary" data-chat-new>＋ Nova conversa</button><input id="chat-search" class="history-search" placeholder="Buscar conversa" aria-label="Buscar conversa"><div id="chat-list"></div><div id="chat-manage"></div></aside><section class="chat-main" aria-label="Chat"><div class="chat-model-bar"><button class="secondary" data-chat-history aria-controls="chat-history" aria-expanded="false" title="Abrir histórico">${icon("history")}<span>Conversas</span></button><label for="chat-model"><span class="sr-only">IA selecionada</span><select id="chat-model">${available.map((m) => `<option value="${escape(m.id)}" ${preferred === m.id ? "selected" : ""}>${escape(m.name)}</option>`).join("") || '<option value="">Baixe sua primeira IA</option>'}</select></label><button class="secondary" data-chat-new title="Nova conversa" aria-label="Nova conversa">${icon("plus")}</button><button class="secondary" data-chat-settings title="Ajustes e ferramentas">${icon("settings")}<span>Ajustes</span></button></div>${!models.available ? '<div class="notice warn">Baixe uma IA para começar. <button class="quiet" data-chat-library>Abrir modelos →</button></div>' : ""}<div id="chat-approvals"></div><div id="chat-messages" class="chat-messages" role="log" aria-label="Mensagens da conversa" aria-live="off" tabindex="0"></div><form id="chat-form" class="chat-composer">${assist.toolbar()}<div class="quick-controls"><button type="button" class="quick-internet" data-chat-web aria-pressed="false" title="Habilitar pesquisa na internet">◎ Internet desligada</button><label class="effort-control" for="chat-effort"><span>Esforço <output id="effort-label"></output></span><input type="range" id="chat-effort" min="0" max="4" step="1" aria-describedby="effort-help"><span id="effort-help" class="sr-only">Desligado, automático, baixo, médio ou alto. Depende do modelo. Mais esforço pode demorar mais.</span></label></div><div class="voice-panel" data-voice-panel hidden><div class="voice-recording-line"><div class="voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong data-voice-time role="status"></strong><button class="quiet" type="button" data-voice-retry hidden>Tentar novamente</button><button class="quiet" type="button" data-voice-discard aria-label="Descartar gravação">Descartar ×</button></div><small data-voice-hint></small></div><label class="sr-only" for="chat-input">Sua mensagem</label><textarea id="chat-input" rows="2" maxlength="131072" placeholder="Escreva, pergunte ou cole um texto…" required></textarea><div class="composer-bottom"><div class="composer-tools"><button type="button" class="quiet" data-chat-settings title="Acesso à internet, arquivos e computador">Ferramentas</button><button type="button" class="quiet" data-chat-bottom title="Ir para a última mensagem">↓ Fim</button><button type="button" class="quiet" data-chat-font aria-pressed="false" title="Aumentar o texto">A＋</button></div><span id="chat-status" role="status"></span><button type="button" class="secondary" data-chat-stop hidden>■ Parar</button><button type="button" class="voice-button" data-chat-voice aria-label="Gravar mensagem" title="Gravar mensagem"></button><button type="submit" class="primary" id="chat-send">Enviar ${icon("arrow")}</button></div></form><p class="chat-footnote" id="chat-connection-note"></p></section></div><dialog class="chat-settings-dialog" id="chat-settings"><div class="dialog-head"><h2>Sua IA</h2><button class="icon-button" data-chat-settings-close aria-label="Fechar ajustes">×</button></div><div class="actions"><button class="secondary" data-chat-library>＋ Baixar modelos</button>${models.mlx_available ? '<button class="secondary" data-import-mlx>Adicionar MLX</button>' : ""}</div><button class="quiet" data-voice-settings>Configurar transcrição local</button><div id="model-guidance" class="model-guidance"></div>${optionsHTML()}<div class="optimization-control"><span class="plan-tag">PRO</span><label>Contexto automático<select id="chat-optimization">${[["manual","Manual · Grátis"],["economy","Economizar RAM"],["balanced","Equilibrado"],["extended","Contexto ampliado"]].map(([k,l])=>`<option value="${k}" ${optimization===k?"selected":""}>${l}</option>`).join("")}</select></label><p>Ajusta o contexto antes de carregar a IA. O modo manual mantém todos os controles disponíveis.</p></div>${accessHTML()}</dialog>`;
      $("#chat-input").value = drafts.get(current || "new") || "";
      lastHTML = "";
      draw();
      guidance();
      $(".generation-settings").open = true;
      $(".assistant-access").open = true;
      $(".chat-main").classList.toggle(
        "large-text",
        localStorage.getItem("colmeia-large-text") === "true",
      );
      $("[data-chat-font]").setAttribute(
        "aria-pressed",
        String($(".chat-main").classList.contains("large-text")),
      );
    } catch (error) {
      if (isVisible())
        $("#content").innerHTML =
          `<div class="notice warn">${escape(error.message)}</div><button class="secondary" data-chat-library>Abrir modelos</button>`;
    }
  }
  function guidance() {
    const key = $("#chat-model")?.value,
      m = models?.installed.find((m) => m.key === key);
    if (!$("#model-guidance")) return;
    const tiny = m?.size_bytes && m.size_bytes < 1500000000;
    const effective = m?.loaded_instances?.[0]?.config?.context_length;
    $("#model-guidance").textContent = key?.startsWith("exo:") ? "Modelo distribuído na Rede EXO. Mensagens são enviadas às máquinas conectadas; arquivos e ferramentas continuam sob as permissões deste computador. O EXO gerencia a distribuição de memória." : tiny
      ? "Modelo compacto: bom para testar, mas pode errar instruções complexas. Explore Qwen3.5, Gemma ou Ministral para comparar resultados."
      : m
        ? effective > options.context
          ? `O motor preparou ${Math.round(effective / 1024)}k de contexto. O chat usará até ${options.context / 1024}k; a RAM reservada pelo motor pode ser maior.`
          : "A qualidade depende do modelo. Ajuste contexto, criatividade e raciocínio aqui."
        : "";
  }
  function syncQuick() {
    if (!$("#chat-effort")) return;
    const index = Math.max(
      0,
      efforts.findIndex(([key]) => key === options.reasoning),
    );
    $("#chat-effort").value = index;
    $("#chat-effort").setAttribute("aria-valuetext", efforts[index][1]);
    $("#effort-label").textContent = efforts[index][1];
    const online = access.enabled && access.web;
    const button = $("[data-chat-web]");
    button.setAttribute("aria-pressed", String(online));
    button.innerHTML =
      icon("globe") +
      "<span>" +
      (online ? "Internet habilitada" : "Internet desligada") +
      "</span>";
    button.title = online
      ? "Desativar pesquisas. Consultas e URLs são enviadas à internet."
      : "Habilitar pesquisas na internet para a próxima mensagem";
    $("#chat-connection-note").textContent = $("#chat-model")?.value.startsWith("exo:") ? "IA distribuída · mensagens enviadas à Rede EXO"+(online?" · pesquisa online habilitada":" · pesquisa online desligada") : online
      ? "IA local · consultas e URLs podem ser enviadas à internet"
      : "IA local · pesquisa na internet desligada";
    document.querySelectorAll("[data-access]").forEach((e) => {
      if (e.type === "checkbox") e.checked = Boolean(access[e.dataset.access]);
    });
    const reasoning = $("[data-option=reasoning]");
    if (reasoning) reasoning.value = options.reasoning;
  }
  function draw() {
    if (!isVisible() || !$("#chat-messages")) return;
    const query = $("#chat-search").value.toLocaleLowerCase(),
      filtered = chats.filter((c) =>
        c.title.toLocaleLowerCase().includes(query),
      );
    const groups=new Map();for(const c of [...filtered].sort((a,b)=>b.at-a.at)){const key=c.preferred_model||c.messages.findLast(m=>m.model)?.model||'Sem modelo';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
    const listHTML=[...groups].map(([key,items])=>`<details open class="chat-model-group"><summary>${escape(models.installed?.find(m=>m.key===key)?.display_name||key)} · ${items.length}</summary>${items.map(c=>`<button data-chat-id="${c.id}" class="${c.id===current?'selected':''}">${escape(c.title)}${c.bot_id?' · Bot':''}${c.messages.some(m=>m.status==='pending')?' · …':''}</button>`).join('')}</details>`).join('')||'<p class="muted">Nenhuma conversa.</p>';
    if ($("#chat-list").innerHTML !== listHTML)
      $("#chat-list").innerHTML = listHTML;
    const manageHTML = current
      ? '<button class="quiet" data-chat-rename>Renomear</button><button class="quiet" data-chat-export>Exportar</button><button class="quiet" data-chat-delete>Excluir</button>'
      : "";
    if ($("#chat-manage").innerHTML !== manageHTML)
      $("#chat-manage").innerHTML = manageHTML;
    const messages = selected()?.messages || [],
      target = $("#chat-messages"),
      atBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 90;
    const approvals = assistant.approvals.filter((a) => a.chat_id === current);
    const approvalHTML = approvals
      .map(
        (a) =>
          `<section class="approval-card"><span class="eyebrow">SUA REVISÃO</span><h3>${escape(a.label)}</h3><pre>${escape(a.preview)}</pre><div class="actions"><button class="primary" data-agent-approve="${a.id}" data-allow="true">Autorizar esta ação</button><button class="secondary" data-agent-approve="${a.id}" data-allow="false">Recusar</button></div><p>Expira em 5 minutos. Parar cancela a ação pendente.</p></section>`,
      )
      .join("");
    if ($("#chat-approvals").innerHTML !== approvalHTML)
      $("#chat-approvals").innerHTML = approvalHTML;
    const html = messages.length
      ? messages
          .map((m, index) => {
            const stats = m.stats;
            return `<article class="chat-message ${m.role}" data-message-id="${m.id}">${m.role === "assistant" && index === messages.length - 1 ? mascotHTML(m.error || m.status === "error" || m.status === "stopped" ? "attention" : m.status === "pending" ? "thinking" : "success", "reply") : ""}<strong>${m.role === "user" ? "Você" : escape(models.installed.find((i) => i.key === m.model || i.loaded_instances?.some((l) => l.id === m.model))?.display_name || m.model || "IA local")}</strong><div class="message-text">${m.role === "assistant" ? markdown(m.content || "") : escape(m.content)}</div>${m.status === "pending" && !m.content ? `<p class="thinking-label">${m.phase === "thinking" ? "Raciocinando…" : "Preparando a resposta…"}</p>` : ""}${m.error ? `<p class="message-error">${escape(m.error)}</p>` : ""}${m.activities?.length ? `<details class="tool-activity" ${m.status === "pending" ? "open" : ""}><summary>${m.activities.length} etapas da IA</summary>${m.activities.map((a) => `<div class="tool-step"><span>${a.status === "complete" ? "✓" : a.status === "error" || a.status === "denied" ? "!" : "◌"}</span><div><strong>${escape(a.label)}</strong><small>${escape(a.detail || { running: "Executando…", approval: "Aguardando sua revisão", complete: "Concluído", denied: "Recusado", error: "Falhou" }[a.status] || a.status)}</small>${a.artifact ? `<a class="quiet" href="/v1/assistant/artifacts/${escape(a.artifact)}" download>Baixar ${escape(a.filename || "arquivo")}</a>${a.previous_artifact ? ` <a class="quiet" href="/v1/assistant/artifacts/${escape(a.previous_artifact)}" download>Versão anterior</a>` : ""}` : ""}</div></div>`).join("")}</details>` : ""}${stats ? `<div class="answer-stats">${(stats.elapsed_ms / 1000).toFixed(1)} s de execução${stats.review_ms ? " · " + (stats.review_ms / 1000).toFixed(1) + " s aguardando revisão" : ""}${stats.completion_tokens ? " · " + stats.completion_tokens + " tokens" : ""}${stats.omitted_messages ? " · " + stats.omitted_messages + " mensagens antigas fora do contexto atual" : ""}${stats.finish_reason === "length" ? " · limite de resposta atingido" : ""}</div>` : ""}${assist.extras(m)}<div class="answer-actions">${assist.actions(m)}${m.content ? `<button class="quiet" data-chat-copy="${m.id}">Copiar</button>` : ""}${m.role === "assistant" && index === messages.length - 1 && m.status !== "pending" ? `<button class="quiet" data-chat-retry>↻ Gerar novamente</button>${stats?.finish_reason === "length" ? '<button class="quiet" data-chat-continue>Continuar</button>' : ""}` : ""}${m.versions?.length ? `<details><summary>${m.versions.length} respostas anteriores</summary>${m.versions.map((v) => `<div class="previous-answer">${markdown(v.content || v.error || "Resposta interrompida")}</div>`).join("")}</details>` : ""}</div></article>`;
          })
          .join("")
      : `<div class="chat-welcome">${mascotHTML("welcome", "chat")}<span class="eyebrow">SEU ASSISTENTE LOCAL</span><h2>Como posso ajudar?</h2><p>Converse, escreva e resolva tarefas com seus modelos de IA.</p><div class="chat-suggestions"><button data-chat-example="Explique um assunto complicado com exemplos simples. Comece me perguntando qual assunto.">Entender um assunto</button><button data-chat-example="Quero melhorar um texto. Peça que eu cole o texto e depois sugira uma versão melhor.">Melhorar um texto</button><button data-chat-example="Me ajude a desenvolver uma ideia de projeto. Faça uma pergunta por vez para entender o que eu quero.">Desenvolver uma ideia</button></div>${!preferred ? '<button class="primary" data-chat-library>Baixar minha primeira IA</button>' : ""}</div>`;
    if (html !== lastHTML) {
      target.innerHTML = html;
      lastHTML = html;
      target.querySelectorAll("a:not([download])").forEach((a) => {
        a.target = "_blank";
        a.rel = "noreferrer noopener";
      });
      target.querySelectorAll("pre").forEach((pre) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "copy-code";
        button.textContent = "Copiar código";
        button.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(
              pre.querySelector("code")?.textContent || "",
            );
            toast("Código copiado.");
          } catch (error) {
            toast(error.message);
          }
        });
        pre.append(button);
      });
      if (atBottom) target.scrollTop = target.scrollHeight;
    }
    voice.paint();
    assist.paint();
    syncQuick();
    const active = pending();
    $("#chat-send").disabled =
      preparing || active || voice.busy() || assist.busy();
    if (!voice.busy() && $("[data-chat-voice]"))
      $("[data-chat-voice]").disabled = preparing || active;
    $("#chat-model").disabled = preparing || active;
    $("[data-chat-stop]").hidden = !active;
    $("[data-chat-stop]").disabled = preparing;
    document
      .querySelectorAll(
        "[data-option],[data-access],[data-agent-folder],[data-import-mlx],[data-agent-offline],[data-chat-web],#chat-effort",
      )
      .forEach((el) => (el.disabled = preparing || active));
    $("#chat-status").textContent = preparing
      ? "Preparando a IA na memória…"
      : active
        ? assistant.approvals.length
          ? "Aguardando sua revisão…"
          : chats.some((c) =>
                c.messages.some(
                  (m) => m.status === "pending" && m.phase === "thinking",
                ),
              )
            ? "Raciocinando neste computador…"
            : "Respondendo neste computador…"
        : assist.busy()
          ? "Lendo anexo local…"
          : "Enter envia · Shift + Enter quebra a linha";
  }
  async function send(retry = false) {
    if (preparing || pending() || voice.busy() || assist.busy()) return;
    const input = $("#chat-input"),
      draftId = current || "new",
      content = retry ? "" : input.value.trim(),
      key = $("#chat-model").value;
    if (!retry && !content) return;
    if (!key) {
      showLibrary();
      return;
    }
    preparing = true;
    draw();
    try {
      let instance = key, effectiveOptions = {...options};
      if (optimization !== 'manual' && !key.startsWith('exo:')) {
        const subscription = await api('/subscription');
        if (!subscription.active) {
          optimization = 'manual'; localStorage.setItem('localneuron-optimization',optimization);
          if ($('#chat-optimization')) $('#chat-optimization').value = 'manual';
          toast('Pro inativo. Esta conversa continua com seus ajustes manuais.');
        } else {
          const tuning = await api('/pro/optimize',{method:'POST',body:{key,mode:optimization,options}});
          effectiveOptions = tuning.options; toast(tuning.explanation);
        }
      }
      if (/^(gguf|mlx|exo):/.test(key) || models.api === "lmstudio") {
        const result = await api("/model-library/load", {
          method: "POST",
          body: { key, context: effectiveOptions.context },
        });
        instance = result.instance_id;
        const entry = models.installed.find((m) => m.key === key);
        if (entry)
          entry.loaded_instances = [
            { id: instance, config: result.load_config },
          ];
        guidance();
        if (
          result.load_config?.context_length &&
          result.load_config.context_length < effectiveOptions.context
        )
          toast(
            `Este modelo foi preparado com ${result.load_config.context_length} tokens de contexto. O chat respeitará esse limite.`,
          );
      }
      if (!current) {
        current = (await api("/chats", { method: "POST", body: {} })).id;
        assist.move(draftId, current);
        drafts.set(current, input.value);
        drafts.delete(draftId);
      }
      await api(`/chats/${current}/send`, {
        method: "POST",
        body: {
          model: instance,
          model_key: key,
          content: retry ? "Gerar novamente" : content,
          options: effectiveOptions,
          retry,
          access,
          attachments: retry ? [] : assist.attachments(current),
        },
      });
      if (!retry) {
        assist.clear(current);
        if (input.value.trim() === content) {
          input.value = "";
          drafts.delete(draftId);
          drafts.delete(current);
        } else {
          drafts.delete(draftId);
          drafts.set(current, input.value);
        }
      }
      chats = await api("/chats");
      draw();
      $("#chat-messages")?.scrollTo({ top: $("#chat-messages").scrollHeight });
    } catch (error) {
      toast(error.message);
    } finally {
      preparing = false;
      draw();
    }
  }
  document.addEventListener("input", (e) => {
    if (e.target.id === "chat-effort") {
      options.reasoning = efforts[Number(e.target.value)]?.[0] || "auto";
      localStorage.setItem("colmeia-generation", JSON.stringify(options));
      syncQuick();
    }
    if (e.target.id === "chat-input")
      drafts.set(current || "new", e.target.value);
    if (e.target.id === "chat-search") draw();
  });
  document.addEventListener('change', async e=>{
    if(e.target.id!=='chat-optimization')return;
    const selected=e.target.value;
    if(selected!=='manual') { try { const plan=await api('/subscription');if(!plan.active){e.target.value='manual';document.dispatchEvent(new CustomEvent('localneuron:pro-required',{detail:{feature:'performance'}}));return;} }catch(error){toast(error.message);e.target.value=optimization;return;} }
    optimization=selected;localStorage.setItem('localneuron-optimization',selected);
  });
  document.addEventListener("change", (e) => {
    if (e.target.dataset.access) {
      access[e.target.dataset.access] =
        e.target.dataset.access === "format"
          ? e.target.value
          : e.target.checked;
      localStorage.setItem("colmeia-access", JSON.stringify(access));
    }
    if (e.target.id === "chat-model") {
      preferred = e.target.value;
      localStorage.setItem("colmeia-model", preferred);
      guidance();
    }
    if (e.target.dataset.option) {
      const key = e.target.dataset.option;
      options[key] = ["system", "reasoning"].includes(key)
        ? e.target.value
        : Number(e.target.value);
      localStorage.setItem("colmeia-generation", JSON.stringify(options));
      $("#settings-summary").textContent =
        `· contexto ${options.context / 1024}k · respostas até ${Math.min(options.max_tokens, options.context / 2)} tokens`;
      guidance();
    }
    syncQuick();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#chat-history") && !$("#chat-history").hidden)
      toggleHistory(false);
    if (
      e.target.id === "chat-input" &&
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.isComposing
    ) {
      e.preventDefault();
      send();
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "chat-form") {
      e.preventDefault();
      send();
    }
  });
  function toggleHistory(open) {
    const history = $("#chat-history");
    if (!history) return;
    history.hidden = open === undefined ? !history.hidden : !open;
    document
      .querySelectorAll("[data-chat-history]")
      .forEach((b) => b.setAttribute("aria-expanded", String(!history.hidden)));
    if (!history.hidden) $("#chat-search").focus();
    else $(".chat-model-bar [data-chat-history]")?.focus();
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    try {
      if (b.hasAttribute("data-chat-web")) {
        access.web = !(access.enabled && access.web);
        if (access.web) access.enabled = true;
        localStorage.setItem("colmeia-access", JSON.stringify(access));
        syncQuick();
      } else if (b.hasAttribute("data-chat-history")) toggleHistory();
      else if (b.hasAttribute("data-chat-settings"))
        $("#chat-settings").showModal();
      else if (b.hasAttribute("data-chat-settings-close"))
        $("#chat-settings").close();
      else if (b.hasAttribute("data-chat-bottom"))
        $("#chat-messages").scrollTo({
          top: $("#chat-messages").scrollHeight,
          behavior: "smooth",
        });
      else if (b.hasAttribute("data-chat-font")) {
        const large = $(".chat-main").classList.toggle("large-text");
        localStorage.setItem("colmeia-large-text", String(large));
        b.setAttribute("aria-pressed", String(large));
      } else if (b.hasAttribute("data-import-mlx")) {
        const folder = window.colmeiaDesktop
          ? await window.colmeiaDesktop.chooseFolder()
          : await renameDialog(
              "",
              "Pasta do modelo MLX (config.json e pesos)",
              2048,
            );
        if (folder) {
          b.disabled = true;
          preparing = true;
          toast("Copiando o modelo para a LocalNeuron…");
          try {
            const model = await api("/model-library/import-mlx", {
              method: "POST",
              body: { folder },
            });
            preferred = model.key;
            localStorage.setItem("colmeia-model", preferred);
            await render(model.key);
            toast("MLX adicionado. Os arquivos agora ficam na LocalNeuron.");
          } finally {
            preparing = false;
            draw();
          }
        }
      } else if (b.hasAttribute("data-agent-offline")) {
        access.web = false;
        access.terminal = false;
        localStorage.setItem("colmeia-access", JSON.stringify(access));
        document
          .querySelectorAll('[data-access="web"],[data-access="terminal"]')
          .forEach((el) => (el.checked = false));
        syncQuick();
        toast(
          "Offline: internet e terminal desativados. Chat, computador e arquivos continuam locais.",
        );
      } else if (b.hasAttribute("data-agent-folder")) {
        let folder;
        if (window.colmeiaDesktop)
          folder = await window.colmeiaDesktop.chooseFolder();
        else
          folder = await renameDialog(
            assistant.folder || "",
            "Caminho completo da pasta de trabalho",
            2048,
          );
        if (folder) {
          assistant = await api("/assistant/folder", {
            method: "POST",
            body: { folder },
          });
          $("#agent-folder").textContent = "Pasta: " + assistant.folder;
        }
      } else if (b.dataset.agentApprove) {
        b.disabled = true;
        await api("/assistant/approve", {
          method: "POST",
          body: {
            id: b.dataset.agentApprove,
            allow: b.dataset.allow === "true",
          },
        });
        assistant = await api("/assistant");
        draw();
      } else if (b.hasAttribute("data-chat-library")) {
        $("#chat-settings")?.close();
        showLibrary();
      } else if (b.hasAttribute("data-chat-new")) {
        if (preparing) return;
        await voice.stop();
        current = null;
        toggleHistory(false);
        $("#chat-input").value = drafts.get("new") || "";
        lastHTML = "";
        draw();
        $("#chat-input").focus();
      } else if (b.dataset.chatId) {
        if (preparing) return;
        await voice.stop();
        current = b.dataset.chatId;
        const savedModel=selected()?.preferred_model;if(savedModel&&models.installed.some(m=>m.key===savedModel)){$("#chat-model").value=savedModel;preferred=savedModel;guidance();}
        toggleHistory(false);
        $("#chat-input").value = drafts.get(current) || "";
        lastHTML = "";
        draw();
        $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
      } else if (b.dataset.chatExample) {
        $("#chat-input").value = b.dataset.chatExample;
        drafts.set(current || "new", b.dataset.chatExample);
        $("#chat-input").focus();
      } else if (b.dataset.chatCopy) {
        const m = selected()?.messages.find((m) => m.id === b.dataset.chatCopy);
        if (m) {
          await navigator.clipboard.writeText(m.content);
          toast("Texto copiado.");
        }
      } else if (b.hasAttribute("data-chat-stop")) {
        for (const c of chats.filter((c) =>
          c.messages.some((m) => m.status === "pending"),
        ))
          await api(`/chats/${c.id}/stop`, { method: "POST", body: {} });
        chats = await api("/chats");
        draw();
      } else if (b.hasAttribute("data-chat-retry")) await send(true);
      else if (b.hasAttribute("data-chat-continue")) {
        $("#chat-input").value =
          "Continue de onde parou, sem repetir o que já escreveu.";
        await send();
      } else if (b.hasAttribute("data-chat-reset")) {
        options = { ...defaults };
        localStorage.setItem("colmeia-generation", JSON.stringify(options));
        await render();
      } else if (b.hasAttribute("data-chat-rename")) {
        const title = await renameDialog(selected()?.title || "");
        if (title?.trim()) {
          await api(`/chats/${current}/rename`, {
            method: "POST",
            body: { title: title.trim() },
          });
          chats = await api("/chats");
          draw();
        }
      } else if (b.hasAttribute("data-chat-delete")) {
        if (
          confirm(
            "Excluir esta conversa do aplicativo? A ação não pode ser desfeita.",
          )
        ) {
          await api(`/chats/${current}`, { method: "DELETE" });
          drafts.delete(current);
          current = null;
          chats = await api("/chats");
          lastHTML = "";
          draw();
        }
      } else if (b.hasAttribute("data-chat-export")) {
        const c = selected();
        if (c) {
          const text =
              "# " +
              c.title +
              (c.memory ? "\n\n## Memória da conversa\n\n" + c.memory : "") +
              "\n\n" +
              c.messages
                .map(
                  (m) =>
                    "## " +
                    (m.role === "user" ? "Você" : m.model || "IA") +
                    "\n\n" +
                    m.content +
                    (m.attachments?.length
                      ? "\n\nAnexos: " +
                        m.attachments
                          .map(
                            (a) =>
                              a.name +
                              (a.truncated ? " (leitura parcial)" : ""),
                          )
                          .join(", ")
                      : "") +
                    (m.sources?.length
                      ? "\n\nFontes consultadas:\n" +
                        m.sources
                          .map(
                            (s) =>
                              "- [" +
                              s.citation +
                              "] " +
                              s.name +
                              " — " +
                              s.location,
                          )
                          .join("\n")
                      : "") +
                    (m.status !== "complete"
                      ? "\n\n[Resposta " + m.status + "]"
                      : ""),
                )
                .join("\n\n"),
            url = URL.createObjectURL(
              new Blob([text], { type: "text/markdown" }),
            ),
            a = document.createElement("a");
          a.href = url;
          a.download = "conversa.md";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }
    } catch (error) {
      toast(error.message);
    }
  });
  setInterval(async () => {
    if (!isVisible() || refreshBusy || preparing) return;
    refreshBusy = true;
    try {
      [chats, assistant] = await Promise.all([
        api("/chats"),
        api("/assistant"),
      ]);
      draw();
    } catch {
    } finally {
      refreshBusy = false;
    }
  }, 700);
  return {
    render,
    openConversation: id => {current=id;},
    stopVoice: () => {
      assist.close();
      return voice.stop();
    },
  };
}
