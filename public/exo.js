import { icon } from "./icons.js";
export function createExo({ api, escape, toast, navigate, isVisible }) {
  const $ = (s) => document.querySelector(s);
  let state = null,
    pending = false,
    refreshing = false,
    selectionMode = "auto",
    selectedNodes = new Set();
  const gib = (n) =>
    Number(n / 1024 ** 3).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    }) + " GiB";
  async function refresh() {
    if (refreshing || !isVisible()) return;
    refreshing = true;
    try {
      state = await api("/exo");
      if (isVisible()) draw();
    } catch (e) {
      toast(e.message);
    } finally {
      refreshing = false;
    }
  }
  async function render() {
    state = await api("/exo");
    if (!isVisible()) return;
    $("#content").innerHTML =
      `<div class="page-head"><div><span class="eyebrow">COMPUTAÇÃO DISTRIBUÍDA</span><h1>Rede EXO</h1><p class="subhead">Vários computadores. Espaço para uma IA maior.</p></div><button class="secondary" data-exo="refresh">Atualizar rede</button></div><div class="exo-overview"><div><span>Máquinas conectadas</span><strong id="exo-count">—</strong></div><div><span>RAM total da rede</span><strong id="exo-total">—</strong></div><div><span>Memória disponível</span><strong id="exo-memory">—</strong></div></div><p class="exo-explanation">O EXO divide modelos compatíveis entre as máquinas. A RAM disponível é uma estimativa: contexto, sistema e comunicação também consomem memória. Mais máquinas não garantem mais velocidade.</p><div class="exo-columns"><section class="panel exo-connect"><h2>Como você quer conectar?</h2><p>Participe com a memória deste Mac ou gerencie uma rede EXO que já está rodando em outra máquina.</p><form id="exo-config"><label>Modo de conexão<select id="exo-mode"><option value="local">Participar com este Mac</option><option value="remote">Controlar um EXO existente</option></select></label><div id="exo-local-settings"><label>Identificação da rede<input id="exo-network" maxlength="60" pattern="[a-zA-Z0-9_-]{4,60}" value="${escape(state.network)}" required></label><button type="button" class="quiet exo-copy" data-exo="copy">Copiar identificação</button><label class="check-line"><input id="exo-offline" type="checkbox" ${state.offline ? "checked" : ""}>Iniciar sem internet · somente modelos já baixados</label></div><div id="exo-remote-settings"><label>IP ou endereço da máquina principal<input id="exo-endpoint" value="${escape(state.endpoint)}" placeholder="192.168.1.20 ou http://192.168.1.20:52415" maxlength="150"></label><p>Este modo controla os modelos do EXO nesse endereço, inclusive pelo Windows. Para somar a RAM de outros Macs, inicie o motor em cada um usando a mesma identificação de rede. Use somente sua rede privada confiável.</p><button class="secondary" type="submit">Conectar e gerenciar</button></div><div class="actions"><button type="button" class="primary" data-exo="start">Iniciar neste Mac</button><button type="button" class="secondary" data-exo="stop">Desconectar</button></div></form><div id="exo-install"></div><div id="exo-message" role="status"></div></section><section class="panel exo-machines"><h2>Computadores da rede</h2><p>Controle os modelos compartilhados e acompanhe a memória. Os arquivos e a tela de cada computador continuam no próprio equipamento.</p><div id="exo-addresses"></div><div id="exo-nodes"></div><details class="exo-help"><summary>Como conectar outra máquina</summary><ol><li>Instale o LocalNeuron na outra máquina e abra <strong>Rede EXO</strong>.</li><li>Escolha <strong>Participar com este Mac</strong>, instale o motor EXO, copie a mesma identificação de rede e clique em <strong>Iniciar neste Mac</strong> nas duas.</li><li>Mantenha as máquinas na mesma rede e permita o acesso à rede local caso o sistema peça.</li><li>Espere as máquinas aparecerem aqui. Escolha um modelo e prepare-o na rede.</li></ol><p>Ethernet ou Thunderbolt podem oferecer melhor comunicação que Wi-Fi. RDMA exige hardware e configuração específicos; não é necessário para começar.</p><p>Use uma rede confiável: a identificação da rede não é uma senha. Mensagens e partes do modelo circulam entre os computadores. Não exponha a porta do EXO à internet.</p><p>O instalador integrado usa EXO ${escape(state.installation.version)} e requer Mac Apple Silicon com macOS 26.2+. No Linux, instale a versão compatível pelo <a href="https://github.com/exo-explore/exo" target="_blank" rel="noreferrer">projeto EXO</a>. Windows funciona como cliente de uma rede EXO; não há motor EXO nativo para Windows nesta integração.</p></details></section></div><section class="panel exo-models"><div class="section-line"><h2>Preparar uma IA na rede</h2><span class="muted" id="exo-catalog-count"></span></div><p>Este catálogo vem do EXO conectado. Preparar pode baixar os arquivos necessários nas máquinas; modelos GGUF do motor llama.cpp não são convertidos automaticamente.</p><div class="exo-selection"><label>Máquinas para esta IA<select id="exo-selection"><option value="auto">EXO escolhe automaticamente</option><option value="manual">Escolher os computadores</option></select></label><button type="button" class="quiet" data-exo="clear-selection">Limpar seleção</button><p id="exo-selection-info" role="status"></p></div><div class="exo-model-controls"><label>Encontrar modelo<input id="exo-search" type="search" placeholder="Qwen, DeepSeek, Llama…"></label><label>Modelo<select id="exo-model" aria-label="Modelo EXO"></select></label><label>Mínimo de máquinas<select id="exo-node-number"><option value="2">2</option><option value="1">1 · testar sozinho</option></select></label><label>Divisão<select id="exo-sharding"><option value="Pipeline">Por camadas · compatível</option><option value="Tensor">Por tensores · se suportado</option></select></label></div><div class="exo-model-info" id="exo-model-info"></div><button class="primary" data-exo="prepare">Preparar na rede</button><div id="exo-instances"></div></section>`;
    $("#exo-mode").value = state.installation.running || state.endpoint === "http://127.0.0.1:52415" && state.installation.supported ? "local" : "remote";
    $("#exo-mode").addEventListener("change", connectionMode);
    $("#exo-selection").value = selectionMode;
    $("#exo-selection").addEventListener("change", () => { selectionMode = $("#exo-selection").value; draw(); });
    $("#exo-nodes").addEventListener("change", e => { const id = e.target.dataset.exoNode; if (!id) return; if(e.target.checked) selectedNodes.add(id); else selectedNodes.delete(id); draw(); });
    connectionMode();
    $("#exo-search").addEventListener("input", drawModels);
    $("#exo-model").addEventListener("change", modelInfo);
    $("#exo-config").addEventListener("submit", (e) => {
      e.preventDefault();
      run("connect");
    });
    draw();
  }
  function connectionMode() {
    const local = $("#exo-mode").value === "local";
    $("#exo-local-settings").hidden = !local;
    $("#exo-remote-settings").hidden = local;
    $('[data-exo="start"]').hidden = !local;
    $("#exo-install").hidden = !local;
  }
  function drawModels() {
    if (!state || !$("#exo-model")) return;
    const selected = $("#exo-model").value;
    const q = $("#exo-search").value.toLowerCase();
    const models = state.catalog.filter((m) =>
      (m.id + " " + m.name).toLowerCase().includes(q),
    );
    $("#exo-model").innerHTML =
      models
        .map(
          (m) =>
            `<option value="${escape(m.id)}">${escape(m.name)} · ${gib(m.size)}</option>`,
        )
        .join("") || '<option value="">Nenhum modelo disponível</option>';
    if (models.some((m) => m.id === selected)) $("#exo-model").value = selected;
    modelInfo();
  }
  function modelInfo() {
    const m = state.catalog.find((m) => m.id === $("#exo-model")?.value);
    $("#exo-model-info").textContent = m
      ? `${m.id} · arquivos: ${gib(m.size)} · contexto informado: ${Math.round(m.context / 1024)}k · ${m.tensor ? "suporta divisão por tensores" : "divisão por camadas"}`
      : "Conecte o EXO para consultar os modelos compatíveis.";
    const b = $('[data-exo="prepare"]');
    if (b) b.disabled = pending || !state.connected || !m || selectionMode === "manual" && (!selectedNodes.size || [...selectedNodes].some(id => !state.nodes.some(n => n.id === id)));
  }
  function draw() {
    if (!$("#exo-count") || !state) return;
    $("#exo-count").textContent = state.connected
      ? String(state.nodes.length)
      : "—";
    $("#exo-total").textContent = state.connected
      ? gib(state.total_memory)
      : "—";
    $("#exo-memory").textContent = state.connected
      ? gib(state.available_memory)
      : "—";
    $("#exo-nodes").innerHTML =
      state.nodes
        .map(
          (n, i) =>
            `<div class="exo-node">${selectionMode === "manual" ? `<input type="checkbox" data-exo-node="${escape(n.id)}" aria-label="Usar ${escape(n.name)}" ${selectedNodes.has(n.id) ? "checked" : ""}>` : ""}<span class="exo-node-icon">${icon("monitor")}</span><div><strong>${escape(n.name)}</strong><p>${escape(n.chip)}</p><span>${gib(n.available)} disponíveis / ${gib(n.total)}</span><p>${state.instances.filter(i => i.nodes.includes(n.id)).map(i => escape(i.model)).join(" · ") || "Sem modelo carregado"}</p></div><span class="exo-node-number">${String(i + 1).padStart(2, "0")}</span></div>`,
        )
        .join("") ||
      '<div class="exo-empty">Nenhuma máquina conectada.<br>Inicie este nó ou conecte a um EXO existente.</div>';
    $("#exo-addresses").innerHTML = (state.connection_addresses || []).length ? `<div class="exo-address-list"><strong>Para controlar este Mac de outra máquina</strong><p>No outro LocalNeuron, escolha “Controlar um EXO existente” e cole um destes endereços da rede privada:</p>${state.connection_addresses.map(address => `<button class="secondary" data-exo-address="${escape(address)}">${escape(address)} · Copiar</button>`).join("")}</div>` : state.connected ? `<p>Controlando a rede em <strong>${escape(state.endpoint)}</strong></p>` : "";
    const missing = [...selectedNodes].filter(id => !state.nodes.some(n => n.id === id));
    $("#exo-selection-info").textContent = selectionMode === "manual" ? `${selectedNodes.size} máquina(s) selecionada(s). ${missing.length ? "Uma máquina saiu da rede. Limpe a seleção ou aguarde a reconexão." : "Marque os computadores na lista acima. A preparação usará somente essas máquinas."}` : "O EXO decide quais máquinas têm memória e conexão para executar o modelo.";
    const install = state.installation;
    const working = ["downloading", "verifying", "installing"].includes(
      install.phase,
    );
    $("#exo-install").innerHTML = working
      ? `<p>${{ downloading: "Baixando o motor EXO", verifying: "Conferindo o pacote EXO", installing: "Instalando o motor EXO" }[install.phase]} · ${Math.round((100 * install.downloaded) / install.total)}%</p><progress max="${install.total}" value="${install.downloaded}" aria-label="Instalação EXO"></progress><button class="quiet" data-exo="cancel">Cancelar instalação</button>`
      : install.installed
        ? `<p class="muted">Motor EXO ${escape(install.version)} instalado neste computador.</p>`
        : `<button class="secondary" data-exo="install" ${!install.supported ? "disabled" : ""}>Instalar motor EXO · ${Math.round(install.total / 1024 ** 2)} MB</button>${!install.supported ? "<p>Instalação automática disponível em Mac Apple Silicon com macOS 26.2+. Você ainda pode conectar a API de outro computador.</p>" : ""}`;
    $("#exo-network").disabled = install.running || pending;
    $("#exo-offline").disabled = install.running || pending;
    $("#exo-config button[type=submit]").disabled = pending || install.running;
    $("#exo-message").textContent =
      install.error ||
      state.error ||
      (state.connected
        ? state.nodes.length < 2
          ? "Conectado. Adicione outra máquina para distribuir um modelo."
          : "Rede conectada. As informações são atualizadas a cada 4 segundos."
        : "O motor está desconectado.");
    $('[data-exo="start"]').disabled =
      pending || !install.installed || install.running;
    $('[data-exo="stop"]').disabled =
      pending || (!state.enabled && !install.running);
    const selected = $("#exo-node-number").value;
    $("#exo-node-number").innerHTML = Array.from(
      { length: Math.max(2, state.nodes.length) },
      (_, i) =>
        `<option value="${i + 1}">${i + 1}${i === 0 ? " · testar sozinho" : ""}</option>`,
    ).join("");
    $("#exo-node-number").disabled = selectionMode === "manual";
    $("#exo-node-number").value = selectionMode === "manual" ? String(selectedNodes.size || 1) : selected || "2";
    $("#exo-catalog-count").textContent =
      state.catalog.length + " modelos de texto";
    drawModels();
    $("#exo-instances").innerHTML = state.instances
      .map(
        (i) =>
          `<article class="exo-instance"><div><strong>${escape(i.model)}</strong><p>${i.nodes.map(id => escape(state.nodes.find(n => n.id === id)?.name || "Máquina desconectada")).join(" + ")} · ${{ ready: "Pronto para conversar", running: "Gerando resposta", loading: "Baixando, conectando ou carregando", failed: "Falha na preparação do modelo.", disconnected: "Máquina desconectada · modelo indisponível" }[i.state]}</p>${i.progress?.total && !i.ready ? `<p>Download nas máquinas: ${gib(i.progress.downloaded)} / ${gib(i.progress.total)} · ${Math.min(100, Math.round((i.progress.downloaded / i.progress.total) * 100))}%</p>` : ""}${i.error ? `<p class="exo-error">${escape(i.error)}</p>` : ""}</div><div class="actions">${i.ready ? `<button class="primary" data-exo-chat="${escape("exo:" + i.model)}">Conversar</button>` : ""}<button class="secondary" data-exo-remove="${escape(i.id)}">Liberar modelo</button></div></article>`,
      )
      .join("");
  }
  const configuration = (local = false) => ({
    enabled: true,
    endpoint: local ? "http://127.0.0.1:52415" : $("#exo-endpoint").value.trim(),
    network: $("#exo-network").value.trim(),
    offline: $("#exo-offline").checked,
  });
  async function run(action, id) {
    if (pending) return;
    pending = true;
    draw();
    try {
      if (action === "refresh") await refresh();
      else if (action === "clear-selection") { selectedNodes.clear(); }
      else if (action === "copy-address") { await navigator.clipboard.writeText(id); toast("Endereço copiado. Cole no outro LocalNeuron em Controlar um EXO existente."); }
      else if (action === "copy") {
        await navigator.clipboard.writeText($("#exo-network").value);
        toast("Identificação copiada. Use a mesma nas outras máquinas.");
      } else if (action === "install") {
        await api("/exo/install", { method: "POST", body: {} });
        toast("Instalação iniciada. Você pode continuar usando o app.");
      } else if (action === "cancel")
        await api("/exo/install/cancel", { method: "POST", body: {} });
      else if (action === "connect" || action === "start") {
        await api("/exo/config", { method: "POST", body: configuration(action === "start") });
        if (action === "start")
          await api("/exo/start", { method: "POST", body: {} });
        toast(
          action === "start"
            ? "EXO iniciado. Aguarde a descoberta das máquinas."
            : "Endereço configurado. Conferindo a rede…",
        );
      } else if (action === "stop")
        await api("/exo/stop", { method: "POST", body: {} });
      else if (action === "prepare") {
        await api("/exo/prepare", {
          method: "POST",
          body: {
            model: $("#exo-model").value,
            nodes: selectionMode === "manual" ? selectedNodes.size : Number($("#exo-node-number").value),
            selected: selectionMode === "manual" ? [...selectedNodes] : [],
            sharding: $("#exo-sharding").value,
          },
        });
        toast(
          "Preparação enviada ao EXO. Aguarde o download e o carregamento nas máquinas.",
        );
      } else if (action === "remove") {
        const item = state.instances.find(i => i.id === id);
        if (item && confirm(`Liberar ${item.model} em ${item.nodes.length} máquina(s)? Isso interrompe o uso desse modelo para todas as pessoas da rede, mas mantém os arquivos baixados.`))
          await api("/exo/remove", { method: "POST", body: { id } });
      }
      await refresh();
    } catch (e) {
      toast(e.message);
    } finally {
      pending = false;
      if (isVisible()) draw();
    }
  }
  document.addEventListener("click", (e) => {
    if (!isVisible()) return;
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.exoAddress) run("copy-address", b.dataset.exoAddress);
    else if (b.dataset.exoChat) navigate("chat", b.dataset.exoChat);
    else if (b.dataset.exoRemove) run("remove", b.dataset.exoRemove);
    else if (b.dataset.exo) run(b.dataset.exo);
  });
  setInterval(() => {
    if (isVisible() && !pending) void refresh();
  }, 4000);
  return { render };
}
