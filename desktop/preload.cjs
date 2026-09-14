const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "colmeiaDesktop",
  Object.freeze({
    restoreWorkspace: () => ipcRenderer.invoke('localneuron:restore-workspace'),
    localAccess: action => ipcRenderer.invoke('localneuron:local-access',action),
    chooseFolder: () => ipcRenderer.invoke("colmeia:choose-folder"),
  }),
);
