const ALLOWED_IPC_CHANNELS = Object.freeze([
  'localneuron:restore-workspace',
  'localneuron:local-access',
  'colmeia:choose-folder',
]);

const allowed = new Set(ALLOWED_IPC_CHANNELS);

function invokeAllowed(ipcRenderer, channel, args) {
  if (!allowed.has(channel)) throw new Error('Canal IPC não permitido.');
  return ipcRenderer.invoke(channel, ...args);
}

function createDesktopApi(ipcRenderer) {
  return Object.freeze({
    restoreWorkspace: () => invokeAllowed(ipcRenderer, 'localneuron:restore-workspace', []),
    localAccess: action => invokeAllowed(ipcRenderer, 'localneuron:local-access', [action]),
    chooseFolder: () => invokeAllowed(ipcRenderer, 'colmeia:choose-folder', []),
  });
}

function exposeDesktopApi(contextBridge, ipcRenderer) {
  contextBridge.exposeInMainWorld('colmeiaDesktop', createDesktopApi(ipcRenderer));
}

module.exports = { ALLOWED_IPC_CHANNELS, invokeAllowed, createDesktopApi, exposeDesktopApi };
