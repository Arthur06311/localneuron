import { CREW_MASCOTS, CREW_MASCOT_LABELS, crewMascot, crewModelChoices, estimateTokens, modelOptionLabel } from './crew-mascots.js';

export function createCrews({ api, escape: E, toast, navigate, isVisible = () => true }) {
  const $ = selector => document.querySelector(selector);
  let crew = null;
  let library = null;
  let view = 'team';
  let generation = 0;

  const post = (url, body) => api(url, { method: 'POST', body });
  const tokens = value => Number(value || 0).toLocaleString('pt-PT');

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

  function authorLabel(message) {
    if (message.author === 'user') return 'Eu';
    if (message.author === 'coordinator') return `Coordenador · ${memberName(message.author_bot_id)}`;
    if (message.author === 'system') return 'Sistema';
    return memberName(message.author_bot_id || message.bot_id);
  }

  function paint(messages) {
    const settings = crew.settings;
    const used = messages.reduce((sum, message) => sum + Number(message.tokens || 0), 0);
    const over = used > settings.max_tokens;
    const suggestion = crew.recommendation?.preferred || crew.recommendation?.fallback;
    const work = crew.available_bots.filter(bot => bot.area === 'work' && !bot.linked);
    const selected = view === 'team' ? null : crew.members.find(member => member.bot_id === view);
    const provider = selected ? crew.providers.find(item => item.id === selected.provider_id) : null;
    const choices = selected ? crewModelChoices({
      catalog: library?.catalog || [],
      installed: library?.installed || [],
      suggestion,
      current: selected.model,
      coordinator: selected.coordinator,
      advancedMin: crew.recommendation?.advanced_min_parameters_b ?? 70,
    }) : [];
    $('#content').innerHTML = `<section class="crews-page">
      <div class="page-head"><div><span class="eyebrow">EQUIPAS</span><h1>A conversa da equipa</h1><p class="subhead">${E(crew.relation)}</p></div></div>
      <form id="crew-limits" class="crews-limit">
        <div class="crews-limit-readout"><span>Limite de tokens por conversa</span><strong data-crew-token-limit>${tokens(settings.max_tokens)}</strong><span>${tokens(settings.max_rounds)} rondas no máximo</span></div>
        <label>Tokens<input name="max_tokens" type="number" min="256" max="32768" step="1" required value="${settings.max_tokens}"></label>
        <label>Rondas<input name="max_rounds" type="number" min="1" max="8" step="1" required value="${settings.max_rounds}"></label>
        <button class="secondary" type="submit">Guardar limites</button>
      </form>
      <p class="notice crews-note">${E(crew.recommendation?.note || '')}</p>
      ${suggestion ? `<p class="muted">Sugestão para este computador: <strong>${E(suggestion.name)}</strong>${suggestion.parameters_b ? ` · ${suggestion.parameters_b}B` : ''}.</p>` : '<p class="muted">Nenhum modelo de 7B a 14B cabe neste computador agora.</p>'}
      <div class="crews-shell">
        <aside class="crews-roster" aria-label="Agentes da equipa">
          <h2>Agentes</h2>
          <button type="button" class="crews-team-link" data-crew-view="team" ${view === 'team' ? 'aria-current="true"' : ''}>${crewMascot('coordenador')}<span>Conversa da equipa<small>O que todos disseram</small></span></button>
          ${crew.members.map(member => `<button type="button" class="crews-agent" data-crew-agent="${E(member.bot_id)}" ${member.bot_id === view ? 'aria-current="true"' : ''}>${crewMascot(member.mascot)}<span><strong>${E(member.missing ? 'Bot em falta' : member.name || 'Sem nome')}</strong><small>${member.coordinator ? 'Coordenador' : 'Colega'} · ${E(CREW_MASCOT_LABELS[member.mascot] || member.mascot)}</small></span>${member.unread ? `<span class="crews-unread" aria-label="${member.unread} mensagens por ler">${member.unread > 99 ? '99+' : member.unread}</span>` : ''}</button>`).join('') || '<p class="muted">Ainda não há agentes ligados.</p>'}
          <div class="crews-actions"><button type="button" class="primary" id="crew-link">Ligar bots de trabalho</button><button type="button" class="secondary" data-page="team">Abrir Minha equipe</button></div>
          ${work.length ? `<label>Adicionar um bot de trabalho<select id="crew-add"><option value="">Escolher</option>${work.map(bot => `<option value="${E(bot.id)}">${E(bot.name)}</option>`).join('')}</select></label>` : ''}
        </aside>
        <div class="crews-main">
          <h2>${selected ? E(selected.name || 'Agente') : 'Conversa da equipa'}</h2>
          <p class="muted" data-crew-usage>${over ? 'Esta conversa já passou o limite.' : 'Dentro do limite.'} ${tokens(used)} de ${tokens(settings.max_tokens)} tokens.</p>
          <div class="crews-thread" role="log">${messages.map(message => `<article class="crews-bubble" data-author="${E(message.author)}" data-crew-round="${message.round || 0}"><header><strong>${E(authorLabel(message))}</strong><span>${message.round ? `Ronda ${message.round} · ` : ''}${tokens(message.tokens)} tokens</span></header><p>${E(message.content)}</p></article>`).join('') || '<p class="muted">Sem mensagens nesta conversa.</p>'}</div>
          ${selected ? `<form id="crew-compose" class="crews-compose"><label>Mensagem para ${E(selected.name || 'este agente')}<textarea name="content" maxlength="16000" required placeholder="Escreva o que este agente deve ver."></textarea></label><p class="muted" id="crew-draft-tokens">Esta mensagem: 0 tokens. O limite da conversa é ${tokens(settings.max_tokens)}.</p><button class="primary" type="submit">Enviar</button></form>
            <div class="crews-model"><label>Modelo deste agente<select id="crew-model"><option value="">Sem modelo escolhido</option>${[['Modelos menores', choices.filter(choice => !choice.advanced)], ['70B ou mais · só o coordenador', choices.filter(choice => choice.advanced)]].filter(([, group]) => group.length).map(([label, group]) => `<optgroup label="${E(label)}">${group.map(choice => `<option value="${E(choice.key)}" ${choice.disabled ? 'disabled' : ''} ${choice.key === selected.model ? 'selected' : ''}>${E(modelOptionLabel(choice))}</option>`).join('')}</optgroup>`).join('')}</select></label><p class="muted">${selected.coordinator ? 'O coordenador pode usar um modelo maior.' : 'Este agente fica com um modelo menor. 70B, EXO, outro computador e nuvem são só do coordenador.'}</p>${suggestion ? `<button type="button" class="secondary" id="crew-suggest">Usar sugestão neste agente</button>` : ''}
            <label>Mascote<select id="crew-mascot">${CREW_MASCOTS.map(id => `<option value="${id}" ${id === selected.mascot ? 'selected' : ''}>${CREW_MASCOT_LABELS[id]}</option>`).join('')}</select></label>
            <p class="muted">Motor: ${E(provider?.label || 'Neste computador')}${provider?.leaves_computer ? ' · sai deste computador' : ''}</p>
            <div class="crews-actions">${selected.coordinator ? '' : '<button type="button" class="secondary" id="crew-coordinator">Tornar coordenador</button>'}<button type="button" class="quiet" id="crew-remove">Retirar da equipa</button></div></div>` : `<form id="crew-talk" class="crews-compose"><label>Pedido à equipa<textarea name="content" maxlength="16000" required placeholder="O coordenador divide este pedido pelos colegas, dentro das rondas e dos tokens."></textarea></label><p class="muted" id="crew-draft-tokens">Esta mensagem: 0 tokens. O limite da conversa é ${tokens(settings.max_tokens)}. Cada pedido usa no máximo ${tokens(settings.max_rounds)} rondas.</p><button class="primary" type="submit" ${crew.members.some(member => member.coordinator) ? '' : 'disabled'}>Pedir à equipa</button></form>`}
        </div>
      </div>
    </section>`;
    const thread = $('.crews-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
    bind(messages);
  }

  function bind() {
    $('#crew-limits').onsubmit = event => {
      event.preventDefault();
      const form = event.target;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      post('/crews/settings', { max_tokens: Number(form.max_tokens.value), max_rounds: Number(form.max_rounds.value) }).then(() => open()).catch(error => toast(error.message)).finally(() => { if (button.isConnected) button.disabled = false; });
    };
    $('#content').onclick = event => {
      const agent = event.target.closest('[data-crew-agent]');
      const team = event.target.closest('[data-crew-view]');
      if (agent) { view = agent.dataset.crewAgent; open().catch(error => toast(error.message)); return; }
      if (team) { view = 'team'; open().catch(error => toast(error.message)); return; }
      if (event.target.id === 'crew-link') { event.target.disabled = true; post('/crews/link', {}).then(() => open()).catch(error => { toast(error.message); if (event.target.isConnected) event.target.disabled = false; }); return; }
      if (event.target.id === 'crew-suggest' && view !== 'team') { event.target.disabled = true; const pick = crew.recommendation.preferred || crew.recommendation.fallback; post(`/crews/members/${view}/model`, { model: pick.id }).then(() => open()).catch(error => { toast(error.message); if (event.target.isConnected) event.target.disabled = false; }); return; }
      if (event.target.id === 'crew-coordinator') { event.target.disabled = true; api(`/crews/members/${view}`, { method: 'PATCH', body: { coordinator: true } }).then(() => open()).catch(error => { toast(error.message); if (event.target.isConnected) event.target.disabled = false; }); return; }
      if (event.target.id === 'crew-remove') { if (!confirm('Retirar este agente da equipa? O bot continua em Minha equipe.')) return; api(`/crews/members/${view}`, { method: 'DELETE' }).then(() => { view = 'team'; return open(); }).catch(error => toast(error.message)); }
    };
    const add = $('#crew-add');
    if (add) add.onchange = () => { if (!add.value) return; post('/crews/members', { bot_id: add.value }).then(next => { view = add.value; crew = next; return open(); }).catch(error => toast(error.message)); };
    const model = $('#crew-model');
    if (model) model.onchange = () => { if (model.value === (crew.members.find(member => member.bot_id === view)?.model || '')) return; post(`/crews/members/${view}/model`, { model: model.value }).then(() => open()).catch(error => toast(error.message)); };
    const mascot = $('#crew-mascot');
    if (mascot) mascot.onchange = () => api(`/crews/members/${view}`, { method: 'PATCH', body: { mascot: mascot.value } }).then(() => open()).catch(error => toast(error.message));
    const draftForm = $('#crew-compose') || $('#crew-talk');
    if (draftForm) {
      const draft = draftForm.querySelector('textarea');
      const team = draftForm.id === 'crew-talk';
      draft.oninput = () => { $('#crew-draft-tokens').textContent = `Esta mensagem: ${tokens(estimateTokens(draft.value))} tokens. O limite da conversa é ${tokens(crew.settings.max_tokens)}.${team ? ` Cada pedido usa no máximo ${tokens(crew.settings.max_rounds)} rondas.` : ''}`; };
      draftForm.onsubmit = event => {
        event.preventDefault();
        const button = draftForm.querySelector('[type="submit"]');
        button.disabled = true;
        const request = team ? post('/crews/talk', { content: draft.value }) : post(`/crews/members/${view}/messages`, { content: draft.value });
        request.then(result => { if (team && result?.stopped) toast(talkNote(result.stopped)); return open(); }).catch(error => toast(error.message)).finally(() => { if (button.isConnected) button.disabled = false; });
      };
    }
  }

  function talkNote(stopped) {
    const notes = {
      done: 'A equipa respondeu dentro dos limites.',
      rounds: 'A conversa parou no máximo de rondas.',
      tokens: 'A conversa parou no limite de tokens.',
      abort: 'A conversa foi interrompida.',
      self: 'O coordenador não se pede a si próprio.',
      local: 'Esta fase fala só com o modelo deste computador.',
      model: 'Falta um modelo local num destes agentes.',
    };
    return notes[stopped] || 'A conversa da equipa terminou.';
  }

  return { render: () => open().catch(error => toast(error.message)) };
}
