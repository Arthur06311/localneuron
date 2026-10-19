const { contextBridge, ipcRenderer } = require('electron');
const { exposeDesktopApi } = require('./preload-api.cjs');
exposeDesktopApi(contextBridge, ipcRenderer);
