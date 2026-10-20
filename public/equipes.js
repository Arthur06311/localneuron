import { isAdvancedModel } from './crew-mascots.js';

export const MARKS = [
  ['norte', 'Norte'],
  ['grade', 'Grade'],
  ['lente', 'Lente'],
  ['traco', 'Traço'],
  ['selo', 'Selo'],
  ['marco', 'Marco'],
];

const MARK_BY_MASCOT = { coordenador: 'norte', codigo: 'grade', pesquisa: 'lente', redacao: 'traco', analise: 'selo' };
const MASCOT_BY_MARK = { norte: 'coordenador', grade: 'codigo', lente: 'pesquisa', traco: 'redacao', selo: 'analise', marco: 'codigo' };
const STORE_KEY = 'localneuron-equipes-sections';

export const ERRORS = {
  'local-missing': 'Nenhum modelo local instalado. Instale um modelo em Modelos. Modelos grandes ficam em Avançado.',
  'exo-offline': 'A rede EXO não respondeu. Abra Conectar, em Rede EXO, e confira se o motor está ligado.',
  'remote-offline': 'A API não respondeu nesse endereço. Confira o outro computador e se os dois estão na mesma rede.',
  'key-missing': 'Falta a chave. Cole a chave da sua conta. Ela fica no cofre deste computador.',
  'key-invalid': 'A chave foi recusada. Confira se está completa e se a conta ainda tem acesso.',
  'bad-address': 'Use um endereço privado, por exemplo http://192.168.0.20:8080. Endereços públicos não são aceitos.',
  'work-stopped': 'A rodada parou antes de terminar. O que já foi escrito continua na conversa.',
};

export const SHORT_REASON = {
  'local-missing': 'sem modelo local',
  'exo-offline': 'EXO sem resposta',
  'remote-offline': 'API sem resposta',
  'key-missing': 'falta a chave',
  'key-invalid': 'chave recusada',
  'bad-address': 'endereço inválido',
  'work-stopped': 'rodada interrompida',
};

const STATUS_WORD = { pronto: 'Pronto', trabalhando: 'Trabalhando', concluido: 'Concluído', atencao: 'Atenção' };
const STATUS_MARK = { pronto: '●', trabalhando: '…', concluido: '✓', atencao: '!' };
const MARK_FILE = { pronto: 'pronto', trabalhando: 'pensando', concluido: 'concluido', atencao: 'atencao' };

export function handoffLine(origin, targets) {
  const list = Array.isArray(targets) ? targets.filter(Boolean).join(', ') : String(targets || '');
  return `Entre agentes · ${origin} passou para ${list}`;
}

