const { relative, resolve } = require('node:path');
const { mkdirSync, statSync } = require('node:fs');

/** Pasta do PGlite em que o estado das conversas é gravado. */
function conversationHistoryDir(dataDirectory) {
  if (typeof dataDirectory !== 'string' || !dataDirectory.trim()) throw new Error('Pasta inválida.');
  const root = resolve(dataDirectory);
  const folder = resolve(root, 'postgres');
  if (relative(root, folder) !== 'postgres') throw new Error('Pasta inválida.');
  return folder;
}

function ensureDirectory(folder, mkdir, stat) {
  try {
    if (stat(folder).isDirectory()) return true;
    return false;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') return false;
  }
  try {
    mkdir(folder, { recursive: true, mode: 0o700 });
    return true;
  } catch {
    return false;
  }
}

function registerConversationFolder({ ipcMain, shell, getWindow, origin, dataDirectory, mkdir = mkdirSync, stat = statSync }) {
  const folder = conversationHistoryDir(dataDirectory);
  ipcMain.handle('localneuron:conversation-folder', async (event, action) => {
    const window = getWindow();
    if (!window || event.senderFrame !== window.webContents.mainFrame || new URL(event.senderFrame.url).origin !== origin) throw new Error('Origem recusada');
    if (action === 'path') return { ok: true, path: folder };
    if (action !== 'open') throw new Error('Ação inválida');
    if (!ensureDirectory(folder, mkdir, stat)) return { ok: false };
    try {
      const opened = await shell.openPath(folder);
      if (opened) return { ok: false };
      return { ok: true, path: folder };
    } catch {
      return { ok: false };
    }
  });
}

module.exports = { conversationHistoryDir, ensureDirectory, registerConversationFolder };
