import { CREW_MASCOTS, CREW_MASCOT_LABELS, crewMascot, crewModelChoices, estimateTokens, initials, memberCaption, modelOptionLabel } from './crew-mascots.js';

const MASCOT_KEY = 'localneuron-crew-mascot';

export function createCrews({ api, escape: E, toast, isVisible = () => true }) {
  const $ = selector => document.querySelector(selector);
  let crew = null;
  let library = null;
  let view = 'team';
  let generation = 0;
  let talking = false;
  let talkAbort = null;

  const post = (url, body) => api(url, { method: 'POST', body });
  const tokens = value => Number(value || 0).toLocaleString('pt-BR');
  const showMascot = () => localStorage.getItem(MASCOT_KEY) === '1';

  async function open() {
    const ticket = ++generation;
    const [next, models] = await Promise.all([api('/crews'), api('/model-library').catch(() => null)]);
    if (ticket !== generation || !isVisible()) return;
    crew = next;
    library = models;
    if (view !== 'team' && !crew.members.some(member => member.bot_id === view)) view = 'team';
    let messages = [];
    if (view === 'team') messages = await api('/crews/team/messages');
    else {
      const member = crew.members.find(item => item.bot_id === view);
      if (member?.unread) crew = await post(`/crews/members/${view}/read`, {});
      messages = await api(`/crews/members/${view}/messages`);
    }
    if (ticket !== generation || !isVisible()) return;
    paint(messages);
  }

  function memberName(id) {
    return crew.members.find(member => member.bot_id === id)?.name || 'Agente';
  }

  function memberRole(member) {
    return memberCaption(member);
  }

  function authorLabel(message) {
    if (message.author === 'user') return 'Você';
    if (message.author === 'system') return 'Sistema';
    return memberName(message.author_bot_id || message.bot_id);
  }

  function authorRole(message) {
    const member = crew.members.find(item => item.bot_id === (message.author_bot_id || message.bot_id));
    if (message.author === 'user') return '';
    if (message.author === 'coordinator') return 'Coordenador';
    return member ? memberCaption(member) : '';
  }

  function clock(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function duration(messages) {
    const times = messages.map(message => Date.parse(message.created_at)).filter(time => !Number.isNaN(time));
    if (times.length < 2) return '0 min';
    const minutes = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  }

  function memberState(member) {
    if (member.missing) return 'livre';
    if (talking && member.coordinator) return 'ocupado';
    if (!member.model) return 'livre';
    return 'ok';
  }

  function agentButton(member) {
    const caption = memberRole(member);
    const unread = member.unread ? `<span class="crews-unread" aria-label="${member.unread} Não lidas">${member.unread > 99 ? '99+' : member.unread}</span>` : '';
    return `<button type="button" class="crews-agent" data-crew-agent="${E(member.bot_id)}" ${member.bot_id === view ? 'aria-current="true"' : ''}>${avatar(member)}<span><strong>${E(member.missing ? 'Bot ausente' : member.name || 'Sem nome')}</strong>${caption ? `<small>${E(caption)}</small>` : ''}</span>${unread}</button>`;
  }

  function avatar(member) {
    const state = memberState(member);
    const mark = showMascot() ? crewMascot(member.mascot) : `<span class="crew-initials">${E(initials(member.missing ? 'Bot ausente' : member.name))}</span>`;
    return `<span class="crew-avatar${member.coordinator ? ' is-coordinator' : ''}">${mark}<i class="crew-dot" data-state="${state}"></i></span>`;
  }

  function coordinatorOf() {
    return crew.members.find(member => member.coordinator) || null;
  }

  function runtime() {
    const coordinator = coordinatorOf();
    const provider = coordinator ? crew.providers.find(item => item.id === coordinator.provider_id) : null;
    const remote = provider && provider.kind !== 'local' && provider.model;
    const model = remote ? provider.model : (coordinator?.model || 'Sem modelo');
    const local = !provider || provider.kind === 'local' || !remote;
    return {
      coordinator,
      provider,
      model,
      place: local ? 'local' : provider.kind,
      where: local ? 'Neste computador' : (provider.label || 'Fora deste computador'),
      leaves: Boolean(provider?.leaves_computer),
    };
  }

  function thread(messages) {
    let html = '';
    let round = 0;
    if (!messages.length) return '<p class="crews-system">Sem mensagens nesta conversa.</p>';
    for (const message of messages) {
      if (message.round && message.round !== round) {
        round = message.round;
        html += `<p class="crews-round" data-crew-round="${round}">Rodada ${round}</p>`;
      }
      const marker = message.round || 0;
      if (message.author === 'coordinator' && String(message.content).startsWith('Peço a ')) {
        const target = String(message.content).slice('Peço a '.length).split(':')[0].trim();
        html += `<p class="crews-pass" data-author="coordinator" data-crew-round="${marker}">${E(authorLabel(message))} passou para ${E(target)}</p>`;
        continue;
      }
      if (message.author === 'system') {
        html += `<p class="crews-system" data-author="system" data-crew-round="${marker}">${E(message.content)}</p>`;
        continue;
      }
      const member = crew.members.find(item => item.bot_id === (message.author_bot_id || message.bot_id)) || {
        name: authorLabel(message), mascot: 'codigo', coordinator: message.author === 'coordinator', model: 'local', role: authorRole(message),
      };
      const role = authorRole(message);
      const when = clock(message.created_at);
      html += `<article class="crews-entry" data-author="${E(message.author)}" data-crew-round="${marker}">${message.author === 'user' ? `<span class="crew-avatar"><span class="crew-initials">VC</span><i class="crew-dot" data-state="ok"></i></span>` : avatar(member)}<div><header><strong>${E(authorLabel(message))}</strong>${role ? `<span>${E(role)}</span>` : ''}<time>${when ? `${E(when)} · ` : ''}${tokens(message.tokens)} tokens</time></header><p>${E(message.content)}</p></div></article>`;
    }
    return html;
  }

  function paint(messages) {
    const settings = crew.settings;
    const used = messages.reduce((sum, message) => sum + Number(message.tokens || 0), 0);
    const over = used > settings.max_tokens;
    const currentRound = messages.reduce((max, message) => Math.max(max, Number(message.round || 0)), 0);
    const suggestion = crew.recommendation?.preferred || crew.recommendation?.fallback;
    const work = crew.available_bots.filter(bot => bot.area === 'work' && !bot.linked);
    const selected = view === 'team' ? null : crew.members.find(member => member.bot_id === view);
    const info = runtime();
    const title = selected ? (selected.missing ? 'Bot ausente' : selected.name || 'Agente') : 'Conversa da equipe';
    const unread = crew.members.reduce((sum, member) => sum + Number(member.unread || 0), 0);
    const ratio = settings.max_tokens ? Math.min(100, Math.round((used / settings.max_tokens) * 100)) : 0;
    const choices = selected ? crewModelChoices({
      catalog: library?.catalog || [],
      installed: library?.installed || [],
      suggestion,
      current: selected.model,
      coordinator: selected.coordinator,
      advancedMin: crew.recommendation?.advanced_min_parameters_b ?? 70,
    }) : [];
    const provider = selected ? crew.providers.find(item => item.id === selected.provider_id) : info.provider;
    $('#content').innerHTML = `<section class="crews-page">
      <header class="crews-top">
        <div class="crews-title"><h1>Equipes / ${E(title)}</h1><button type="button" class="crews-help" id="crew-help" aria-expanded="false" aria-controls="crew-help-pop">?</button></div>
        <div class="crews-chips">
          <span class="crews-chip" data-crew-round="${currentRound}">Rodada ${tokens(currentRound)} de ${tokens(settings.max_rounds)}</span>
          <span class="crews-chip" data-crew-token-limit>${tokens(used)} / ${tokens(settings.max_tokens)} tokens</span>
          <span class="crews-chip">Modelo ${E(info.model)} · ${E(info.place)}</span>
          <button type="button" id="crew-limits-open" aria-expanded="false" aria-controls="crew-limits-pop">Limites</button>
          <button type="button" id="crew-stop" ${talking ? '' : 'disabled'}>Parar</button>
        </div>
        <div class="crews-pop" id="crew-limits-pop" hidden>
          <form id="crew-limits" class="crews-limit">
            <p>Limite de tokens por conversa</p>
            <label>Tokens<input name="max_tokens" type="number" min="256" max="32768" step="1" required value="${settings.max_tokens}"></label>
            <label>Rodadas<input name="max_rounds" type="number" min="1" max="8" step="1" required value="${settings.max_rounds}"></label>
            <button class="primary" type="submit">Salvar</button>
          </form>
        </div>
        <div class="crews-pop" id="crew-help-pop" hidden>
          <ul class="crews-rules">
            <li>70B ou mais, EXO, outro computador e nuvem ficam só no coordenador.</li>
            <li>A sugestão local é um modelo de 7B a 14B.</li>
            <li>Nada fica público por padrão. O EXO fica em loopback. O token fica no cofre.</li>
          </ul>
          <label class="crews-check"><input id="crew-mascot-pref" type="checkbox" ${showMascot() ? 'checked' : ''}>Mostrar mascote</label>
        </div>
      </header>
      <div class="crews-shell">
        <aside class="crews-roster" aria-label="Agentes da equipe">
          <h2 class="crews-kicker">Membros</h2>
          <button type="button" class="crews-team-link" data-crew-view="team" ${view === 'team' ? 'aria-current="true"' : ''}>${avatar({ name: 'Conversa da equipe', mascot: 'coordenador', coordinator: false, model: 'equipe' })}<span><strong>Conversa da equipe</strong><small>O que todos disseram</small></span>${unread ? `<span class="crews-unread" aria-label="${unread} Não lidas">${unread > 99 ? '99+' : unread}</span>` : ''}</button>
          ${crew.members.map(member => agentButton(member)).join('') || '<p class="crews-system">Ainda não há agentes conectados.</p>'}
          <div class="crews-actions"><button type="button" class="primary" id="crew-link">Conectar bots de trabalho</button><button type="button" data-page="team">Minha equipe</button></div>
          ${work.length ? `<label>Adicionar<select id="crew-add"><option value="">Escolher</option>${work.map(bot => `<option value="${E(bot.id)}">${E(bot.name)}</option>`).join('')}</select></label>` : ''}
        </aside>
        <div class="crews-main">
          <div class="crews-thread" role="log">${thread(messages)}</div>
          ${selected ? `<form id="crew-compose" class="crews-compose"><label class="visually-hidden">Mensagem para ${E(selected.name || 'este agente')}</label><textarea name="content" maxlength="16000" required placeholder="Escreva para ${E(selected.name || 'este agente')}…"></textarea><button class="primary" type="submit">Enviar</button></form>` : `<form id="crew-talk" class="crews-compose"><label class="visually-hidden">Pedido para a equipe</label><textarea name="content" maxlength="16000" required placeholder="Escreva um pedido para a equipe…"></textarea><button class="primary" type="submit" ${crew.members.some(member => member.coordinator) ? '' : 'disabled'}>Enviar</button></form>`}
        </div>
        <aside class="crews-side" aria-label="Esta conversa">
          <h2 class="crews-kicker">Esta conversa</h2>
          <div class="crews-stat"><span>Rodadas</span><b>${tokens(currentRound)} de ${tokens(settings.max_rounds)}</b></div>
          <div class="crews-stat"><span>Tokens</span><b data-crew-usage>${tokens(used)} / ${tokens(settings.max_tokens)}</b><div class="crews-bar" data-over="${over}"><span style="width:${ratio}%"></span></div></div>
          <div class="crews-stat"><span>Duração</span><b>${E(duration(messages))}</b></div>
          <div class="crews-stat"><span>Modelo do coordenador</span><b>${E(info.model)}</b></div>
          <div class="crews-stat"><span>Onde roda</span><b>${E(info.where)}</b></div>
          <div class="crews-stat"><span>Sai do computador</span><b>${info.leaves ? 'Sim' : 'Não'}</b></div>
          ${info.coordinator ? '<button type="button" id="crew-config-open">Configurar coordenador…</button>' : ''}
          ${selected ? `<label>Modelo deste agente<select id="crew-model"><option value="">Sem modelo</option>${[['Modelos menores', choices.filter(choice => !choice.advanced)], ['70B ou mais · só o coordenador', choices.filter(choice => choice.advanced)]].filter(([, group]) => group.length).map(([label, group]) => `<optgroup label="${E(label)}">${group.map(choice => `<option value="${E(choice.key)}" ${choice.disabled ? 'disabled' : ''} ${choice.key === selected.model ? 'selected' : ''}>${E(modelOptionLabel(choice))}</option>`).join('')}</optgroup>`).join('')}</select></label>${suggestion ? '<button type="button" id="crew-suggest">Usar sugestão</button>' : ''}<label>Mascote<select id="crew-mascot">${CREW_MASCOTS.map(id => `<option value="${id}" ${id === selected.mascot ? 'selected' : ''}>${CREW_MASCOT_LABELS[id]}</option>`).join('')}</select></label><p class="crews-system">Motor: ${E(provider?.label || 'Neste computador')}${provider?.leaves_computer ? ' · sai deste computador' : ''}</p><div class="crews-actions">${selected.coordinator ? '' : '<button type="button" id="crew-coordinator">Tornar coordenador</button>'}<button type="button" class="quiet" id="crew-remove">Remover da equipe</button></div>` : ''}
        </aside>
      </div>
      <dialog class="crews-modal" id="crew-config">
        <form id="crew-remote">
          <h2>Configurar coordenador…</h2>
          <p class="notice">Esta ligação pode sair deste computador. Confirme o aviso antes de salvar. Nada fica público por padrão e o token fica só no cofre.</p>
          <label>Provedor<select name="kind"><option value="anthropic">Anthropic</option><option value="xai">xAI</option><option value="openai">Outro computador</option><option value="exo">EXO em loopback</option></select></label>
          <label>Nome<input name="label" required maxlength="80" value="Coordenador"></label>
          <label>Modelo do provedor<input name="model" required maxlength="120" placeholder="claude-sonnet ou o id no outro computador"></label>
          <label>Endereço<input name="endpoint" maxlength="300" placeholder="https://192.168.1.20/v1 ou http://127.0.0.1:52415"></label>
          <label>Token<input name="token" type="password" autocomplete="off" maxlength="500"></label>
          <label class="crews-check"><input name="acknowledged" type="checkbox" required>Compreendo que o pedido pode sair deste computador.</label>
          <label class="crews-check"><input name="confirm_remote" type="checkbox" required>Confirmo esta ligação.</label>
          <label class="crews-check"><input name="trusted_network" type="checkbox">Esta é uma rede privada confiável.</label>
          <div class="crews-actions"><button class="primary" type="submit">Salvar</button><button type="button" id="crew-config-close">Fechar</button></div>
        </form>
      </dialog>
    </section>`;
    const log = $('.crews-thread');
    if (log) log.scrollTop = log.scrollHeight;
    bind(messages);
  }

  function bind() {
    const limits = $('#crew-limits');
    limits.onsubmit = event => {
      event.preventDefault();
      const button = limits.querySelector('[type="submit"]');
      button.disabled = true;
      post('/crews/settings', { max_tokens: Number(limits.max_tokens.value), max_rounds: Number(limits.max_rounds.value) }).then(() => open()).catch(error => toast(error.message)).finally(() => { if (button.isConnected) button.disabled = false; });
    };
    $('#content').onclick = event => {
      const agent = event.target.closest('[data-crew-agent]');
      const team = event.target.closest('[data-crew-view]');
      if (agent) { view = agent.dataset.crewAgent; open().catch(error => toast(error.message)); return; }
      if (team) { view = 'team'; open().catch(error => toast(error.message)); return; }
      if (event.target.id === 'crew-help') { const pop = $('#crew-help-pop'); pop.hidden = !pop.hidden; event.target.setAttribute('aria-expanded', String(!pop.hidden)); $('#crew-limits-pop').hidden = true; return; }
      if (event.target.id === 'crew-limits-open') { const pop = $('#crew-limits-pop'); pop.hidden = !pop.hidden; event.target.setAttribute('aria-expanded', String(!pop.hidden)); $('#crew-help-pop').hidden = true; return; }
      if (event.target.id === 'crew-stop') { talkAbort?.abort(); return; }
      if (event.target.id === 'crew-config-open') { $('#crew-config').showModal(); return; }
      if (event.target.id === 'crew-config-close') { $('#crew-config').close(); return; }
      if (event.target.id === 'crew-link') { event.target.disabled = true; post('/crews/link', {}).then(() => open()).catch(error => { toast(error.message); if (event.target.isConnected) event.target.disabled = false; }); return; }
      if (event.target.id === 'crew-suggest' && view !== 'team') { event.target.disabled = true; const pick = crew.recommendation.preferred || crew.recommendation.fallback; post(`/crews/members/${view}/model`, { model: pick.id }).then(() => open()).catch(error => { toast(error.message); if (event.target.isConnected) event.target.disabled = false; }); return; }
      if (event.target.id === 'crew-coordinator') { event.target.disabled = true; api(`/crews/members/${view}`, { method: 'PATCH', body: { coordinator: true } }).then(() => open()).catch(error => { toast(error.message); if (event.target.isConnected) event.target.disabled = false; }); return; }
      if (event.target.id === 'crew-remove') { if (!confirm('Remover este agente da equipe? O bot continua em Minha equipe.')) return; api(`/crews/members/${view}`, { method: 'DELETE' }).then(() => { view = 'team'; return open(); }).catch(error => toast(error.message)); }
    };
    const pref = $('#crew-mascot-pref');
    if (pref) pref.onchange = () => { localStorage.setItem(MASCOT_KEY, pref.checked ? '1' : '0'); open().catch(error => toast(error.message)); };
    const add = $('#crew-add');
    if (add) add.onchange = () => { if (!add.value) return; post('/crews/members', { bot_id: add.value }).then(next => { view = add.value; crew = next; return open(); }).catch(error => toast(error.message)); };
    const model = $('#crew-model');
    if (model) model.onchange = () => { if (model.value === (crew.members.find(member => member.bot_id === view)?.model || '')) return; post(`/crews/members/${view}/model`, { model: model.value }).then(() => open()).catch(error => toast(error.message)); };
    const mascot = $('#crew-mascot');
    if (mascot) mascot.onchange = () => api(`/crews/members/${view}`, { method: 'PATCH', body: { mascot: mascot.value } }).then(() => open()).catch(error => toast(error.message));
    const remote = $('#crew-remote');
    if (remote) remote.onsubmit = event => {
      event.preventDefault();
      const button = remote.querySelector('[type="submit"]');
      const coordinator = coordinatorOf();
      if (!coordinator) { toast('A equipe precisa de um coordenador.'); return; }
      button.disabled = true;
      const payload = { kind: remote.kind.value, label: remote.label.value.trim(), model: remote.model.value.trim(), acknowledged: remote.acknowledged.checked, confirm_remote: remote.confirm_remote.checked, trusted_network: remote.trusted_network.checked };
      if (remote.endpoint.value.trim()) payload.endpoint = remote.endpoint.value.trim();
      if (remote.token.value) payload.token = remote.token.value;
      post('/crews/providers', payload).then(provider => api(`/crews/members/${coordinator.bot_id}`, { method: 'PATCH', body: { provider_id: provider.id } })).then(() => { $('#crew-config').close(); return open(); }).catch(error => toast(error.message)).finally(() => { if (button.isConnected) button.disabled = false; });
    };
    const draftForm = $('#crew-compose') || $('#crew-talk');
    if (draftForm) {
      const draft = draftForm.querySelector('textarea');
      const team = draftForm.id === 'crew-talk';
      draftForm.onsubmit = event => {
        event.preventDefault();
        const button = draftForm.querySelector('[type="submit"]');
        button.disabled = true;
        if (!team) {
          post(`/crews/members/${view}/messages`, { content: draft.value }).then(() => open()).catch(error => toast(error.message)).finally(() => { if (button.isConnected) button.disabled = false; });
          return;
        }
        talking = true;
        talkAbort = new AbortController();
        const stop = $('#crew-stop');
        if (stop) stop.disabled = false;
        fetch('/v1/crews/talk', {
          method: 'POST',
          signal: talkAbort.signal,
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ content: draft.value }),
        }).then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
          if (data.stopped) toast(talkNote(data.stopped));
        }).catch(error => {
          if (error.name === 'AbortError') toast(talkNote('abort'));
          else toast(error.message);
        }).finally(() => {
          talking = false;
          talkAbort = null;
          open().finally(() => { if (button.isConnected) button.disabled = false; });
        });
      };
    }
  }

  function talkNote(stopped) {
    const notes = {
      done: 'A equipe respondeu dentro dos limites.',
      rounds: 'A conversa parou no máximo de rodadas.',
      tokens: 'A conversa parou no limite de tokens.',
      abort: 'A conversa foi interrompida.',
      self: 'O coordenador não pede a si mesmo.',
      local: 'Os colegas ficam no modelo deste computador.',
      model: 'Falta um modelo local neste agente.',
    };
    return notes[stopped] || 'A conversa da equipe terminou.';
  }

  return { render: () => open().catch(error => toast(error.message)) };
}