export function agoLabel(elapsedMs) {
  const minutes = Math.floor(Number(elapsedMs) / 60000);
  if (minutes < 1) return 'há menos de 1 min';
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h`;
}

export function unreadLabel(count) {
  const value = Number(count) || 0;
  if (value <= 0) return '';
  return value > 9 ? '9+' : String(value);
}

export function localModels({ catalog = [], installed = [], advancedMin = 70 } = {}) {
  const rows = [];
  for (const model of installed) {
    const card = catalog.find(item => item.local_key === model.key || item.id === model.key);
    const parameters = card?.parameters_b ?? null;
    if (isAdvancedModel(model.key, parameters, advancedMin)) continue;
    rows.push({ key: model.key, name: model.display_name || card?.name || model.key, parameters_b: parameters == null ? Number.POSITIVE_INFINITY : Number(parameters) });
  }
  rows.sort((a, b) => a.parameters_b - b.parameters_b || a.name.localeCompare(b.name, 'pt-BR'));
  return rows;
}

function hostOf(value) {
  try { return new URL(value); } catch { return null; }
}

function isLoopback(value) {
  const url = hostOf(value);
  if (!url || url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) return false;
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
}

function isPrivateAddress(value) {
  const url = hostOf(value);
  if (!url || url.username || url.password || url.search || url.hash) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return url.protocol === 'https:' ? false : false;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return url.protocol === 'http:' || url.protocol === 'https:';
  return false;
}

export function testBackend(draft) {
  const kind = draft?.kind || 'local';
  if (!draft?.lead && kind !== 'local') return { ok: false, error: 'local-missing' };
  if (kind === 'local') {
    if (!draft?.modelKey || !draft.installed) return { ok: false, error: 'local-missing' };
    if (draft.advanced && !draft.lead) return { ok: false, error: 'local-missing' };
    return { ok: true };
  }
  if (kind === 'exo') {
    const endpoint = draft.endpoint || 'http://127.0.0.1:52415';
    if (!isLoopback(endpoint)) return { ok: false, error: 'exo-offline' };
    if (draft.reachable === false) return { ok: false, error: 'exo-offline' };
    return { ok: true };
  }
  if (kind === 'remote') {
    if (!isPrivateAddress(draft.endpoint || '')) return { ok: false, error: 'bad-address' };
    if (!draft.hasKey) return { ok: false, error: 'key-missing' };
    if (draft.refused) return { ok: false, error: 'key-invalid' };
    if (draft.reachable === false) return { ok: false, error: 'remote-offline' };
    return { ok: true };
  }
  if (kind === 'anthropic' || kind === 'grok') {
    if (!draft.hasKey) return { ok: false, error: 'key-missing' };
    if (draft.refused) return { ok: false, error: 'key-invalid' };
    return { ok: true };
  }
  return { ok: false, error: 'local-missing' };
}

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { sections: Array.isArray(parsed.sections) ? parsed.sections : [], byBot: parsed.byBot || {}, marks: parsed.marks || {}, collapsed: parsed.collapsed || {} };
  } catch {
    return { sections: [], byBot: {}, marks: {}, collapsed: {} };
  }
}

function writeStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function createEquipes({ api, escape: E, toast, isVisible = () => true, view = () => 'conversas', setView = () => {} }) {
  const $ = selector => document.querySelector(selector);
  let crew = null;
  let library = null;
  let focus = 'team';
  let pane = 'lista';
  let query = '';
  let generation = 0;
  let talking = false;
  let talkAbort = null;
  let startedAt = 0;
  let timer = 0;
  let alertCode = '';
  let freshAlert = false;
  let dialogOpener = null;
  let dialogMode = 'edit';
  let tested = null;
  let restoreFocus = false;
  const sessionStatus = new Map();
  const post = (url, body) => api(url, { method: 'POST', body });
  const tokens = value => Number(value || 0).toLocaleString('pt-BR');

  function store() { return readStore(); }

  function markOf(member) {
    const saved = store().marks[member.bot_id];
    if (MARKS.some(([id]) => id === saved)) return saved;
    return MARK_BY_MASCOT[member.mascot] || 'grade';
  }

  function statusOf(member) {
    const saved = sessionStatus.get(member.bot_id);
    if (talking && member.coordinator) return { status: 'trabalhando', attention: '' };
    if (saved?.status) return saved;
    if (member.missing || !member.model) return { status: 'atencao', attention: 'local-missing' };
    return { status: 'pronto', attention: '' };
  }

  function coordinatorOf() {
    return crew?.members.find(member => member.coordinator) || null;
  }

  function providerOf(member) {
    if (!member) return null;
    return crew.providers.find(item => item.id === member.provider_id) || null;
  }

  function runtime(member = coordinatorOf()) {
    const provider = providerOf(member);
    const remote = provider && provider.kind !== 'local' && provider.model;
    const model = remote ? provider.model : (member?.model || 'Sem modelo');
    const local = !provider || provider.kind === 'local' || !remote;
    const names = { local: 'Este computador', exo: 'Rede EXO', openai: 'API em outro computador', anthropic: 'Anthropic', xai: 'Grok' };
    return { member, provider, model, local, where: local ? 'Este computador' : (names[provider.kind] || provider.label || 'Fora deste computador'), leaves: Boolean(provider?.leaves_computer), kind: local ? 'local' : provider.kind };
  }

  function smallest() {
    return localModels({ catalog: library?.catalog || [], installed: library?.installed || [], advancedMin: crew?.recommendation?.advanced_min_parameters_b ?? 70 })[0] || null;
  }

  function mixed() {
    return crew.members.some(member => {
      const provider = providerOf(member);
      return provider && provider.kind !== 'local' && provider.model;
    }) || crew.members.some(member => isAdvancedModel(member.model, null, crew.recommendation?.advanced_min_parameters_b ?? 70));
  }

  function raise(code) {
    if (!code || alertCode === code) return;
    alertCode = code;
    freshAlert = true;
  }

  function announce(text) {
    let live = document.getElementById('eq-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'eq-live';
      live.className = 'visually-hidden';
      live.setAttribute('role', 'status');
      document.body.appendChild(live);
    }
    if (live.textContent === text) return;
    live.textContent = text;
  }

  function accessible(member, state, unread) {
    const parts = [member.name || 'Agente', member.role || '', STATUS_WORD[state.status] || ''];
    if (state.attention) parts.push(SHORT_REASON[state.attention] || '');
    if (unread > 0) parts.push(`${unread} novas`);
    return parts.filter(Boolean).join(', ');
  }

  function subtitle(member, state) {
    if (state.status === 'trabalhando') return `${STATUS_MARK.trabalhando} Trabalhando`;
    if (state.status === 'concluido') return `${STATUS_MARK.concluido} Concluído`;
    if (state.status === 'atencao') return `${STATUS_MARK.atencao} Atenção · ${SHORT_REASON[state.attention] || 'sem modelo local'}`;
    return member.role || 'Pronto';
  }

  function option(member) {
    const state = statusOf(member);
    const unread = Number(member.unread || 0);
    const selected = member.bot_id === focus;
    const file = MARK_FILE[state.status] || 'pronto';
    return `<div role="option" class="eq-option" data-eq-id="${E(member.bot_id)}" aria-selected="${selected ? 'true' : 'false'}" aria-label="${E(accessible(member, state, unread))}" tabindex="${selected ? '0' : '-1'}"><img src="/mascotes/${markOf(member)}-${file}.svg" alt="" width="28" height="28"><span><strong>${E(member.name || 'Agente')}</strong><small data-state="${state.status}">${E(subtitle(member, state))}</small></span>${unread ? `<span class="eq-unread">${unreadLabel(unread)}</span>` : ''}</div>`;
  }

  function filteredMembers() {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return crew.members.filter(member => !needle || String(member.name || '').toLocaleLowerCase('pt-BR').includes(needle));
  }

  function listHtml() {
    const members = filteredMembers();
    const data = store();
    const teamSelected = focus === 'team';
    const teamUnread = crew.members.reduce((sum, member) => sum + Number(member.unread || 0), 0);
    let html = `<div role="option" class="eq-option" data-eq-id="team" aria-selected="${teamSelected ? 'true' : 'false'}" aria-label="Conversa da equipe, Todas as mensagens${teamUnread ? `, ${teamUnread} novas` : ''}" tabindex="${teamSelected ? '0' : '-1'}"><img src="/mascotes/norte-pronto.svg" alt="" width="28" height="28"><span><strong>Conversa da equipe</strong><small>Todas as mensagens</small></span>${teamUnread ? `<span class="eq-unread">${unreadLabel(teamUnread)}</span>` : ''}</div>`;
    if (!crew.members.length) return html + '<p class="eq-empty">Esta equipe ainda não tem agentes.</p>';
    if (query.trim() && !members.length) return html + '<p class="eq-empty">Nenhum agente com esse nome.</p>';
    const sections = data.sections.filter(section => section?.id && section.name);
    const grouped = new Set();
    for (const section of sections) {
      const open = data.collapsed[section.id] !== true;
      const rows = members.filter(member => data.byBot[member.bot_id] === section.id);
      rows.forEach(member => grouped.add(member.bot_id));
      html += `<button type="button" class="eq-section" tabindex="-1" data-eq-section="${E(section.id)}" aria-expanded="${open ? 'true' : 'false'}"><span>${E(section.name)}</span><span>${open ? 'Ocultar' : 'Mostrar'}</span></button>`;
      if (open) html += rows.map(option).join('');
    }
    const loose = members.filter(member => !grouped.has(member.bot_id));
    if (sections.length && loose.length) {
      html += '<p class="eq-kicker">Sem seção</p>';
      html += loose.map(option).join('');
    } else if (!sections.length) html += loose.map(option).join('');
    return html;
  }

  function clock(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function duration(messages) {
    if (talking && startedAt) return agoLabel(Date.now() - startedAt);
    const times = messages.map(message => Date.parse(message.created_at)).filter(time => !Number.isNaN(time));
    if (times.length < 2) return 'há menos de 1 min';
    return agoLabel(Math.max(...times) - Math.min(...times));
  }

  function thread(messages) {
    let html = '';
    let round = 0;
    if (!messages.length && !talking) return '<p class="eq-empty">Sem mensagens nesta conversa.</p>';
    for (const message of messages) {
      if (message.round && message.round !== round) {
        round = message.round;
        html += `<p class="eq-round">Rodada ${round}</p>`;
      }
      if (message.author === 'coordinator' && String(message.content).startsWith('Peço a ')) {
        const target = String(message.content).slice('Peço a '.length).split(':')[0].trim();
        const from = crew.members.find(item => item.bot_id === message.author_bot_id)?.name || coordinatorOf()?.name || 'Coordenador';
        html += `<p class="eq-pass">${E(handoffLine(from, target || 'um colega'))}</p>`;
        continue;
      }
      if (message.author === 'system') {
        html += `<p class="eq-pass">${E(message.content)}</p>`;
        continue;
      }
      const member = crew.members.find(item => item.bot_id === (message.author_bot_id || message.bot_id));
      const you = message.author === 'user';
      const name = you ? 'Você' : (member?.name || 'Agente');
      const lead = !you && member?.coordinator;
      const state = member ? statusOf(member) : { status: 'pronto' };
      const file = MARK_FILE[state.status] || 'pronto';
      const mark = member ? `${markOf(member)}-${file}` : 'norte-pronto';
      html += `<article class="eq-entry">${you ? '<span class="eq-badge">Você</span>' : `<img src="/mascotes/${mark}.svg" alt="" width="28" height="28">`}<div><header><strong>${E(name)}</strong>${lead ? '<span class="eq-badge">coordenador</span>' : ''}<time>${E(clock(message.created_at))}${message.tokens ? ` · ${tokens(message.tokens)} tokens` : ''}</time></header><p>${E(message.content)}</p></div></article>`;
    }
    if (talking) html += '<article class="eq-entry"><img src="/mascotes/norte-pensando.svg" alt="" width="28" height="28"><div><header><strong>… Trabalhando</strong></header><p id="eq-pending" data-pending="true"></p></div></article>';
    return html;
  }

  function detailsHtml(messages, info, settings, used, currentRound) {
    const selected = focus === 'team' ? info.member : crew.members.find(member => member.bot_id === focus);
    const state = selected ? statusOf(selected) : { status: 'pronto', attention: '' };
    const ratio = settings.max_tokens ? Math.min(100, Math.round((used / settings.max_tokens) * 100)) : 0;
    const over = used > settings.max_tokens;
    return `<h2 class="eq-kicker">Esta conversa</h2>
      <div class="eq-stat"><span>Rodadas</span><b>${tokens(currentRound)} de ${tokens(settings.max_rounds)}</b></div>
      <div class="eq-stat"><span>Tokens</span><b>${tokens(used)} / ${tokens(settings.max_tokens)}</b><div class="eq-bar" data-over="${over}" aria-hidden="true"><span style="width:${ratio}%"></span></div></div>
      <div class="eq-stat"><span>Duração</span><b data-eq-elapsed>${E(duration(messages))}</b></div>
      <h2 class="eq-kicker">${E(selected?.name || 'Coordenador')}</h2>
      <div class="eq-stat"><span>Modelo</span><b>${E(runtime(selected).model)}</b></div>
      <div class="eq-stat"><span>Onde roda</span><b>${E(runtime(selected).where)}${runtime(selected).leaves ? ' · o texto sai deste computador' : ''}</b></div>
      <div class="eq-stat"><span>Estado</span><b>${E(subtitle(selected || { role: '' }, state))}</b></div>
      <div class="eq-actions">${selected ? '<button type="button" data-eq-edit>Editar</button>' : ''}${selected && !selected.model ? '<button type="button" data-eq-edit>Escolher modelo</button>' : ''}</div>
      <h2 class="eq-kicker">Equipe</h2>
      <div class="eq-stat"><span>Agentes</span><b>${tokens(crew.members.length)}</b></div>
      <div class="eq-stat"><span>Modelos</span><b>${mixed() ? 'Misto' : 'Local, o menor'}</b></div>
      <div class="eq-stat"><span>Avançado</span><b>${mixed() ? 'Ligado' : 'Desligado'}</b></div>
      ${mixed() ? '' : '<p class="eq-note">Modelos grandes — EXO, API em outro computador, Anthropic e Grok — ficam em Avançado e não estão em uso.</p>'}`;
  }

  function overview() {
    if (!crew.members.length) {
      return `<section class="eq-empty"><h2>Nenhuma equipe</h2><p>Crie uma equipe para dividir um pedido entre agentes. O modelo inicial é o menor modelo local. Modelos grandes ficam em Avançado.</p><button type="button" class="primary" id="eq-create">Criar equipe</button></section>`;
    }
    const info = runtime();
    const states = crew.members.map(statusOf);
    const state = states.some(item => item.status === 'atencao') ? 'atencao' : states.some(item => item.status === 'trabalhando') ? 'trabalhando' : states.every(item => item.status === 'concluido') ? 'concluido' : 'pronto';
    return `<div class="eq-actions"><button type="button" class="primary" id="eq-create">Nova equipe</button></div><div class="eq-cards"><button type="button" class="eq-card" data-eq-open="conversas" aria-current="true"><strong>Equipe</strong><span>${tokens(crew.members.length)} agentes</span><span>${E(info.model)}</span><span>${STATUS_MARK[state]} ${STATUS_WORD[state]}</span></button></div>${mixed() ? '' : '<p class="eq-note">Modelos grandes — EXO, API em outro computador, Anthropic e Grok — ficam em Avançado e não estão em uso.</p>'}`;
  }

  function paint(messages) {
    const mode = view() === 'visao' ? 'visao' : 'conversas';
    const settings = crew.settings;
    const used = messages.reduce((sum, message) => sum + Number(message.tokens || 0), 0);
    const currentRound = messages.reduce((max, message) => Math.max(max, Number(message.round || 0)), 0);
    const info = runtime();
    const working = talking || crew.members.some(member => statusOf(member).status === 'trabalhando');
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    if (!narrow) pane = 'conversa';
    const place = mixed() ? info.where : 'local';
    const alert = alertCode ? `<p class="eq-alert"${freshAlert ? ' role="alert"' : ''}>${E(ERRORS[alertCode] || '')}</p>` : '';
    freshAlert = false;
    const side = detailsHtml(messages, info, settings, used, currentRound);
    $('#content').innerHTML = `<section class="equipes" data-view="${mode}" data-pane="${mode === 'visao' ? 'visao' : pane}">
      <header class="eq-top">
        <div class="eq-title"><button type="button" class="eq-back" id="eq-back">← Equipes</button><h1>Equipes</h1></div>
        <div class="eq-chips">
          ${working ? '<span class="eq-chip">… Trabalhando</span>' : ''}
          <span class="eq-chip">Rodada ${tokens(currentRound)} de ${tokens(settings.max_rounds)}</span>
          <span class="eq-chip">${tokens(used)} / ${tokens(settings.max_tokens)} tokens</span>
          <span class="eq-chip">Modelo ${E(info.model)} · ${E(place)}</span>
          <button type="button" id="eq-limits-open" aria-expanded="false" aria-controls="eq-limits-pop">Limites</button>
          <button type="button" id="eq-stop" aria-disabled="${talking ? 'false' : 'true'}" tabindex="${talking ? '0' : '-1'}">Parar</button>
        </div>
        <div class="eq-pop" id="eq-limits-pop" hidden>
          <form id="eq-limits" class="eq-limit">
            <p>Limite de tokens por conversa</p>
            <label>Tokens<input name="max_tokens" type="number" min="256" max="32768" step="1" required value="${settings.max_tokens}"></label>
            <label>Rodadas<input name="max_rounds" type="number" min="1" max="3" step="1" required value="${Math.min(3, settings.max_rounds)}"></label>
            <button class="primary" type="submit">Salvar</button>
          </form>
        </div>
      </header>
      ${alert}
      ${mode === 'visao' ? overview() : `<div class="eq-shell">
        <aside class="eq-list" aria-label="Equipe">
          <label class="eq-search">Buscar agente<input id="eq-search" type="search" value="${E(query)}" autocomplete="off"></label>
          <p id="eq-search-status" class="visually-hidden" role="status"></p>
          <div class="eq-listbox" role="listbox" aria-orientation="vertical" aria-label="Agentes">${listHtml()}</div>
          <div class="eq-actions"><button type="button" class="primary" id="eq-add">Adicionar agente</button></div>
        </aside>
        <section class="eq-main">
          <div class="eq-log" role="log" aria-relevant="additions" aria-atomic="false" aria-busy="true">${focus === 'team' || crew.members.some(member => member.bot_id === focus) ? thread(messages) : '<p class="eq-empty">Esta equipe ainda não tem agentes.</p>'}</div>
          <details class="eq-fold"><summary>Detalhes</summary><div class="eq-fold-body">${side}</div></details>
          ${composer()}
        </section>
        <aside class="eq-side" aria-label="Detalhes">${side}</aside>
      </div>`}
      ${dialogHtml()}
    </section>`;
    const log = $('.eq-log');
    if (log) {
      log.scrollTop = log.scrollHeight;
      log.removeAttribute('aria-busy');
    }
    if (restoreFocus) document.querySelector('.eq-option[aria-selected="true"]')?.focus();
    restoreFocus = false;
    bind(messages);
    armTimer();
  }

  function composer() {
    const selected = focus === 'team' ? null : crew.members.find(member => member.bot_id === focus);
    if (selected && !selected.model) return '<p class="eq-leave">Escolher modelo abre o diálogo. A conversa deste agente espera um modelo local.</p>';
    return `<form id="eq-compose" class="eq-compose"><p class="eq-hint">${focus === 'team' ? 'O coordenador divide o pedido · até 3 rodadas · Enter envia' : 'Enter envia · Shift+Enter quebra a linha'}</p><label class="visually-hidden">${focus === 'team' ? 'Pedido para a equipe' : `Mensagem para ${E(selected?.name || 'o agente')}`}</label><textarea name="content" maxlength="16000" required placeholder="${focus === 'team' ? 'Pedido para a equipe' : 'Escreva para o agente'}"></textarea><button class="primary" type="submit">Enviar</button></form>${talking ? '<p class="eq-leave">Você pode sair desta conversa. A rodada continua.</p>' : ''}`;
  }

  function dialogHtml() {
    return `<dialog class="eq-dialog" id="eq-dialog"><form id="eq-agent">
      <h2 id="eq-dialog-title">Editar</h2>
      <label>Nome<input name="name" required maxlength="40" autocomplete="off"></label>
      <label>Função<input name="role" required maxlength="80" autocomplete="off"></label>
      <fieldset class="eq-marks"><legend class="eq-kicker">Marca</legend>${MARKS.map(([id, label]) => `<label><input type="radio" name="mark" value="${id}"><img src="/mascotes/${id}-pronto.svg" alt="" width="28" height="28">${label}</label>`).join('')}</fieldset>
      <label>Seção<select name="section"><option value="">Sem seção</option></select></label>
      <div class="eq-actions"><button type="button" id="eq-new-section">Nova seção</button><button type="button" id="eq-drop-section">Apagar seção</button></div>
      <fieldset><legend class="eq-kicker">Onde este agente roda</legend>
        <label class="eq-check"><input type="radio" name="where" value="local" checked>Este computador</label>
        <p class="eq-note">Recomendado. O menor modelo local pronto.</p>
        <label>Modelo local<select name="localModel"></select></label>
      </fieldset>
      <details class="eq-advanced" id="eq-advanced"><summary>Modelos grandes</summary>
        <p class="eq-note">O texto sai deste computador nos serviços externos. EXO usa a sua rede.</p>
        <label class="eq-check"><input type="radio" name="where" value="exo">Rede EXO</label>
        <label class="eq-check"><input type="radio" name="where" value="remote">API em outro computador</label>
        <label class="eq-check"><input type="radio" name="where" value="anthropic">Anthropic</label>
        <label class="eq-check"><input type="radio" name="where" value="grok">Grok</label>
        <label>70B ou mais neste computador<select name="advancedLocal"><option value="">Não usar</option></select></label>
        <label>Modelo do serviço<input name="remoteModel" maxlength="120" autocomplete="off"></label>
        <label>Endereço<input name="endpoint" maxlength="300" placeholder="http://192.168.0.20:8080" autocomplete="off"></label>
        <label>Chave da API<input name="token" type="password" autocomplete="off" maxlength="500"></label>
        <p class="eq-note">A chave fica no cofre deste computador. A tela não volta a mostrar a chave inteira.</p>
        <p class="notice">Nada fica público por padrão. O EXO fica em loopback.</p>
        <label class="eq-check"><input name="acknowledged" type="checkbox">Compreendo que o pedido pode sair deste computador.</label>
        <label class="eq-check"><input name="confirm_remote" type="checkbox">Confirmo esta ligação.</label>
        <label class="eq-check"><input name="trusted_network" type="checkbox">Esta é uma rede privada confiável.</label>
      </details>
      <p class="eq-alert" id="eq-dialog-alert"></p>
      <div class="eq-actions"><button type="button" id="eq-test">Testar</button><button class="primary" type="submit" id="eq-save" aria-disabled="true" tabindex="-1">Salvar</button><button type="button" id="eq-cancel">Cancelar</button></div>
    </form></dialog>`;
  }

  function fillDialog(member) {
    const form = $('#eq-agent');
    const lead = dialogMode === 'add' ? !coordinatorOf() : Boolean(member?.coordinator);
    $('#eq-dialog-title').textContent = dialogMode === 'add' ? 'Novo agente' : 'Editar';
    form.name.value = member?.name || '';
    form.role.value = member?.role || '';
    const mark = member ? markOf(member) : 'norte';
    const radio = form.querySelector(`input[name="mark"][value="${mark}"]`) || form.querySelector('input[name="mark"]');
    if (radio) radio.checked = true;
    const data = store();
    form.section.innerHTML = `<option value="">Sem seção</option>${data.sections.map(section => `<option value="${E(section.id)}">${E(section.name)}</option>`).join('')}`;
    if (member && data.byBot[member.bot_id]) form.section.value = data.byBot[member.bot_id];
    const advancedMin = crew.recommendation?.advanced_min_parameters_b ?? 70;
    const locals = localModels({ catalog: library?.catalog || [], installed: library?.installed || [], advancedMin });
    const large = (library?.installed || []).flatMap(model => {
      const card = (library?.catalog || []).find(item => item.local_key === model.key || item.id === model.key);
      if (!isAdvancedModel(model.key, card?.parameters_b ?? null, advancedMin)) return [];
      return [{ key: model.key, name: model.display_name || card?.name || model.key }];
    });
    const pick = smallest();
    form.localModel.innerHTML = locals.map(model => `<option value="${E(model.key)}">${E(model.name)}</option>`).join('') || '<option value="">Nenhum modelo local</option>';
    form.advancedLocal.innerHTML = `<option value="">Não usar</option>${large.map(model => `<option value="${E(model.key)}">${E(model.name)}</option>`).join('')}`;
    if (member?.model && locals.some(model => model.key === member.model)) form.localModel.value = member.model;
    else if (pick) form.localModel.value = pick.key;
    form.querySelector('[value="local"]').checked = true;
    form.remoteModel.value = '';
    form.endpoint.value = '';
    form.token.value = '';
    form.acknowledged.checked = false;
    form.confirm_remote.checked = false;
    form.trusted_network.checked = false;
    const advanced = $('#eq-advanced');
    advanced.hidden = !lead;
    advanced.open = false;
    const hint = providerOf(member);
    $('#eq-dialog-alert').textContent = hint?.token_hint ? `Chave configurada · ${hint.token_hint}` : '';
    const localReady = locals.some(model => model.key === form.localModel.value);
    tested = localReady ? { ok: true, kind: 'local' } : null;
    syncSave();
    const work = crew.available_bots.filter(bot => bot.area === 'work' && !bot.linked);
    let picker = $('#eq-bot-picker');
    if (dialogMode === 'add') {
      if (!picker) {
        picker = document.createElement('label');
        picker.id = 'eq-bot-picker';
        picker.innerHTML = `Agente de Minha equipe<select name="bot">${work.map(bot => `<option value="${E(bot.id)}">${E(bot.name)}</option>`).join('') || '<option value="">Nenhum bot livre</option>'}</select>`;
        form.insertBefore(picker, form.name.parentElement);
      }
      picker.querySelector('select').onchange = () => {
        const bot = work.find(item => item.id === picker.querySelector('select').value);
        if (!bot) return;
        form.name.value = bot.name || '';
        form.role.value = bot.role || '';
      };
      picker.querySelector('select').onchange();
    } else if (picker) picker.remove();
  }

  function syncSave() {
    const button = $('#eq-save');
    if (!button) return;
    const ready = Boolean(tested?.ok);
    button.setAttribute('aria-disabled', ready ? 'false' : 'true');
    button.tabIndex = ready ? 0 : -1;
  }

  function draftFromForm() {
    const form = $('#eq-agent');
    const where = form.querySelector('input[name="where"]:checked')?.value || 'local';
    const member = crew.members.find(item => item.bot_id === focus);
    const lead = dialogMode === 'add' ? !coordinatorOf() : Boolean(member?.coordinator);
    const locals = localModels({ catalog: library?.catalog || [], installed: library?.installed || [] });
    if (where === 'local' && form.advancedLocal.value && lead) return { kind: 'local', lead, modelKey: form.advancedLocal.value, installed: true, advanced: true };
    const modelKey = form.localModel.value;
    if (where === 'local') return { kind: 'local', lead, modelKey, installed: locals.some(model => model.key === modelKey), advanced: false };
    return {
      kind: where,
      lead,
      endpoint: form.endpoint.value.trim(),
      hasKey: Boolean(form.token.value) || Boolean(providerOf(member)?.has_token),
      model: form.remoteModel.value.trim(),
    };
  }

  async function probe(draft) {
    const structural = testBackend(draft);
    if (!structural.ok || draft.kind !== 'exo') return structural;
    try {
      const exo = await api('/exo');
      if (!exo?.connected) return { ok: false, error: 'exo-offline' };
    } catch {
      return { ok: false, error: 'exo-offline' };
    }
    return { ok: true };
  }

  function openDialog(mode, opener) {
    dialogMode = mode;
    dialogOpener = opener || document.activeElement;
    tested = null;
    const member = mode === 'edit' ? crew.members.find(item => item.bot_id === focus) : null;
    const dialog = $('#eq-dialog');
    fillDialog(member);
    dialog.showModal();
    $('#eq-agent').name.focus();
  }

  function closeDialog() {
    $('#eq-dialog')?.close();
    dialogOpener?.focus?.();
  }

  function options() {
    return [...document.querySelectorAll('.eq-listbox [role="option"], .eq-listbox .eq-section')];
  }

  function selectOption(id, confirm) {
    focus = id;
    restoreFocus = true;
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    if (confirm && narrow) pane = 'conversa';
    const member = crew.members.find(item => item.bot_id === id);
    if (member && !member.model) { openDialog('edit', document.activeElement); return; }
    open().catch(error => toast(error.message));
  }

  function onListKey(event) {
    const current = options();
    const index = current.findIndex(item => item === document.activeElement || item.getAttribute('aria-selected') === 'true');
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      event.preventDefault();
      const next = key === 'Home' ? 0 : key === 'End' ? current.length - 1 : Math.min(current.length - 1, Math.max(0, index + (key === 'ArrowDown' ? 1 : -1)));
      const item = current[next];
      if (!item) return;
      if (item.classList.contains('eq-section')) { item.focus(); return; }
      selectOption(item.dataset.eqId, false);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const item = current[index] || current[0];
      if (!item) return;
      if (item.classList.contains('eq-section')) { item.click(); return; }
      selectOption(item.dataset.eqId, true);
      return;
    }
    if (key.length === 1 && /\S/.test(key) && event.target.closest('.eq-listbox')) {
      const letter = key.toLocaleLowerCase('pt-BR');
      const names = current.map(item => item.querySelector('strong')?.textContent || '');
      const start = index < 0 ? 0 : index + 1;
      const found = [...names.slice(start), ...names.slice(0, start)].findIndex(name => name.toLocaleLowerCase('pt-BR').startsWith(letter));
      if (found >= 0) {
        const absolute = (start + found) % current.length;
        event.preventDefault();
        selectOption(current[absolute].dataset.eqId, false);
      }
    }
  }

  function bind() {
    const limits = $('#eq-limits');
    if (limits) limits.onsubmit = event => {
      event.preventDefault();
      const rounds = Math.min(3, Math.max(1, Number(limits.max_rounds.value)));
      post('/crews/settings', { max_tokens: Number(limits.max_tokens.value), max_rounds: rounds }).then(() => open()).catch(error => toast(error.message));
    };
    const search = $('#eq-search');
    if (search) {
      let pending = 0;
      search.oninput = () => {
        query = search.value;
        const box = $('.eq-listbox');
        if (box) box.innerHTML = listHtml();
        clearTimeout(pending);
        pending = setTimeout(() => {
          const status = $('#eq-search-status');
          const count = filteredMembers().length;
          if (status) status.textContent = `${count} agentes`;
        }, 150);
      };
      search.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
    }
    const list = $('.eq-listbox');
    if (list) {
      list.onkeydown = onListKey;
      list.onclick = event => {
        event.stopPropagation();
        const section = event.target.closest('[data-eq-section]');
        if (section) {
          const data = store();
          data.collapsed[section.dataset.eqSection] = section.getAttribute('aria-expanded') === 'true';
          writeStore(data);
          list.innerHTML = listHtml();
          return;
        }
        const item = event.target.closest('[role="option"]');
        if (item) selectOption(item.dataset.eqId, true);
      };
    }
    const compose = $('#eq-compose');
    if (compose) {
      const field = compose.querySelector('textarea');
      field.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); compose.requestSubmit(); }
      });
      compose.onsubmit = event => {
        event.preventDefault();
        const content = field.value;
        if (focus !== 'team') {
          post(`/crews/members/${focus}/messages`, { content }).then(() => open()).catch(error => toast(error.message));
          return;
        }
        talking = true;
        startedAt = Date.now();
        const lead = coordinatorOf();
        if (lead) sessionStatus.set(lead.bot_id, { status: 'trabalhando', attention: '' });
        announce(`${lead?.name || 'Coordenador'} está trabalhando`);
        talkAbort = new AbortController();
        paintBusy(content);
        fetch('/v1/crews/talk', { method: 'POST', signal: talkAbort.signal, headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ content }) }).then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
          if (data.stopped && data.stopped !== 'done') toast(talkNote(data.stopped));
          if (lead) sessionStatus.set(lead.bot_id, { status: 'concluido', attention: '' });
          announce(`${lead?.name || 'Coordenador'} concluiu`);
        }).catch(error => {
          if (error.name === 'AbortError') {
            if (lead) sessionStatus.set(lead.bot_id, { status: 'atencao', attention: 'work-stopped' });
            raise('work-stopped');
          } else toast(error.message);
        }).finally(() => {
          talking = false;
          talkAbort = null;
          open().catch(error => toast(error.message));
        });
      };
    }
    $('#content').onclick = event => {
      if (event.target.id === 'eq-back') { pane = 'lista'; restoreFocus = true; open().catch(error => toast(error.message)); return; }
      if (event.target.id === 'eq-limits-open') { const pop = $('#eq-limits-pop'); pop.hidden = !pop.hidden; event.target.setAttribute('aria-expanded', String(!pop.hidden)); return; }
      if (event.target.id === 'eq-stop') { if (event.target.getAttribute('aria-disabled') === 'true') return; talkAbort?.abort(); return; }
      if (event.target.id === 'eq-add') { if (focus === 'team') focus = coordinatorOf()?.bot_id || crew.members[0]?.bot_id || 'team'; openDialog('add', event.target); return; }
      if (event.target.id === 'eq-create' || event.target.dataset.eqOpen) {
        if (event.target.dataset.eqOpen) { setView('conversas'); pane = 'conversa'; return open().catch(error => toast(error.message)); }
        event.target.setAttribute('aria-disabled', 'true');
        post('/crews/link', {}).then(next => { crew = next; const pick = smallest(); const jobs = pick ? next.members.filter(member => !member.model).map(member => post(`/crews/members/${member.bot_id}/model`, { model: pick.key })) : []; return Promise.all(jobs); }).then(() => open()).catch(error => toast(error.message));
        return;
      }
      if (event.target.dataset.eqEdit !== undefined || event.target.hasAttribute('data-eq-edit')) { openDialog('edit', event.target); }
    };
    const dialog = $('#eq-dialog');
    if (dialog) {
      dialog.addEventListener('close', () => dialogOpener?.focus?.());
      dialog.addEventListener('cancel', () => dialogOpener?.focus?.());
      $('#eq-cancel').onclick = () => closeDialog();
      $('#eq-new-section').onclick = () => {
        const name = window.prompt('Nova seção');
        if (!name) return;
        const data = store();
        const id = `s${Date.now().toString(36)}`;
        data.sections.push({ id, name: name.slice(0, 40) });
        writeStore(data);
        const form = $('#eq-agent');
        form.section.insertAdjacentHTML('beforeend', `<option value="${E(id)}">${E(name.slice(0, 40))}</option>`);
        form.section.value = id;
      };
      $('#eq-drop-section').onclick = () => {
        const form = $('#eq-agent');
        const id = form.section.value;
        if (!id) return;
        const data = store();
        data.sections = data.sections.filter(section => section.id !== id);
        for (const [bot, section] of Object.entries(data.byBot)) if (section === id) delete data.byBot[bot];
        writeStore(data);
        form.section.querySelector(`option[value="${CSS.escape(id)}"]`)?.remove();
        form.section.value = '';
      };
      $('#eq-test').onclick = () => {
        const draft = draftFromForm();
        probe(draft).then(result => {
          tested = result.ok ? { ok: true, kind: draft.kind } : null;
          const node = $('#eq-dialog-alert');
          if (!result.ok) { node.textContent = ERRORS[result.error] || ''; node.setAttribute('role', 'alert'); raise(result.error); }
          else { node.textContent = 'Teste ok.'; node.removeAttribute('role'); }
          syncSave();
        }).catch(error => toast(error.message));
      };
      $('#eq-agent').onsubmit = event => {
        event.preventDefault();
        if ($('#eq-save').getAttribute('aria-disabled') === 'true') return;
        saveDialog().catch(error => toast(error.message));
      };
      $('#eq-agent').addEventListener('change', event => {
        if (!['where', 'localModel', 'advancedLocal', 'endpoint', 'token', 'remoteModel'].includes(event.target.name)) return;
        const draft = draftFromForm();
        tested = draft.kind === 'local' && draft.installed ? { ok: true, kind: 'local' } : null;
        syncSave();
      });
    }
  }

  function paintBusy() {
    const log = $('.eq-log');
    const stop = $('#eq-stop');
    if (stop) { stop.setAttribute('aria-disabled', 'false'); stop.tabIndex = 0; }
    if (log && !document.getElementById('eq-pending')) {
      log.insertAdjacentHTML('beforeend', '<article class="eq-entry"><img src="/mascotes/norte-pensando.svg" alt="" width="28" height="28"><div><header><strong>… Trabalhando</strong></header><p id="eq-pending" data-pending="true"></p></div></article>');
    }
    const leave = $('.eq-main');
    if (leave && !$('.eq-leave')) leave.insertAdjacentHTML('beforeend', '<p class="eq-leave">Você pode sair desta conversa. A rodada continua.</p>');
  }

  async function saveDialog() {
    const form = $('#eq-agent');
    const draft = draftFromForm();
    const result = tested?.ok ? tested : await probe(draft);
    if (!result.ok) { raise(result.error); return; }
    const data = store();
    const mark = form.querySelector('input[name="mark"]:checked')?.value || 'grade';
    if (dialogMode === 'add') {
      const botId = form.querySelector('[name="bot"]')?.value;
      if (!botId) { toast('Ative a equipe de trabalho em Minha equipe.'); return; }
      crew = await post('/crews/members', { bot_id: botId, mascot: MASCOT_BY_MARK[mark] || 'codigo', coordinator: !coordinatorOf() });
      focus = botId;
    }
    const member = crew.members.find(item => item.bot_id === focus) || { bot_id: form.querySelector('[name="bot"]')?.value };
    const botId = member.bot_id;
    data.marks[botId] = mark;
    if (form.section.value) data.byBot[botId] = form.section.value;
    else delete data.byBot[botId];
    writeStore(data);
    await api(`/crews/members/${botId}`, { method: 'PATCH', body: { mascot: MASCOT_BY_MARK[mark] || 'codigo' } });
    if (draft.kind === 'local' && draft.modelKey) await post(`/crews/members/${botId}/model`, { model: draft.modelKey });
    if (draft.kind !== 'local') {
      if (!form.acknowledged.checked || !form.confirm_remote.checked) { toast('Confirme o aviso antes de salvar.'); return; }
      const kind = draft.kind === 'grok' ? 'xai' : draft.kind === 'remote' ? 'openai' : draft.kind;
      const payload = { kind, label: kind === 'xai' ? 'Grok' : kind === 'openai' ? 'Outro computador' : kind === 'exo' ? 'Rede EXO' : 'Anthropic', model: form.remoteModel.value.trim(), acknowledged: true, confirm_remote: true, trusted_network: form.trusted_network.checked };
      if (form.endpoint.value.trim()) payload.endpoint = form.endpoint.value.trim();
      if (form.token.value) payload.token = form.token.value;
      const provider = await post('/crews/providers', payload);
      await api(`/crews/members/${botId}`, { method: 'PATCH', body: { provider_id: provider.id } });
    }
    const experience = await api('/experience');
    const bot = experience.bots?.find(item => item.id === botId);
    if (bot && (bot.name !== form.name.value.trim() || bot.role !== form.role.value.trim())) {
      await post('/experience/bots', { id: bot.id, template: bot.template, name: form.name.value.trim(), area: bot.area, role: form.role.value.trim(), instructions: bot.instructions || '', memory: bot.memory || '', model: bot.model || '', access: bot.access, connections: bot.connections || [], playbook_version: bot.playbook_version, tasks: bot.tasks || [] });
    }
    form.token.value = '';
    closeDialog();
    await open();
  }

  function talkNote(stopped) {
    const notes = { done: 'A equipe respondeu dentro dos limites.', rounds: 'A conversa parou no máximo de rodadas.', tokens: 'A conversa parou no limite de tokens.', abort: 'A conversa foi interrompida.', self: 'O coordenador não pede a si mesmo.', local: 'Os colegas ficam no modelo deste computador.', model: 'Falta um modelo local neste agente.' };
    return notes[stopped] || 'A conversa da equipe terminou.';
  }

  function armTimer() {
    clearInterval(timer);
    if (!talking) return;
    timer = setInterval(() => {
      const node = document.querySelector('[data-eq-elapsed]');
      if (node) node.textContent = agoLabel(Date.now() - startedAt);
    }, 30000);
  }

  async function open() {
    const ticket = ++generation;
    const [next, models] = await Promise.all([api('/crews'), api('/model-library').catch(() => null)]);
    if (ticket !== generation || !isVisible()) return;
    crew = next;
    library = models;
    if (focus !== 'team' && !crew.members.some(member => member.bot_id === focus)) focus = 'team';
    let messages = [];
    if (view() !== 'visao') {
      if (focus === 'team') messages = await api('/crews/team/messages');
      else {
        const member = crew.members.find(item => item.bot_id === focus);
        if (member?.unread) crew = await post(`/crews/members/${focus}/read`, {});
        messages = await api(`/crews/members/${focus}/messages`);
      }
    }
    if (ticket !== generation || !isVisible()) return;
    paint(messages);
  }

  return { render: () => open().catch(error => toast(error.message)), testBackend };
}
