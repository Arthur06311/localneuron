const presets = [
  [
    "Resumir documento",
    "Resuma os anexos em tópicos, destaque decisões e pendências e cite os trechos usados. Se algo não estiver nos arquivos, diga isso.",
  ],
  [
    "Revisar texto",
    "Revise o texto abaixo, preservando meu tom. Entregue a versão revisada e explique as principais mudanças:\n\n",
  ],
  [
    "Explicar código",
    "Explique o código anexado, suas entradas, saídas e possíveis problemas. Use exemplos pequenos e cite o arquivo.",
  ],
  [
    "Encontrar um bug",
    "Analise o problema abaixo. Diferencie fatos de hipóteses, proponha uma correção mínima e testes úteis. Não afirme ter executado testes:\n\n",
  ],
  [
    "Planejar projeto",
    "Ajude a organizar este projeto em objetivo, etapas, entregas e próximos passos. Pergunte o que estiver faltando:\n\n",
  ],
  [
    "Pesquisar com fontes",
    "Pesquise o assunto abaixo usando as ferramentas web habilitadas. Cite as URLs realmente consultadas e indique incertezas:\n\n",
  ],
  [
    "Comparar opções",
    "Compare estas opções numa tabela com vantagens, limitações e critérios de escolha. Não invente dados ausentes:\n\n",
  ],
  [
    "Extrair uma tabela",
    "Extraia dos anexos uma tabela com os dados relevantes e a fonte de cada linha. Marque informações ausentes.",
  ],
  [
    "Escrever e-mail",
    "Crie um rascunho de e-mail claro e curto, sem enviá-lo. Contexto e destinatário:\n\n",
  ],
  [
    "Aprender um assunto",
    "Explique este assunto do básico ao prático. Use uma analogia, um exemplo e três perguntas para conferir meu entendimento:\n\n",
  ],
  [
    "Melhorar uma ideia",
    "Explore esta ideia: problema que resolve, público, diferenciais, riscos e um experimento simples para testar:\n\n",
  ],
  [
    "Preparar apresentação",
    "Prepare um roteiro de apresentação com título, mensagem principal e tópicos de cada slide a partir deste conteúdo:\n\n",
  ],
];
const profiles = {
  chat: {
    enabled: false,
    web: false,
    computer: false,
    files: false,
    terminal: false,
    readOnly: true,
  },
  local: {
    enabled: true,
    web: false,
    computer: true,
    files: true,
    terminal: false,
    readOnly: true,
  },
  research: {
    enabled: true,
    web: true,
    computer: true,
    files: false,
    terminal: false,
    readOnly: true,
  },
};
export function createChatAssist({
  api,
  E,
  toast,
  isVisible,
  current,
  getChat,
  isBusy,
  ensureChat,
  insert,
  onFork,
  onProject,
  getAccess,
  setAccess,
  getFolder,
}) {
  const $ = (s) => document.querySelector(s),
    files = new Map();
  let uploading = false;
  const key = () => current() || "new";
  const attachments = (id = key()) => files.get(id) || [];
  function dialog(title, body) {
    $("#chat-assist-dialog")?.remove();
    const d = document.createElement("dialog");
    d.id = "chat-assist-dialog";
    d.className = "chat-assist-dialog";
    d.innerHTML = `<div class="dialog-head"><h2>${E(title)}</h2><button class="icon-button" data-assist-close aria-label="Fechar painel">×</button></div>${body}`;
    document.body.append(d);
    d.querySelector("[data-assist-close]").onclick = () => d.close();
    d.showModal();
    return d;
  }
  function toolbar() {
    return `<div class="chat-assist-bar"><button type="button" class="quiet" data-assist="attach" title="PDF, DOCX, XLSX, texto e código · até 4 arquivos de 12 MiB">＋ Anexar</button><button type="button" class="quiet" data-assist="prompts">Comandos</button><button type="button" class="quiet" data-assist="memory">Memória</button><button type="button" class="quiet" data-assist="search">Buscar</button><label class="chat-profile"><span class="sr-only">Perfil de ferramentas</span><select id="chat-tool-profile" aria-label="Perfil de ferramentas"><option value="custom">Ferramentas personalizadas</option><option value="chat">Só conversar</option><option value="local">Arquivos · só leitura</option><option value="research">Pesquisa na internet</option></select></label><input id="chat-attachment-files" type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.js,.ts,.tsx,.py,.html,.css,.yaml,.yml,.rs,.go,.java,.c,.cpp" multiple hidden></div><div id="chat-attachment-drafts" class="chat-attachment-drafts" hidden></div><p id="chat-tool-hint" class="chat-tool-hint"></p>`;
  }
  function paint() {
    if (!isVisible() || !$("#chat-attachment-drafts")) return;
    const list = attachments();
    const el = $("#chat-attachment-drafts");
    el.hidden = !list.length && !uploading;
    const html =
      list
        .map(
          (a) =>
            `<span class="chat-attachment-chip" title="${E(a.truncated ? "Leitura parcial: primeiros 50 trechos ou 100 mil caracteres." : a.pages.length + " trechos disponíveis para consulta.")}" >${E(a.name)}${a.truncated ? " · parcial" : ""}<button type="button" data-remove-attachment="${a.id}" aria-label="Remover ${E(a.name)}">×</button></span>`,
        )
        .join("") +
      (uploading
        ? '<span role="status">Lendo documento neste computador…</span>'
        : "");
    if (el.innerHTML !== html) el.innerHTML = html;
    const access = getAccess();
    const matching = Object.entries(profiles).find(([, v]) =>
      Object.entries(v).every(([k, value]) => access[k] === value),
    );
    $("#chat-tool-profile").value = matching?.[0] || "custom";
    $("#chat-tool-hint").textContent = !access.enabled
      ? "Sem ferramentas nesta resposta."
      : access.readOnly
        ? `Somente leitura · escrita e terminal bloqueados${access.files && !getFolder() ? " · escolha uma pasta em Ferramentas para consultar arquivos" : ""}`
        : "Ações de escrita e comandos continuam sujeitos à sua revisão.";
    document
      .querySelectorAll(
        "[data-assist],#chat-tool-profile,[data-remove-attachment],[data-assist-fork],[data-assist-project]",
      )
      .forEach((b) => (b.disabled = isBusy() || uploading));
  }
  function extras(m) {
    return (
      (m.attachments?.length
        ? `<div class="message-attachments">${m.attachments.map((a) => `<span title="${E(a.pages.length + " trechos locais" + (a.truncated ? " · leitura parcial" : ""))}">${E(a.name)}${a.truncated ? " · parcial" : ""}</span>`).join("")}</div>`
        : "") +
      (m.sources?.length
        ? `<details class="chat-sources"><summary>${m.sources.length} trechos consultados nos anexos</summary>${m.sources.map((s) => `<div><strong>[${E(s.citation)}] ${E(s.name)}</strong><small>${E(s.location)}</small><blockquote>${E(s.text)}</blockquote></div>`).join("")}</details>`
        : "")
    );
  }
  function actions(m) {
    return m.status !== "pending"
      ? `<button class="quiet" data-assist-fork="${m.id}" data-edit="${m.role === "user"}">${m.role === "user" ? "Editar em nova conversa" : "Ramificar daqui"}</button>${m.role === "assistant" && m.status === "complete" ? `<button class="quiet" data-assist-project="${m.id}">Salvar em Projetos · Pro</button>` : ""}`
      : "";
  }
  async function memory() {
    const chat = await ensureChat();
    const d = dialog(
      "Memória desta conversa",
      `<p>Fatos e preferências que você quer manter nas próximas respostas. Você controla este texto; a IA não o altera sozinha.</p><form id="chat-memory-form"><textarea id="chat-memory-text" rows="8" maxlength="6000" placeholder="Ex.: este projeto usa Python; prefiro explicações curtas…">${E(chat.memory || "")}</textarea><p class="muted">Até 6.000 caracteres. A memória fica somente nesta conversa e acompanha suas ramificações.</p><button class="primary">Salvar memória</button><p role="status" class="assist-error"></p></form>`,
    );
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const b = d.querySelector(".primary");
      b.disabled = true;
      try {
        await api(`/chats/${chat.id}/memory`, {
          method: "POST",
          body: { memory: $("#chat-memory-text").value },
        });
        d.close();
        toast("Memória salva para as próximas respostas.");
      } catch (e) {
        d.querySelector(".assist-error").textContent = e.message;
      } finally {
        b.disabled = false;
      }
    };
  }
  function prompts() {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("localneuron-prompts") || "[]")
        .filter(
          (p) =>
            typeof p.name === "string" &&
            p.name.length <= 80 &&
            typeof p.text === "string" &&
            p.text.length <= 6000,
        )
        .slice(0, 100);
    } catch {}
    const all = [...presets.map(([name, text]) => ({ name, text })), ...saved];
    const d = dialog(
      "Comandos reutilizáveis",
      `<p>Escolha um comando, ajuste o texto e leve-o ao rascunho. Nenhuma mensagem é enviada automaticamente.</p><div class="prompt-workspace"><aside><input id="chat-prompt-search" placeholder="Buscar comando" aria-label="Buscar comando"><div id="chat-prompt-list"></div></aside><section><label>Nome<input id="chat-prompt-name" maxlength="80" placeholder="Meu comando"></label><label>Instrução<textarea id="chat-prompt-text" rows="8" maxlength="6000"></textarea></label><div class="actions"><button class="primary" id="chat-prompt-use">Usar no rascunho</button><button class="secondary" id="chat-prompt-save">Salvar como novo</button></div><p id="chat-prompt-status" role="status"></p></section></div>`,
    );
    const list = () => {
      $("#chat-prompt-list").innerHTML = all
        .map((p, i) => ({ p, i }))
        .filter(({ p }) =>
          p.name
            .toLocaleLowerCase()
            .includes($("#chat-prompt-search").value.toLocaleLowerCase()),
        )
        .map(
          ({ p, i }) =>
            `<button class="quiet" data-prompt-index="${i}">${E(p.name)}</button>`,
        )
        .join("");
    };
    list();
    $("#chat-prompt-search").oninput = list;
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-prompt-index]");
      if (b) {
        const p = all[Number(b.dataset.promptIndex)];
        $("#chat-prompt-name").value = p.name;
        $("#chat-prompt-text").value = p.text;
      }
    });
    $("#chat-prompt-use").onclick = () => {
      const text = $("#chat-prompt-text").value.trim();
      if (text) {
        insert(text);
        d.close();
      }
    };
    $("#chat-prompt-save").onclick = () => {
      const name = $("#chat-prompt-name").value.trim(),
        text = $("#chat-prompt-text").value.trim();
      if (!name || !text) {
        $("#chat-prompt-status").textContent = "Preencha nome e instrução.";
        return;
      }
      if (saved.length >= 100) {
        $("#chat-prompt-status").textContent =
          "Limite de 100 comandos pessoais.";
        return;
      }
      try {
        saved.push({ name, text });
        localStorage.setItem("localneuron-prompts", JSON.stringify(saved));
        all.push({ name, text });
        list();
        $("#chat-prompt-status").textContent =
          "Comando salvo neste dispositivo.";
      } catch (e) {
        $("#chat-prompt-status").textContent =
          "Não foi possível salvar neste dispositivo.";
      }
    };
  }
  function search() {
    const chat = getChat();
    if (!chat?.messages.length) {
      toast("Esta conversa ainda não tem mensagens.");
      return;
    }
    const d = dialog(
      "Buscar nesta conversa",
      '<input id="chat-message-search" type="search" placeholder="Texto da mensagem" aria-label="Buscar texto na conversa"><p id="chat-search-count" role="status"></p><div id="chat-message-results"></div>',
    );
    $("#chat-message-search").oninput = () => {
      const q = $("#chat-message-search").value.toLocaleLowerCase().trim();
      const matches = q
        ? chat.messages.filter((m) =>
            (
              m.content +
              " " +
              (m.attachments || []).map((a) => a.name).join(" ")
            )
              .toLocaleLowerCase()
              .includes(q),
          )
        : [];
      $("#chat-search-count").textContent =
        matches.length + " mensagens encontradas" + (matches.length>100?" · mostrando as primeiras 100":"");
      $("#chat-message-results").innerHTML = matches
        .slice(0, 100)
        .map(
          (m) =>
            `<button class="chat-search-result" data-jump-message="${m.id}"><strong>${m.role === "user" ? "Você" : "IA"}</strong><span>${E(m.content.slice(Math.max(0, m.content.toLocaleLowerCase().indexOf(q) - 50), Math.max(0, m.content.toLocaleLowerCase().indexOf(q) - 50) + 220))}</span></button>`,
        )
        .join("");
    };
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-jump-message]");
      if (b) {
        d.close();
        const target = document.querySelector(
          `[data-message-id="${b.dataset.jumpMessage}"]`,
        );
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        target?.classList.add("search-target");
        setTimeout(() => target?.classList.remove("search-target"), 2500);
      }
    });
    $("#chat-message-search").focus();
  }
  document.addEventListener("change", async (e) => {
    if (!isVisible()) return;
    if (e.target.id === "chat-tool-profile") {
      const profile = profiles[e.target.value];
      if (profile && !isBusy()) {
        setAccess({ ...getAccess(), ...profile });
        paint();
      }
      return;
    }
    if (e.target.id !== "chat-attachment-files" || uploading || isBusy())
      return;
    const target = key(),
      selected = [...e.target.files];
    e.target.value = "";
    uploading = true;
    paint();
    try {
      for (const file of selected) {
        if (attachments(target).length >= 4)
          throw Error("Use até quatro anexos por mensagem.");
        if (file.size > 12 * 1024 ** 2)
          throw Error(file.name + ": limite de 12 MiB.");
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () =>
            reject(Error("Não foi possível ler o arquivo."));
          reader.readAsDataURL(file);
        });
        const a = await api("/chats/attachments", {
          method: "POST",
          body: { name: file.name, data },
        });
        files.set(target, [...attachments(target), a]);
      }
    } catch (e) {
      if (isVisible()) toast(e.message);
    } finally {
      uploading = false;
      paint();
    }
  });
  document.addEventListener("click", async (e) => {
    if (!isVisible()) return;
    const b = e.target.closest("button");
    if (
      !b ||
      !b.matches(
        "[data-assist],[data-remove-attachment],[data-assist-fork],[data-assist-project]",
      )
    )
      return;
    try {
      if (b.dataset.removeAttachment && !isBusy()) {
        files.set(
          key(),
          attachments().filter((a) => a.id !== b.dataset.removeAttachment),
        );
        paint();
      }
      if (b.dataset.assist && !isBusy() && !uploading) {
        if (b.dataset.assist === "attach") $("#chat-attachment-files").click();
        if (b.dataset.assist === "prompts") prompts();
        if (b.dataset.assist === "memory") await memory();
        if (b.dataset.assist === "search") search();
      }
      if (b.dataset.assistFork && !isBusy()) {
        b.disabled = true;
        const result = await api(`/chats/${current()}/fork`, {
          method: "POST",
          body: {
            message: b.dataset.assistFork,
            edit: b.dataset.edit === "true",
          },
        });
        files.set(result.id, result.attachments);
        await onFork(result);
        toast("Nova conversa criada; a original foi preservada.");
      }
      if (b.dataset.assistProject && !isBusy()) {
        b.disabled = true;
        const p = await api(`/chats/${current()}/to-pro`, {
          method: "POST",
          body: { message: b.dataset.assistProject },
        });
        onProject(p.id);
      }
    } catch (e) {
      toast(e.message);
    } finally {
      if (b.isConnected) b.disabled = isBusy() || uploading;
    }
  });
  return {
    toolbar,
    paint,
    extras,
    actions,
    attachments,
    busy: () => uploading,
    clear: (id) => files.delete(id),
    move: (from, to) => {
      if (files.has(from)) {
        files.set(to, files.get(from));
        files.delete(from);
      }
    },
    close: () => $("#chat-assist-dialog")?.close(),
  };
}
