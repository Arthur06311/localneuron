const { migrateDeviceVault, openDeviceVault } = require('./vault-open.cjs');

function registerLocalAccess({ ipcMain, safeStorage, getWindow, origin, dataDirectory, token, nonce, warn }) {
  let pending = false;
  ipcMain.handle('localneuron:local-access', async (event, input) => {
    const action = typeof input === 'string' ? input : input?.action;
    const data = typeof input === 'object' && input ? input : {};
    const window = getWindow();
    if (!window || event.senderFrame !== window.webContents.mainFrame || new URL(event.senderFrame.url).origin !== origin) throw new Error('Origem recusada');
    if (action === 'suspend') return { ok: true };
    if (pending) throw new Error('Aguarde a operação atual.');
    pending = true;
    try {
      if (action === 'open') {
        const result = await openDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, warn });
        if (result.ok) return { ok: true };
        if (result.migration) return { migration: true };
        return { ok: false, error: result.error || 'Não foi possível abrir o cofre.' };
      }
      if (action === 'migrate') {
        if (typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 1024) throw new Error('Senha inválida.');
        await migrateDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, password: data.password, warn });
        return { ok: true };
      }
      throw new Error('Ação inválida');
    } finally { pending = false; }
  });
}

module.exports = { registerLocalAccess };
