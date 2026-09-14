import { icon } from "./icons.js";
import {applyMembership,benefitComparison} from './premium-experience.js';
import {STARTERS, centerHTML, templatesHTML, queueHTML, qualityLabel} from "./pro-center.js";
import { marked } from "/vendor/marked.js";
import DOMPurify from "/vendor/purify.js";
import { listProjects, projectBundle, importBundle } from "./studio-project.js";
const labels = {
  answer: "Conversa",
  research: "Pesquisa com fontes",
  batch: "Produção em lote",
  code: "Revisão de código",
  artifact: "Criar arquivo",
  automation: "Preparar automação",
  storyboard: "Roteiro de vídeo",
};
export function createPro({ api, escape: E, toast, isVisible, navigate }) {
  const $ = (s) => document.querySelector(s);
  let state = null,
    models = [],
    current = localStorage.getItem("localneuron-pro-project") || "",
    tab = "overview",
    timer = null,
    dirty = false,
    draft = "",
    lastJobs = "", lastQueue = "",
    selectedJob = "",
    polling = false;
  const draftKey=()=> 'localneuron-pro-draft:'+current;
  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(draftKey())||'{}');}catch{return {};}};
  const rememberDraft=()=>{if(!current||!$('#pro-compose'))return;const value={prompt:$('#pro-prompt').value};for(const key of ['kind','model','assistant','quality','style','language'])value[key]=$('#pro-'+key).value;try{localStorage.setItem(draftKey(),JSON.stringify(value));}catch{toast('Não foi possível guardar o rascunho neste navegador.');}};
  const restoreDraft=()=>{const value=readDraft();if(typeof value.prompt==='string'){draft=value.prompt.slice(0,16000);$('#pro-prompt').value=draft;}for(const key of ['kind','model','assistant','quality','style','language']){const select=$('#pro-'+key);if([...select.options].some(o=>o.value===value[key]))select.value=value[key];}};
  const project = () => state?.projects.find((p) => p.id === current);
  const markdown = (t) =>
    DOMPurify.sanitize(marked.parse(t || ""), {
      FORBID_TAGS: ["img", "iframe", "style", "script"],
      FORBID_ATTR: ["style"],
    });
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function render() {
    stop();
    $("#content").innerHTML =
      '<div class="loading">Abrindo seus projetos…</div>';
    try {
      [state, { installed: models }] = await Promise.all([
        Promise.all([api("/pro"),api("/subscription")]).then(([data,subscription])=>({...data,subscription})),
        api("/model-library"),
      ]);
      if (!isVisible()) return;
      applyMembership(state.subscription);
      if (!project()) current = state.projects[0]?.id || "";
      shell();
      timer = setInterval(refresh, 1200);
    } catch (e) {
      toast(e.message);
    }
  }
  function shell() {
    if (!isVisible()) return;
    $("#content").innerHTML =
      `<section class="pro-app">${!state.subscription?.active?'<div class="premium-context"><span class="plan-tag">PRO</span><div><strong>Projetos com mais possibilidades.</strong><p>Novos projetos e tarefas com IA fazem parte da assinatura. Você pode editar e exportar os trabalhos existentes.</p></div><button class="secondary" data-page="subscription">Conhecer o Pro</button></div>':''}<header class="pro-header"><div><span class="eyebrow">ESPAÇO PROFISSIONAL</span><h1>Central Pro</h1><p>Uma visão clara do seu trabalho com IA.</p></div><button class="primary" data-pro="new-project">＋ Novo projeto</button></header><div class="pro-layout"><aside class="pro-sidebar"><div class="pro-side-label">PROJETOS <span>${state.projects.length}</span></div><div class="pro-projects">${state.projects.map((p) => `<button class="${p.id === current ? "selected" : ""}" data-pro-project="${p.id}"><span class="pro-project-dot"></span>${E(p.name)}</button>`).join("") || "<p>Crie um projeto para começar.</p>"}</div><div class="pro-side-label">FERRAMENTAS</div>${[
        ["overview", "Visão geral"],
        ["templates", "Atalhos de trabalho"],
        ["queue", "Central de tarefas"],
        ["work", "Área de trabalho"],
        ["documents", "Documentos"],
        ["assistants", "Assistentes"],
        ["automations", "Automações"],
        ["diagnostics", "Desempenho"],
        ["backup", "Backups"],
      ]
        .map(
          ([id, title]) =>
            `<button data-pro-tab="${id}" class="${tab === id ? "selected" : ""}">${icon(({overview:"models",templates:"star",queue:"history",work:"monitor",documents:"folder",assistants:"chat",automations:"settings",diagnostics:"settings",backup:"lock"})[id])}<span>${title}</span></button>`,
        )
        .join(
          "",
        )}<div class="pro-side-footer"><button data-page="studio">Abrir Estúdio ↗</button><button data-page="sharing">Acesso remoto e API ↗</button><small>Processamento local · seus arquivos neste computador</small></div></aside><section id="pro-body"></section></div></section>`;
    draw();
  }
  const options = () =>
    '<option value="auto">Automático · conforme a tarefa e RAM</option>' +
    models
      .map(
        (m) =>
          `<option value="${E(m.key)}">${E(m.display_name || m.key)}</option>`,
      )
      .join("");
  function draw() {
    const target = $("#pro-body");
    if (!target) return;
    if (!project() && ["work", "documents", "automations"].includes(tab)) {
      target.innerHTML =
        '<div class="pro-empty"><span class="eyebrow">COMECE COM UM PROJETO</span><h2>Um lugar para cada ideia.</h2><p>Reúna arquivos, guarde decisões e transforme suas conversas em entregas.</p><button class="primary" data-pro="new-project">Criar meu primeiro projeto</button></div>';
      return;
    }
    if (tab === "overview") target.innerHTML = centerHTML(state,E);
    if (tab === "templates") target.innerHTML = templatesHTML(state,E);
    if (tab === "queue") target.innerHTML = queueHTML(state,E);
    if (tab === "work") work();
    if (tab === "documents") documents();
    if (tab === "assistants") assistants();
    if (tab === "automations") automations();
    if (tab === "diagnostics") diagnostics();
    if (tab === "backup") backups();
  }
  function work() {
    const p = project();
    $("#pro-body").innerHTML =
      `<div class="pro-work-header"><div><span class="eyebrow">PROJETO ATUAL</span><h2>${E(p.name)}</h2></div><div class="actions"><button class="secondary" data-pro="memory">Memória do projeto</button><button class="quiet" data-pro="rename">Renomear</button><button class="quiet" data-pro="delete-project">Excluir</button></div></div><div class="pro-work-grid"><section class="pro-conversation"><div id="pro-jobs"></div><form id="pro-compose"><textarea id="pro-prompt" rows="4" maxlength="16000" placeholder="O que vamos criar neste projeto?" aria-label="Pedido para o assistente" required>${E(draft)}</textarea><div class="pro-compose-options"><label>Tarefa<select id="pro-kind">${Object.entries(
        labels,
      )
        .map(([id, label]) => `<option value="${id}">${label}</option>`)
        .join(
          "",
        )}</select></label><label>Assistente<select id="pro-assistant"><option value="">Assistente geral</option>${state.assistants.map((a) => `<option value="${a.id}">${E(a.name)}</option>`).join("")}</select></label><label>Modelo<select id="pro-model">${options()}</select></label></div><div id="pro-kind-options"></div><details class="pro-delivery-options" open><summary>Personalize a entrega</summary><div class="pro-compose-options"><label>Modo<select id="pro-quality"><option value="fast">Rápido · resposta mais curta</option><option value="balanced" selected>Equilibrado · uma passagem</option><option value="thorough">Com revisão · duas passagens</option></select></label><label>Estilo<select id="pro-style"><option value="clear">Claro e direto</option><option value="executive">Executivo</option><option value="technical">Técnico</option><option value="creative">Criativo</option></select></label><label>Idioma<select id="pro-language"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></label></div><p>Com revisão preserva a primeira versão e faz uma segunda passagem. Consome mais tempo de processamento e pode manter erros do modelo.</p></details><div class="pro-compose-footer"><label class="pro-check"><input type="checkbox" id="pro-internet"> Internet para pesquisa</label><button class="primary" type="submit">Executar tarefa ↑</button></div><small>Arquivos são consultados como referências. A qualidade depende do modelo escolhido.</small></form></section><aside class="pro-editor"><div class="pro-editor-heading"><h3>Documento do projeto</h3><span id="pro-editor-status">Versão ${p.revision}</span></div><textarea id="pro-editor" spellcheck="false" aria-label="Editor de documento ou código" placeholder="Edite aqui ou use uma resposta do assistente…">${E(p.body)}</textarea><div class="actions"><button class="primary" data-pro="save-editor">Salvar versão</button><button class="secondary" data-pro="versions">Histórico</button><button class="quiet" data-pro-focus>Modo foco</button></div><div class="pro-export"><label>Baixar como<select id="pro-format"><option value="md">Markdown / texto</option><option value="docx">Word · DOCX</option><option value="xlsx">Excel · XLSX</option><option value="pptx">PowerPoint · PPTX</option></select></label><button class="secondary" data-pro="export">Baixar</button></div></aside></div>`;
    lastJobs = "";
    jobs();
    restoreDraft();
    kindOptions();
    dirty = false;
  }
  function kindOptions() {
    const k = $("#pro-kind")?.value,
      t = $("#pro-kind-options");
    if (!t) return;
    t.innerHTML =
      k === "batch"
        ? `<label>Documentos do lote (até 30)</label><div class="pro-document-checks">${
            state.documents
              .filter((d) => d.project === current)
              .map(
                (d) =>
                  `<label class="pro-check"><input type="checkbox" name="pro-document" value="${d.id}" checked>${E(d.name)}</label>`,
              )
              .join("") || "<p>Importe documentos primeiro.</p>"
          }</div>`
        : k === "research"
          ? '<label>Fontes específicas (opcional, uma URL por linha)<textarea id="pro-urls" rows="2" placeholder="https://…"></textarea></label>'
          : k === "artifact"
            ? "<p>Escolha o formato no painel do documento; o conteúdo será preparado para essa exportação.</p>"
            : k === "code"
              ? "<p>Importe os arquivos do repositório em Documentos. A proposta será apresentada para sua revisão; os arquivos originais permanecem no computador.</p>"
              : "";
  }
  function jobs() {
    const el = $("#pro-jobs");
    if (!el) return;
    const items = state.jobs
        .filter((j) => j.input.project === current)
        .slice(0, 15)
        .reverse(),
      html =
        items
          .map(
            (j) =>
              `<article class="pro-job"><div class="pro-job-meta"><strong>${E(labels[j.input.kind] || "Tarefa")}</strong><span class="pro-status ${E(j.state)}">${E({ queued: "Na fila", running: "Executando", complete: "Concluído", failed: "Falhou", cancelled: "Cancelado", interrupted: "Interrompido" }[j.state] || j.state)} ${j.total > 1 ? j.progress + "/" + j.total : ""}</span></div><p class="pro-user-prompt">${E(j.input.prompt)}</p><div class="pro-output">${markdown(j.output || j.error || "Aguardando o motor local…")}</div>${j.calls?`<div class="pro-job-telemetry">${E(qualityLabel[j.input.quality]||"Equilibrado")} · ${E(j.stage||"")} · ${j.calls} chamadas${j.finished_at&&j.started_at?" · "+Math.round((j.finished_at-j.started_at)/1000)+" s":""}</div>`:""}${j.draft?`<details class="pro-first-draft"><summary>${j.input.kind==='batch'?'Primeira versão do último item':'Comparar com a primeira versão'}</summary><div class="pro-output">${markdown(j.draft)}</div></details>`:""}${j.error && j.output ? `<p class="notice warn">${E(j.error)}</p>` : ""}${j.sources?.length ? `<details class="pro-sources"><summary>${j.sources.length} fontes consultadas</summary>${j.sources.map((s) => `<p>${s.url ? `<a href="${E(s.url)}" target="_blank" rel="noreferrer">${E(s.name || s.url)}</a>` : `${E(s.name)} · ${E(s.location)} <code>[${E(s.citation)}]</code>`}</p>`).join("")}</details>` : ""}<div class="actions">${["queued", "running"].includes(j.state) ? `<button class="secondary" data-pro-cancel="${j.id}">Cancelar</button>` : `<button class="secondary" data-pro-result="${j.id}">Revisar no editor</button><button class="quiet" data-pro-repeat="${j.id}">Executar novamente</button>${j.input.kind === "automation" ? `<button class="secondary" data-pro-automation="${j.id}">Salvar automação</button>` : ""}${j.input.kind === "storyboard" ? `<button class="primary" data-pro-story="${j.id}">Levar ao Estúdio</button>` : ""}`}</div></article>`,
          )
          .join("") ||
        '<div class="pro-welcome"><h3>Do conhecimento à entrega.</h3><p>Importe documentos, escolha um assistente e comece. As respostas e os trabalhos deste projeto ficam reunidos aqui.</p><div class="pro-starters"><button data-pro-example="Resuma os documentos deste projeto e destaque as decisões importantes, citando as fontes.">Resumir meus documentos</button><button data-pro-example="Crie um plano de conteúdo para apresentar meu negócio.">Desenvolver uma ideia</button></div></div>';
    if (html !== lastJobs) {
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      el.innerHTML = html;
      lastJobs = html;
      if (bottom) el.scrollTop = el.scrollHeight;
    }
  }
  function documents() {
    $("#pro-body").innerHTML =
      `<div class="pro-section-head"><div><span class="eyebrow">CONHECIMENTO DO PROJETO</span><h2>Seus arquivos, com contexto.</h2><p>PDF, Word, Excel, CSV, texto e código. Até 12 MiB por arquivo.</p></div><div class="actions"><button class="primary" data-pro="upload">Importar arquivos</button><button class="secondary" data-pro="folder">Importar pasta</button></div></div><input id="pro-files" type="file" multiple hidden><input id="pro-folder" type="file" webkitdirectory multiple hidden><form id="pro-search-form" class="pro-search"><input id="pro-search" placeholder="Buscar um assunto nos documentos…" aria-label="Busca nos documentos" required><button class="secondary">Buscar</button></form><div id="pro-search-results"></div><div class="pro-file-list">${
        state.documents
          .filter((d) => d.project === current)
          .map(
            (d) =>
              `<article><span class="pro-file-icon">DOC</span><div><strong>${E(d.name)}</strong><small>${d.chunks} trechos indexados · ${new Date(d.at).toLocaleDateString("pt-BR")}</small></div><button class="quiet" data-pro-remove-doc="${d.id}">Remover</button></article>`,
          )
          .join("") ||
        '<div class="pro-empty"><h3>Sua biblioteca começa aqui.</h3><p>Importe seus materiais para consultar informações com fontes identificadas.</p></div>'
      }</div><p class="muted">PDFs digitalizados precisam de OCR prévio. Pastas ignoram arquivos ocultos, credenciais e dependências.</p>`;
  }
  function assistants() {
    $("#pro-body").innerHTML =
      `<div class="pro-section-head"><div><span class="eyebrow">SUA EQUIPE DE IAS</span><h2>Assistentes com especialidade.</h2><p>Defina como cada assistente deve trabalhar e qual modelo usar.</p></div><button class="primary" data-pro="new-assistant">＋ Criar assistente</button></div><div class="pro-card-grid">${
        state.assistants
          .map(
            (a) =>
              `<article class="pro-card"><span class="pro-card-icon">✧</span><h3>${E(a.name)}</h3><p>${E(a.instructions.slice(0, 180))}</p><div class="actions"><button class="secondary" data-pro-edit-assistant="${a.id}">Editar</button><button class="quiet" data-pro-remove-assistant="${a.id}">Excluir</button></div></article>`,
          )
          .join("") ||
        [
          [
            "Escrita",
            "Ajude a escrever textos claros, revise gramática e preserve a voz do autor.",
          ],
          [
            "Programação",
            "Analise código com cuidado, explique alterações e identifique testes necessários.",
          ],
          [
            "Estudos",
            "Explique com exemplos, faça perguntas e adapte a dificuldade ao estudante.",
          ],
        ]
          .map(
            ([n, i]) =>
              `<article class="pro-card"><h3>${n}</h3><p>${i}</p><button class="secondary" data-pro-preset="${E(n)}" data-instructions="${E(i)}">Criar este assistente</button></article>`,
          )
          .join("")
      }</div>`;
  }
  function automations() {
    $("#pro-body").innerHTML =
      `<div class="pro-section-head"><div><span class="eyebrow">MENOS REPETIÇÃO</span><h2>Tarefas que você reutiliza.</h2><p>Prepare uma instrução uma vez e execute sobre os documentos do projeto.</p></div><button class="primary" data-pro="new-automation">Criar automação</button></div><div class="pro-card-grid">${state.automations.map((a) => `<article class="pro-card"><h3>${E(a.name)}</h3><p>${E(a.instructions.slice(0, 240))}</p><button class="primary" data-pro-run-automation="${a.id}">Executar neste projeto</button></article>`).join("") || "<p>Na área de trabalho, escolha Preparar automação e descreva sua tarefa.</p>"}</div>`;
  }
  async function diagnostics() {
    const d = await api("/pro/diagnostics");
    if (tab !== "diagnostics" || !isVisible()) return;
    $("#pro-body").innerHTML =
      `<div class="pro-section-head"><div><span class="eyebrow">SEU COMPUTADOR</span><h2>Desempenho com controle.</h2><p>${E(d.cpu)} · ${d.cores} núcleos · ${E(d.platform)} ${E(d.arch)}</p></div></div><div class="pro-card-grid"><article class="pro-card"><span>RAM disponível</span><h2>${(d.available_memory_bytes / 1024 ** 3).toFixed(1)} GiB</h2><p>de ${(d.total_memory_bytes / 1024 ** 3).toFixed(0)} GiB</p></article><article class="pro-card"><h3>Ajustes recomendados</h3>${d.advice.map((t) => `<p>${E(t)}</p>`).join("")}</article></div><form id="pro-profile" class="pro-settings-form"><h3>Perfil de execução</h3><label>Modelo<select id="pro-profile-model">${options().replace('<option value="auto">Automático · conforme a tarefa e RAM</option>', "")}</select></label><div class="pro-compose-options"><label>Contexto<select id="pro-context"><option>4096</option><option selected>8192</option><option>16384</option><option>32768</option></select></label><label>Resposta máxima<input id="pro-tokens" type="number" min="128" max="32768" value="4096"></label><label>Criatividade<input id="pro-temperature" type="number" min="0" max="2" step="0.1" value="0.4"></label></div><button class="primary">Salvar perfil</button><button class="secondary" type="button" data-page="models">Gerenciar modelos e memória</button></form>`;
    const restoreProfile = () => {
      const saved = d.profiles[$("#pro-profile-model").value];
      const context = $("#pro-context");
      const value = saved?.context || 8192;
      if (![...context.options].some((o) => Number(o.value) === value))
        context.add(new Option(String(value), String(value)));
      context.value = String(value);
      $("#pro-tokens").value = saved?.max_tokens || 4096;
      $("#pro-temperature").value = saved?.temperature ?? 0.4;
    };
    $("#pro-profile-model").onchange = restoreProfile;
    restoreProfile();
  }
  function backups() {
    $("#pro-body").innerHTML =
      `<div class="pro-section-head"><div><span class="eyebrow">PROTEÇÃO E RECUPERAÇÃO</span><h2>Seu trabalho continua sendo seu.</h2><p>Backup cifrado dos projetos Pro, documentos, assistentes e projetos do Estúdio.</p></div></div><div class="pro-card-grid"><form id="pro-backup-create" class="pro-card"><h3>Criar backup</h3><p>A senha deste arquivo é independente da senha do aplicativo.</p><label>Senha do backup<input id="pro-backup-password" type="password" minlength="12" maxlength="1024" required autocomplete="new-password"></label><button class="primary">Criar e baixar backup</button></form><form id="pro-backup-restore" class="pro-card"><h3>Restaurar backup</h3><label>Arquivo cifrado<input id="pro-backup-file" type="file" accept=".json" required></label><label>Senha do arquivo<input id="pro-restore-password" type="password" required autocomplete="off"></label><button class="secondary">Conferir backup</button></form></div><div id="pro-backup-history"></div><p class="muted">Guarde a senha: ela é necessária para recuperar o arquivo. O backup não inclui pesos de modelos nem chaves da API.</p>`;
    api("/pro/backups")
      .then((rows) => {
        if ($("#pro-backup-history"))
          $("#pro-backup-history").innerHTML =
            "<h3>Versões cifradas neste computador</h3>" +
            rows
              .map(
                (r) =>
                  `<p>${new Date(r.at).toLocaleString("pt-BR")} · ${(r.bytes / 1024 ** 2).toFixed(1)} MiB <a href="/v1/pro/backups/${r.id}" download>Baixar</a></p>`,
              )
              .join("");
      })
      .catch((e) => toast(e.message));
  }
  function dialog(title, html, fn) {
    $("#pro-dialog")?.remove();
    const el = document.createElement("dialog");
    el.id = "pro-dialog";
    el.innerHTML = `<form><div class="dialog-head"><h2>${E(title)}</h2><button type="button" data-pro-close aria-label="Fechar">×</button></div>${html}<div class="actions"><button class="primary" type="submit">Confirmar</button><button class="secondary" type="button" data-pro-close>Cancelar</button></div><p class="pro-dialog-error" role="status"></p></form>`;
    document.body.append(el);
    el.querySelectorAll("[data-pro-close]").forEach(
      (b) => (b.onclick = () => el.close()),
    );
    el.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const b = el.querySelector('[type="submit"]');
      b.disabled = true;
      try {
        await fn(el);
        el.close();
      } catch (e) {
        el.querySelector(".pro-dialog-error").textContent = e.message;
      } finally {
        b.disabled = false;
      }
    };
    el.showModal();
    return el;
  }
  async function saveEditor() {
    const p = project(),
      body = $("#pro-editor")?.value ?? p.body;
    const saved = await api("/pro/projects", {
      method: "POST",
      body: { id: p.id, name: p.name, body, expected: p.revision },
    });
    Object.assign(p, saved);
    dirty = false;
    if ($("#pro-editor-status"))
      $("#pro-editor-status").textContent = "Versão " + p.revision + " salva";
  }
  async function refresh() {
    if (!isVisible() || polling) return;
    polling = true;
    try {
      const fresh = await api("/pro");
      state.jobs = fresh.jobs;
      state.busy = fresh.busy; state.queue_paused = fresh.queue_paused;
      jobs();
      if(tab === "queue" && lastQueue !== JSON.stringify([fresh.jobs,fresh.queue_paused]) && !document.activeElement?.matches("select,input,textarea")) {lastQueue=JSON.stringify([fresh.jobs,fresh.queue_paused]);$("#pro-body").innerHTML = queueHTML(state,E);}
    } catch {
    } finally {
      polling = false;
    }
  }
  async function reload() {
    const subscription = state?.subscription;
    state = {...await api("/pro"),subscription};
    if (!project()) current = state.projects[0]?.id || "";
    shell();
  }
  function assistantForm(
    a = {
      id: crypto.randomUUID(),
      name: "",
      instructions: "",
      model: "auto",
      temperature: 0.4,
    },
  ) {
    dialog(
      "Configurar assistente",
      `<label>Nome<input name="name" value="${E(a.name)}" maxlength="100" required></label><label>Instruções<textarea name="instructions" rows="6" maxlength="12000" required>${E(a.instructions)}</textarea></label><label>Modelo<select name="model">${options()}</select></label><label>Criatividade<input name="temperature" type="number" min="0" max="2" step="0.1" value="${a.temperature}"></label>`,
      async (el) => {
        const f = new FormData(el.querySelector("form"));
        await api("/pro/assistants", {
          method: "POST",
          body: {
            id: a.id,
            ...Object.fromEntries(f),
            temperature: Number(f.get("temperature")),
          },
        });
        await reload();
      },
    ).querySelector('[name="model"]').value = a.model;
  }
  document.addEventListener("submit", async (e) => {
    if (!isVisible() || !e.target.closest(".pro-app")) return;
    e.preventDefault();
    const button = e.target.querySelector(
      'button[type="submit"],button:not([type])',
    );
    if (button) button.disabled = true;
    try {
      if (e.target.id === "pro-compose") {
        const kind = $("#pro-kind").value;
        await api("/pro/jobs", {
          method: "POST",
          body: {
            project: current,
            prompt: $("#pro-prompt").value,
            kind,
            quality: $("#pro-quality").value, style: $("#pro-style").value, language: $("#pro-language").value,
            model: $("#pro-model").value,
            assistant: $("#pro-assistant").value || undefined,
            documents: [
              ...document.querySelectorAll('[name="pro-document"]:checked'),
            ].map((i) => i.value),
            internet: $("#pro-internet").checked,
            urls: ($("#pro-urls")?.value || "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            format: $("#pro-format").value,
          },
        });
        draft = "";
        $("#pro-prompt").value = "";
        rememberDraft();
        await refresh();
      }
      if (e.target.id === "pro-search-form") {
        const rows = await api("/pro/search", {
          method: "POST",
          body: { project: current, query: $("#pro-search").value },
        });
        $("#pro-search-results").innerHTML =
          rows
            .map(
              (r) =>
                `<article class="pro-card"><strong>${E(r.name)} · ${E(r.location)}</strong><p>${E(r.text)}</p></article>`,
            )
            .join("") || "<p>Nenhum trecho correspondente.</p>";
      }
      if (e.target.id === "pro-profile") {
        await api("/pro/profiles", {
          method: "POST",
          body: {
            key: $("#pro-profile-model").value,
            options: {
              context: Number($("#pro-context").value),
              max_tokens: Number($("#pro-tokens").value),
              temperature: Number($("#pro-temperature").value),
            },
          },
        });
        toast("Perfil salvo.");
      }
      if (e.target.id === "pro-backup-create") {
        const studio = [];
        let bytes = 0;
        for (const p of await listProjects()) {
          const b = await projectBundle(p);
          bytes += b.size;
          if (bytes > 120 * 1024 ** 2)
            throw Error(
              "Os projetos de mídia ultrapassam 120 MiB. Baixe os projetos maiores separadamente.",
            );
          studio.push(JSON.parse(await b.text()));
        }
        const data = await api("/pro/backup", {
          method: "POST",
          body: { password: $("#pro-backup-password").value, studio },
        });
        download(
          new Blob([JSON.stringify(data)], { type: "application/json" }),
          "LocalNeuron-backup-" +
            new Date().toISOString().slice(0, 10) +
            ".json",
        );
        $("#pro-backup-password").value = "";
        backups();
      }
      if (e.target.id === "pro-backup-restore") {
        const file = $("#pro-backup-file").files[0];
        if (file.size > 245 * 1024 ** 2) throw Error("Backup excede 245 MiB.");
        const backup = JSON.parse(await file.text()),
          password = $("#pro-restore-password").value,
          data = await api("/pro/backup/inspect", {
            method: "POST",
            body: { backup, password },
          });
        dialog(
          "Restaurar este backup?",
          `<p>${data.pro.projects.length} projetos Pro e ${(data.studio || []).length} projetos de mídia.</p><p>Os dados Pro atuais serão substituídos. Projetos do Estúdio serão importados como cópias, preservando os atuais.</p>`,
          async () => {
            for (const bundle of data.studio || [])
              await importBundle(
                new File([JSON.stringify(bundle)], "projeto.json", {
                  type: "application/json",
                }),
              );
            await api("/pro/backup/restore", {
              method: "POST",
              body: { backup, password },
            });
            current = "";
            await reload();
            toast("Backup restaurado.");
          },
        );
      }
    } catch (e) {
      toast(e.message);
    } finally {
      if (button) button.disabled = false;
    }
  });
  document.addEventListener("input", (e) => {
    if(e.target.id==='pro-template-search') { const start=e.target.selectionStart,query=e.target.value; $('#pro-body').innerHTML=templatesHTML(state,E,query);$('#pro-template-search').focus();$('#pro-template-search').setSelectionRange(start,start); }
    if (e.target.id === "pro-editor") {
      dirty = true;
      $("#pro-editor-status").textContent = "Alterações não salvas";
    }
    if (e.target.id === "pro-prompt") {draft = e.target.value;rememberDraft();}
  });
  document.addEventListener("change", async (e) => {
    if(e.target.closest("#pro-compose"))rememberDraft();
    if (e.target.dataset.proPriority) { try { await api('/pro/jobs/'+e.target.dataset.proPriority+'/priority',{method:'POST',body:{priority:Number(e.target.value)}}); await refresh(); } catch(error){toast(error.message);} }
    if (e.target.id === "pro-kind") kindOptions();
    if (!["pro-files", "pro-folder"].includes(e.target.id)) return;
    const files = [...e.target.files]
      .filter(
        (f) =>
          !/(^|\/)(\.|node_modules\/|vendor\/|dist\/|\.git\/)|\.(pem|key|p12|pfx)$|(^|\/)(credentials|secrets|service-account)(\.|$)/i.test(
            f.webkitRelativePath || f.name,
          ),
      )
      .filter((f) =>
        /\.(pdf|docx|xlsx|csv|txt|md|json|js|ts|jsx|tsx|py|html|css|sql|yaml|yml|rs|go|java|c|cpp|h)$/i.test(
          f.name,
        ),
      );
    if (files.length > 100) {
      toast("Selecione até 100 arquivos por importação.");
      return;
    }
    const destination = current;
    try {
      let count = 0;
      for (const file of files) {
        if (file.size > 12 * 1024 ** 2)
          throw Error(file.name + ": excede 12 MiB.");
        const data = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(",")[1]);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        await api("/pro/documents", {
          method: "POST",
          body: {
            project: destination,
            name: (file.webkitRelativePath || file.name).slice(-240),
            data,
          },
        });
        toast(`Importando ${++count} de ${files.length} arquivos…`);
      }
      await reload();
      toast(files.length + " arquivos importados.");
    } catch (e) {
      toast(e.message);
      await reload();
    }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || !isVisible() || !b.closest(".pro-app")) return;
    try {
      if(b.dataset.premiumCase){b.closest('.premium-proof').outerHTML=benefitComparison(E,b.dataset.premiumCase);return;}
      if(b.dataset.proQuickStart){
        if(!state.subscription?.active){document.dispatchEvent(new CustomEvent('localneuron:pro-required',{detail:{feature:'projects'}}));return;}
        const starter=STARTERS.find(t=>t.id===b.dataset.proQuickStart);if(!starter)return;
        if(dirty)await saveEditor();rememberDraft();
        const el=dialog('Prepare seu projeto',`<p class="muted">${E(starter.name)} · o pedido ficará pronto para você conferir.</p><label>Onde trabalhar<select name="project"><option value="new">Criar um novo projeto</option>${state.projects.map(p=>`<option value="${p.id}" ${p.id===current?'selected':''}>${E(p.name)}</option>`).join('')}</select></label><label data-new-project-name>Nome do novo projeto<input name="name" maxlength="100" value="${E(starter.name)}"></label><div class="premium-prepare-note"><span class="premium-seal">✦ PRO</span><p>Modo <strong>Com revisão</strong> preparado. Você pode mudar o modo, anexar arquivos e escolher a IA antes de executar.</p></div>`,async el=>{
          const f=new FormData(el.querySelector('form'));let projectId=f.get('project');
          if(projectId==='new'){const name=String(f.get('name')||'').trim();if(!name)throw Error('Dê um nome ao projeto.');const p=await api('/pro/projects',{method:'POST',body:{name}});projectId=p.id;}
          current=String(projectId);draft='';tab='work';localStorage.setItem('localneuron-pro-project',current);await reload();
          $('#pro-prompt').value=starter.prompt;$('#pro-kind').value=starter.kind;$('#pro-quality').value='thorough';rememberDraft();kindOptions();$('#pro-prompt').focus();toast('Pedido preparado. Confira os detalhes e clique em Executar tarefa quando estiver pronto.');
        });
        const select=el.querySelector('[name=project]'),name=el.querySelector('[data-new-project-name]');const sync=()=>{name.hidden=select.value!=='new';el.querySelector('[name=name]').required=select.value==='new';};select.onchange=sync;sync();el.querySelector('[type=submit]').textContent='Preparar pedido →';return;
      }
      if(b.hasAttribute('data-pro-focus')) { $('.pro-app').classList.toggle('pro-focus'); b.textContent=$('.pro-app').classList.contains('pro-focus')?'Sair do foco':'Modo foco'; return; }
      if(b.dataset.proQueue) { await api('/pro/queue',{method:'POST',body:{paused:b.dataset.proQueue==='true'}}); await reload(); return; }
      if(b.dataset.proDeleteTemplate) { await api('/pro/templates/'+b.dataset.proDeleteTemplate,{method:'DELETE'}); await reload(); return; }
      if(b.hasAttribute('data-pro-new-template')) { dialog('Criar atalho de trabalho','<label>Nome<input name="name" maxlength="100" required></label><label>Pedido reutilizável<textarea name="prompt" rows="8" maxlength="16000" required></textarea></label>',async el=>{const f=new FormData(el.querySelector('form'));await api('/pro/templates',{method:'POST',body:{name:f.get('name'),prompt:f.get('prompt')}});await reload();});return; }
      if(b.dataset.proTemplate) {
        const t=[...STARTERS,...state.templates].find(t=>t.id===b.dataset.proTemplate);if(!t)return;
        if(dirty)await saveEditor();
        if(!project()){toast('Crie um projeto primeiro para preparar o pedido.');return;}
        draft=t.prompt;tab='work';shell();$('#pro-prompt').value=t.prompt;$('#pro-kind').value=t.kind;$('#pro-quality').value=t.quality;rememberDraft();kindOptions();$('#pro-prompt').focus();toast('Pedido preparado. Adapte antes de executar.');return;
      }
      if (b.dataset.proProject || b.dataset.proTab) {
        if (dirty) await saveEditor();
        if (b.dataset.proProject) {
          current = b.dataset.proProject; draft = ""; tab = "work";
          localStorage.setItem("localneuron-pro-project", current);
        }
        if (b.dataset.proTab) tab = b.dataset.proTab;
        shell();
        return;
      }
      if (b.dataset.proExample) {
        $("#pro-prompt").value = b.dataset.proExample;
        draft = b.dataset.proExample;rememberDraft();
      }
      if (b.dataset.proCancel) {
        await api(`/pro/jobs/${b.dataset.proCancel}/cancel`, {
          method: "POST",
          body: {},
        });
        await refresh();
      }
      if (b.dataset.proRepeat) {
        const j = state.jobs.find((j) => j.id === b.dataset.proRepeat);
        await api("/pro/jobs", { method: "POST", body: j.input });
        await refresh();
      }
      if (b.dataset.proResult) {
        const j = state.jobs.find((j) => j.id === b.dataset.proResult);
        dialog(
          "Revisar proposta",
          `<div class="pro-diff"><div><strong>Documento atual</strong><pre>${E($("#pro-editor").value)}</pre></div><div><strong>Proposta</strong><pre>${E(j.output)}</pre></div></div><p>Confirmar coloca a proposta no editor. Use Salvar versão para registrar.</p>`,
          async () => {
            $("#pro-editor").value = j.output;
            dirty = true;
            $("#pro-editor-status").textContent =
              "Proposta aplicada · salve a versão";
          },
        );
      }
      if (b.dataset.proStory) {
        const j = state.jobs.find((j) => j.id === b.dataset.proStory);
        const raw = j.output
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, "");
        const story = JSON.parse(raw);
        if (
          !Array.isArray(story.scenes) ||
          story.scenes.length < 1 ||
          story.scenes.length > 6
        )
          throw Error(
            "O modelo não retornou um roteiro válido. Peça somente JSON com 2 a 4 cenas.",
          );
        localStorage.setItem("localneuron-storyboard", JSON.stringify(story));
        navigate("studio");
      }
      if (b.dataset.proRemoveDoc) {
        await api("/pro/documents/" + b.dataset.proRemoveDoc, {
          method: "DELETE",
        });
        await reload();
      }
      if (b.dataset.proEditAssistant)
        assistantForm(
          state.assistants.find((a) => a.id === b.dataset.proEditAssistant),
        );
      if (b.dataset.proRemoveAssistant) {
        await api("/pro/assistants/" + b.dataset.proRemoveAssistant, {
          method: "DELETE",
        });
        await reload();
      }
      if (b.dataset.proPreset)
        assistantForm({
          id: crypto.randomUUID(),
          name: b.dataset.proPreset,
          instructions: b.dataset.instructions,
          model: "auto",
          temperature: 0.4,
        });
      if (b.dataset.proAutomation) {
        const j = state.jobs.find((j) => j.id === b.dataset.proAutomation);
        automationForm(j.output);
      }
      if (b.dataset.proRunAutomation) {
        const a = state.automations.find(
          (a) => a.id === b.dataset.proRunAutomation,
        );
        await api("/pro/jobs", {
          method: "POST",
          body: {
            project: current,
            prompt: a.instructions,
            kind: a.kind,
            documents: state.documents
              .filter((d) => d.project === current)
              .slice(0, 30)
              .map((d) => d.id),
            internet: false,
          },
        });
        tab = "work";
        await reload();
      }
      const action = b.dataset.pro;
      if (action === "new-project" && !state.subscription?.active) { document.dispatchEvent(new CustomEvent("localneuron:pro-required",{detail:{feature:"projects"}})); return; }
      if (action === "new-project")
        dialog(
          "Novo projeto",
          '<label>Nome<input id="pro-new-name" maxlength="100" required placeholder="Ex.: Conteúdo da minha empresa"></label>',
          async () => {
            const p = await api("/pro/projects", {
              method: "POST",
              body: { name: $("#pro-new-name").value },
            });
            current = p.id; draft = ""; localStorage.setItem("localneuron-pro-project",current);
            tab = "work";
            await reload();
          },
        );
      if (action === "rename")
        dialog(
          "Nome do projeto",
          `<label>Nome<input id="pro-new-name" value="${E(project().name)}" maxlength="100" required></label>`,
          async () => {
            await api("/pro/projects", {
              method: "POST",
              body: {
                id: current,
                name: $("#pro-new-name").value,
                expected: project().revision,
              },
            });
            await reload();
          },
        );
      if (action === "delete-project")
        dialog(
          "Excluir projeto?",
          `<p>Excluir ${E(project().name)}, seus documentos e histórico Pro? Esta ação não remove os arquivos originais do computador.</p>`,
          async () => {
            await api("/pro/projects/" + current, { method: "DELETE" });
            await reload();
          },
        );
      if (action === "memory")
        dialog(
          "Memória do projeto",
          `<p>Decisões e preferências que o assistente deve lembrar. Você controla este conteúdo.</p><textarea id="pro-memory" rows="10" maxlength="12000">${E(project().memory)}</textarea>`,
          async () => {
            await api("/pro/projects", {
              method: "POST",
              body: {
                id: current,
                name: project().name,
                memory: $("#pro-memory").value,
                expected: project().revision,
              },
            });
            const subscription = state?.subscription;
    state = {...await api("/pro"),subscription};
          },
        );
      if (action === "save-editor") await saveEditor();
      if (action === "versions") {
        const p = project();
        dialog(
          "Recuperar uma versão",
          `<label>Versão<select id="pro-version">${p.versions
            .slice()
            .reverse()
            .map(
              (v) =>
                `<option value="${v.id}">${new Date(v.at).toLocaleString("pt-BR")} · ${v.body.length} caracteres</option>`,
            )
            .join(
              "",
            )}</select></label><p>O texto recuperado será colocado no editor para revisão.</p>`,
          async () => {
            const v = p.versions.find((v) => v.id === $("#pro-version").value);
            if (!v) throw Error("Ainda não há versões anteriores.");
            $("#pro-editor").value = v.body;
            dirty = true;
            $("#pro-editor-status").textContent =
              "Versão recuperada · salve para confirmar";
          },
        );
      }
      if (action === "export") {
        await saveEditor();
        const format = $("#pro-format").value;
        const r = await fetch(`/v1/pro/projects/${current}/export/${format}`);
        if (!r.ok) throw Error((await r.json()).error);
        download(
          await r.blob(),
          project().name.replace(/[^\p{L}\p{N} _-]/gu, "") + "." + format,
        );
      }
      if (action === "upload") $("#pro-files").click();
      if (action === "folder") $("#pro-folder").click();
      if (action === "new-assistant") assistantForm();
      if (action === "new-automation") automationForm("");
    } catch (e) {
      toast(e.message);
    }
  });
  function automationForm(instructions) {
    dialog(
      "Salvar automação",
      `<label>Nome<input id="pro-auto-name" maxlength="100" required></label><label>Instrução reutilizável<textarea id="pro-auto-instructions" rows="7" maxlength="16000" required>${E(instructions)}</textarea></label><label>Aplicar<select id="pro-auto-kind"><option value="batch">A cada documento do projeto</option><option value="answer">Uma vez, usando a biblioteca</option></select></label>`,
      async () => {
        await api("/pro/automations", {
          method: "POST",
          body: {
            name: $("#pro-auto-name").value,
            instructions: $("#pro-auto-instructions").value,
            kind: $("#pro-auto-kind").value,
          },
        });
        const subscription = state?.subscription;
    state = {...await api("/pro"),subscription};
        toast("Automação salva.");
      },
    );
  }
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener('keydown',e=>{if(!isVisible()||!(e.metaKey||e.ctrlKey)||document.querySelector('dialog[open]'))return;if(e.key==='Enter'&&$('#pro-compose')){e.preventDefault();if(!$('#pro-compose button[type=submit]')?.disabled)$('#pro-compose').requestSubmit();}if(e.key.toLowerCase()==='s'&&$('#pro-editor')){e.preventDefault();saveEditor().then(()=>toast('Versão salva.')).catch(error=>toast(error.message));}});
  function stop() {
    if (dirty && $("#pro-editor"))
      void saveEditor().catch((e) => toast(e.message));
    rememberDraft();
    clearInterval(timer);
    timer = null;
  }
  return { render, stop, selectProject:id=>{current=id;draft="";tab="work";localStorage.setItem("localneuron-pro-project",id);} };
}
