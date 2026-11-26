import { format, t } from './i18n.js';

export function mountMcpServers({ api, escape, toast, root }) {
  if (!root) return;
  let busy = false;

  function row(server) {
    const tools = Array.isArray(server.tools) ? server.tools : [];
    const status = server.connected ? t('settings.mcp.connected') : t('settings.mcp.disconnected');
    const detail = server.error ? `${status} — ${server.error}` : status;
    const names = tools
      .slice(0, 8)
      .map((tool) => `<li><code>${escape(tool.name)}</code></li>`)
      .join('');
    return `<article class="settings-row"><div><strong>${escape(server.url)}</strong>${server.server ? `<p>${escape(server.server)}</p>` : ''}<p>${escape(detail)}</p><p>${escape(format('settings.mcp.tools', { count: tools.length }))}</p>${names ? `<ul>${names}</ul>` : ''}</div><div class="actions"><button type="button" class="secondary" data-mcp-test="${escape(server.id)}">${t('settings.mcp.test')}</button><button type="button" class="quiet" data-mcp-remove="${escape(server.id)}">${t('settings.mcp.remove')}</button></div></article>`;
  }

  async function draw() {
    const servers = await api('/mcp-servers');
    if (!root.isConnected) return;
    root.innerHTML = `<h2>${t('settings.mcp.title')}</h2><p>${t('settings.mcp.help')}</p><form id="mcp-add-form"><label>${t('settings.mcp.url')}<input name="url" type="url" required maxlength="2048" autocomplete="off" spellcheck="false"></label><button class="secondary" type="submit">${t('settings.mcp.add')}</button></form>${servers.length ? servers.map(row).join('') : `<p class="muted">${t('settings.mcp.empty')}</p>`}`;
  }

  root.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'mcp-add-form') return;
    event.preventDefault();
    if (busy) return;
    const url = String(new FormData(form).get('url') || '').trim();
    const button = form.querySelector('button');
    busy = true;
    if (button) button.disabled = true;
    api('/mcp-servers', { method: 'POST', body: { url } })
      .then(() => draw())
      .catch((error) => toast(error.message))
      .finally(() => {
        busy = false;
        if (button) button.disabled = false;
      });
  });

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    const test = button.dataset.mcpTest;
    const remove = button.dataset.mcpRemove;
    if (!test && !remove) return;
    busy = true;
    button.disabled = true;
    const previous = button.textContent;
    if (test) button.textContent = t('settings.mcp.testing');
    const request = test
      ? api(`/mcp-servers/${encodeURIComponent(test)}/test`, { method: 'POST', body: {} })
      : api(`/mcp-servers/${encodeURIComponent(remove)}`, { method: 'DELETE' });
    request
      .then(() => draw())
      .catch((error) => toast(error.message))
      .finally(() => {
        busy = false;
        button.disabled = false;
        if (button.isConnected) button.textContent = previous;
      });
  });

  draw().catch((error) => {
    root.innerHTML = `<h2>${t('settings.mcp.title')}</h2><p class="notice warn">${escape(error.message)}</p>`;
  });
}
