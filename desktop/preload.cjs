const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preload scripts can require only the electron module, not another file.
// Keep this copy aligned with desktop/preload-api.cjs.
const ALLOWED_IPC_CHANNELS = Object.freeze([
  'localneuron:restore-workspace',
  'localneuron:local-access',
  'localneuron:conversation-folder',
  'colmeia:choose-folder',
]);

const allowed = new Set(ALLOWED_IPC_CHANNELS);

function invokeAllowed(ipcRenderer, channel, args) {
  if (!allowed.has(channel)) throw new Error('Canal IPC não permitido.');
  return ipcRenderer.invoke(channel, ...args);
}

const LOCALE_TOKEN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

function safeLocaleToken(value) {
  const text = String(value || '').trim();
  return LOCALE_TOKEN.test(text) ? text : '';
}

function launchHint(argv, name) {
  const prefix = `${name}=`;
  const found = [...(argv || [])].reverse().find(item => typeof item === 'string' && item.startsWith(prefix));
  return found ? safeLocaleToken(found.slice(prefix.length)) : '';
}

function createDesktopApi(ipcRenderer, argv = []) {
  return Object.freeze({
    restoreWorkspace: () => invokeAllowed(ipcRenderer, 'localneuron:restore-workspace', []),
    localAccess: action => invokeAllowed(ipcRenderer, 'localneuron:local-access', [action]),
    conversationFolder: action => invokeAllowed(ipcRenderer, 'localneuron:conversation-folder', [action]),
    chooseFolder: () => invokeAllowed(ipcRenderer, 'colmeia:choose-folder', []),
    locale: launchHint(argv, 'localneuron-locale'),
    lang: launchHint(argv, 'localneuron-lang'),
  });
}

function exposeDesktopApi(contextBridge, ipcRenderer, argv = process.argv) {
  contextBridge.exposeInMainWorld('colmeiaDesktop', createDesktopApi(ipcRenderer, argv));
}

exposeDesktopApi(contextBridge, ipcRenderer);
