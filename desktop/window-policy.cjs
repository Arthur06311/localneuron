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

function isPublicHttpUrl(value) {
  try {
    const target = new URL(value);
    return ['https:', 'http:'].includes(target.protocol)
      && !target.username
      && !target.password
      && (!target.port || ['80', '443'].includes(target.port))
      && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  } catch {
    return false;
  }
}

function isAgentHttpUrl(value) {
  try {
    const target = new URL(value);
    return ['https:', 'http:'].includes(target.protocol)
      && !target.username
      && !target.password
      && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  } catch {
    return false;
  }
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

function openExternalHttp(url, openExternal) {
  if (!isPublicHttpUrl(url)) return false;
  try {
    const pending = openExternal(new URL(url).href);
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {}
  return true;
}

function blockWhen(event, blocked) {
  if (blocked) event.preventDefault();
}

function createMainWindow(BrowserWindow, { preload, origin, shell }) {
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
    openExternalHttp(url, href => shell.openExternal(href));
    return { action: 'deny' };
  });
  const blockExternal = (event, url) => blockWhen(event, leavesApp(url, origin));
  window.webContents.on('will-navigate', blockExternal);
  window.webContents.on('will-redirect', blockExternal);
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  return window;
}

function createAgentWindow(BrowserWindow) {
  const window = new BrowserWindow({
    width: 1100,
    height: 780,
    title: 'LocalNeuron · Navegador controlado pela IA',
    webPreferences: agentWebPreferences(),
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const blockUnsafe = (event, url) => blockWhen(event, !isAgentHttpUrl(url));
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
