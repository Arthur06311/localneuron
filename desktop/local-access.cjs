const { freshDeviceVault, importLegacyDeviceVault, migrateDeviceVault, openDeviceVault } = require('./vault-open.cjs');

function registerLocalAccess({ ipcMain, safeStorage, getWindow, origin, dataDirectory, token, nonce, warn }) {
  let pending = false;
  ipcMain.handle('localneuron:local-access', async (event, input) => {
    if (input !== undefined && typeof input !== 'string' && (input === null || typeof input !== 'object' || Array.isArray(input) || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null))) throw new Error('Pedido inválido.');
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
        return { ok: false, error: result.error || 'Não foi possível abrir o cofre.' };
      }
      if (action === 'migrate') {
        if (typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 1024) throw new Error('Senha inválida.');
        await migrateDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, password: data.password, warn });
        return { ok: true };
      }
      if (action === 'fresh') {
        await freshDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, warn });
        return { ok: true };
      }
      if (action === 'import-legacy') {
        if (typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 1024) throw new Error('Senha inválida.');
        if (typeof data.name !== 'string' || !/^vault\.enc\.json\.legacy-\d{8}T\d{9}Z-[0-9a-f]{4}$/.test(data.name)) throw new Error('Cópia inválida.');
        await importLegacyDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, name: data.name, password: data.password });
        return { ok: true };
      }
      throw new Error('Ação inválida');
    } finally { pending = false; }
  });
}

module.exports = { registerLocalAccess };
