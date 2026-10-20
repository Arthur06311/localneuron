const { isPublicHttpUrl, isAgentHttpUrl } = require('./public-url.cjs');

const SECURE_WEB_PREFERENCES = Object.freeze({
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
});

function mainWebPreferences(preload) {
  return { ...SECURE_WEB_PREFERENCES, preload, spellcheck: false };
}

function agentWebPreferences() {
  return { ...SECURE_WEB_PREFERENCES, partition: 'persist:localneuron-agent-browser' };
}

function leavesApp(url, origin) {
  try {
    const target = new URL(url);
    if (target.username || target.password) return true;
    return target.origin !== origin;
  } catch {
    return true;
  }
}

function openExternalHttp(url, openExternal, resolveHost) {
  if (!isPublicHttpUrl(url)) return false;
  const href = new URL(url).href;
  const open = () => {
    try {
      const pending = openExternal(href);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch { /* o navegador do sistema pode recusar o endereço */ }
    return true;
  };
  if (typeof resolveHost !== 'function') return open();
  Promise.resolve(resolveHost(new URL(url).hostname)).then(ok => { if (ok) open(); }).catch(() => {});
  return true;
}

function blockWhen(event, blocked) {
  if (blocked) event.preventDefault();
}

function createMainWindow(BrowserWindow, { preload, origin, shell, resolveHost }) {
  const window = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 760,
    minHeight: 640,
    title: 'LocalNeuron',
    backgroundColor: '#f6f5f0',
    autoHideMenuBar: true,
    webPreferences: mainWebPreferences(preload),
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttp(url, href => shell.openExternal(href), resolveHost);
    return { action: 'deny' };
  });
  const blockExternal = (event, url) => blockWhen(event, leavesApp(url, origin));
  window.webContents.on('will-navigate', blockExternal);
  window.webContents.on('will-redirect', blockExternal);
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  return window;
}

function createAgentWindow(BrowserWindow, { resolveHost } = {}) {
  const window = new BrowserWindow({
    width: 1100,
    height: 780,
    title: 'LocalNeuron · Navegador controlado pela IA',
    webPreferences: agentWebPreferences(),
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const stopNavigation = () => {
    if (typeof window.isDestroyed === 'function' && window.isDestroyed()) return;
    if (window.webContents && typeof window.webContents.stop === 'function') window.webContents.stop();
  };
  const blockUnsafe = (event, url) => {
    if (!isAgentHttpUrl(url)) { event.preventDefault(); return; }
    if (typeof resolveHost !== 'function') return;
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch { event.preventDefault(); return; }
    Promise.resolve(resolveHost(hostname)).then(ok => { if (!ok) stopNavigation(); }).catch(() => stopNavigation());
  };
  window.webContents.on('will-navigate', blockUnsafe);
  window.webContents.on('will-redirect', blockUnsafe);
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  return window;
}

module.exports = {
  SECURE_WEB_PREFERENCES,
  mainWebPreferences,
  agentWebPreferences,
  isPublicHttpUrl,
  isAgentHttpUrl,
  leavesApp,
  openExternalHttp,
  createMainWindow,
  createAgentWindow,
};
