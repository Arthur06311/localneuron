export function createServerMode({ api, escape, toast, isVisible }) {
  const $ = (selector) => document.querySelector(selector);
  let state = null;
  const gib = (bytes) => (bytes / 1073741824).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' GiB';
  function mapSvg(map) {
    if (!map?.nodes?.length) return '<p>Nenhum computador apareceu no EXO.</p>';
    const width = Math.max(360, map.nodes.length * 170);
    const positions = new Map(map.nodes.map((node, index) => [node.id, { x: 90 + index * 160, y: 78 }]));
    const lines = map.links.map((link) => {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      if (!from || !to) return '';
      return `<line class="server-link ${link.kind}" data-link-kind="${link.kind}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>`;
    }).join('');
    const circles = map.nodes.map((node) => {
      const point = positions.get(node.id);
      return `<g data-node="${escape(node.id)}"><circle class="server-node${node.master ? ' master' : ''}" cx="${point.x}" cy="${point.y}" r="28"></circle><text x="${point.x}" y="${point.y + 48}" text-anchor="middle">${escape(node.name)}</text><text x="${point.x}" y="${point.y + 66}" text-anchor="middle">${gib(node.total)} de RAM</text></g>`;
    }).join('');
    return `<svg class="server-map" viewBox="0 0 ${width} 180" role="img" aria-label="Mapa dos computadores da rede">${lines}${circles}</svg><p class="muted">Linha grossa: Thunderbolt ou RDMA reportado pelo EXO. Linha fina: rede. O caminho desta fase é TCP.</p>`;
  }
  function draw() {
    if (!isVisible() || !$('#server-mode')) return;
    const off = state.role === 'off';
    $('#server-status').textContent = off ? 'Tudo desligado.' : state.plan.note;
    $('#server-map').innerHTML = state.map ? mapSvg(state.map) : '<p>O mapa aparece depois de descobrir os nós.</p>';
    const nodes = state.map?.nodes || [];
    $('#server-pick').innerHTML = nodes.length ? `<fieldset><legend>Escolher quais computadores</legend>${nodes.map((node) => `<label class="check-line"><input type="checkbox" name="server-node" value="${escape(node.id)}" ${state.selected?.includes(node.id) ? 'checked' : ''}>${escape(node.name)} · ${gib(node.available)} livres</label>`).join('')}</fieldset><label>Modelo da prévia<input id="server-model" value="llama-70b" maxlength="400"></label><button type="button" class="secondary" data-server="preview">Ver a memória por computador</button><div id="server-preview"></div>` : '';
    document.querySelectorAll('input[name="server-role"]').forEach((input) => { input.checked = input.value === state.role; });
    const noWorker = $('#server-no-worker');
    if (noWorker) noWorker.checked = state.no_worker === true;
  }
  async function render() {
    state = await api('/server-mode');
    const gateway = await api('/server-gateway');
    if (!isVisible()) return;
    const contribute = state.eligibility.allowed ? '' : 'disabled';
    const experimental = state.eligibility.experimental ? ' <span class="tag">experimental</span>' : '';
    $('#content').innerHTML = `<div class="page-head"><div><span class="eyebrow">REDE LOCAL</span><h1>Modo servidor</h1><p class="subhead">Como este computador vai participar?</p></div></div><section class="panel" id="server-mode"><form id="server-role"><fieldset><legend>Como este computador vai participar?</legend><label class="check-line"><input type="radio" name="server-role" value="off" ${state.role === 'off' ? 'checked' : ''}> Desligado</label><label class="check-line"><input type="radio" name="server-role" value="contribute" ${contribute} ${state.role === 'contribute' ? 'checked' : ''}> Contribuir${experimental}</label><p>${escape(state.eligibility.reason)}</p><label class="check-line"><input type="radio" name="server-role" value="manage" ${state.role === 'manage' ? 'checked' : ''}> Gerenciar</label><label class="check-line"><input id="server-no-worker" type="checkbox" ${state.no_worker ? 'checked' : ''}> não rodar modelo aqui</label><p>O EXO pode eleger outro master. Gerenciar usa --force-master e, com a opção acima, --no-worker.</p><label class="check-line"><input type="radio" name="server-role" value="use" ${state.role === 'use' ? 'checked' : ''}> Só usar</label><p>Só usar funciona em qualquer sistema e não inicia um nó.</p></fieldset><label>Endereço do EXO na rede local<input id="server-endpoint" value="${escape(state.endpoint)}" maxlength="150"></label><div class="actions"><button type="submit" class="primary">Guardar papel</button><button type="button" class="secondary" data-server="map">Descobrir os nós</button></div></form><p id="server-status" role="status"></p><div id="server-map"></div><div id="server-pick"></div>${gateway.exo_warning ? `<p role="alert" id="server-exo-warning">${escape(gateway.exo_warning)}</p>` : ''}<section class="panel" id="server-pair"><h2>Parear um computador</h2><p>O código tem 6 dígitos e expira depressa. Cada máquina recebe uma chave própria, guardada no cofre. Só a rede local entra. Nada é aberto para a internet.</p><label>Endereço privado deste computador<input id="server-host" value="192.168.1.20" maxlength="80"></label><div class="actions"><button type="button" class="secondary" data-server="code">Gerar código</button><button type="button" class="secondary" data-server="open">Abrir o gateway na rede local</button><button type="button" class="quiet" data-server="stop">Desligar o gateway</button></div><p id="server-code" role="status"></p><ul>${(gateway.peers || []).map((peer) => `<li>${escape(peer.name)}${peer.revoked ? ' · revogada' : ` <button type="button" class="quiet" data-server="revoke" data-peer="${escape(peer.id)}">Revogar</button>`}</li>`).join('')}</ul><h3>Registo local</h3><ul>${(gateway.log || []).map((row) => `<li>${escape(row.machine_id)} · ${escape(row.path)}</li>`).join('') || '<li>Ainda não há uso registado.</li>'}</ul></section></section>`;
    $('#server-role').addEventListener('submit', (event) => {
      event.preventDefault();
      const role = $('#server-role').querySelector('input[name="server-role"]:checked')?.value || 'off';
      const button = event.submitter;
      return action(button, async () => {
        state = await api('/server-mode/role', { method: 'POST', body: { role, no_worker: Boolean($('#server-no-worker')?.checked), endpoint: $('#server-endpoint').value } });
        draw();
      });
    });
    $('#server-mode').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button?.dataset.server) return;
      return action(button, async () => {
        if (button.dataset.server === 'map') state = await api('/server-mode/map', { method: 'POST', body: {} });
        if (button.dataset.server === 'code') {
          const issued = await api('/server-gateway/code', { method: 'POST', body: {} });
          $('#server-code').textContent = 'Código ' + issued.code + '. Ele expira depressa. Guarde-o só até a outra máquina entrar.';
          return;
        }
        if (button.dataset.server === 'open') {
          await api('/server-gateway/open', { method: 'POST', body: { host: $('#server-host').value } });
          toast('Gateway aberto só na rede local.');
          return;
        }
        if (button.dataset.server === 'stop') {
          await api('/server-gateway/stop', { method: 'POST', body: {} });
          toast('Gateway desligado.');
          return;
        }
        if (button.dataset.server === 'revoke') {
          await api('/server-gateway/revoke', { method: 'POST', body: { id: button.dataset.peer } });
          await render();
          return;
        }
        if (button.dataset.server === 'preview') {
          const nodes = [...document.querySelectorAll('input[name="server-node"]:checked')].map((input) => input.value);
          const preview = await api('/server-mode/preview', { method: 'POST', body: { model_id: $('#server-model').value, nodes } });
          state = preview;
          draw();
          $('#server-preview').innerHTML = preview.preview.map((item) => `<p>${escape(item.id)} · ${gib(item.bytes)} nesta divisão</p>`).join('');
          return;
        }
        draw();
      });
    });
    draw();
  }
  async function action(button, fn) {
    if (button) button.disabled = true;
    try { await fn(); } catch (error) { toast(error.message); } finally { if (button) button.disabled = false; }
  }
  return { render };
}
