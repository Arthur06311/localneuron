const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createSecret, loadKey, removeKey, removeLegacyAccess, storeKey } = require('./vault-key.cjs');

async function request(origin, token, route, body, nonce) {
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  if (nonce) headers['x-localneuron-device'] = nonce;
  const response = await fetch(origin + '/v1/' + route, { method: 'POST', headers, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Não foi possível abrir o cofre.');
  return result;
}

async function openDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, warn = console.warn }) {
  const vaultFile = join(dataDirectory, 'vault.enc.json');
  let secret = null;
  try { secret = loadKey({ directory: dataDirectory, safeStorage }); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível ler a chave do cofre.' }; }
  if (!existsSync(vaultFile)) {
    let created = false;
    if (!secret) {
      secret = createSecret();
      storeKey({ directory: dataDirectory, secret, safeStorage, warn });
      created = true;
    }
    try { await request(origin, token, 'vault/device-open', { secret }, nonce); }
    catch (error) {
      if (created && !existsSync(vaultFile)) removeKey(dataDirectory);
      throw error;
    }
    return { ok: true };
  }
  if (secret) {
    await request(origin, token, 'vault/device-open', { secret }, nonce);
    removeLegacyAccess(dataDirectory);
    return { ok: true };
  }
  return freshDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, warn });
}

async function migrateDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, password, warn = console.warn }) {
  const secret = createSecret();
  const vaultFile = join(dataDirectory, 'vault.enc.json');
  const before = existsSync(vaultFile) ? readFileSync(vaultFile) : null;
  try { await request(origin, token, 'vault/device-migrate', { password, secret }, nonce); }
  catch (error) {
    if (before && existsSync(vaultFile) && !readFileSync(vaultFile).equals(before)) throw new Error('O cofre original foi alterado');
    throw error;
  }
  let stored = false;
  try {
    storeKey({ directory: dataDirectory, secret, safeStorage, warn });
    stored = true;
    await request(origin, token, 'vault/device-commit', {}, nonce);
    await request(origin, token, 'vault/device-open', { secret }, nonce);
    removeLegacyAccess(dataDirectory);
    return { ok: true };
  } catch (error) {
    if (!stored) await request(origin, token, 'vault/device-abort', {}, nonce).catch(() => {});
    throw error;
  }
}

async function freshDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, warn = console.warn }) {
  const vaultFile = join(dataDirectory, 'vault.enc.json');
  if (!existsSync(vaultFile)) throw new Error('Não há cofre antigo para guardar');
  if (loadKey({ directory: dataDirectory, safeStorage })) throw new Error('O cofre deste computador já tem chave.');
  const secret = createSecret();
  const before = readFileSync(vaultFile);
  storeKey({ directory: dataDirectory, secret, safeStorage, warn });
  try {
    await request(origin, token, 'vault/device-fresh', { secret }, nonce);
    return { ok: true };
  } catch (error) {
    const current = existsSync(vaultFile) ? readFileSync(vaultFile) : null;
    if (!current || current.equals(before)) removeKey(dataDirectory);
    throw error;
  }
}

async function importLegacyDeviceVault({ origin, token, dataDirectory, safeStorage, nonce, name, password }) {
  const secret = loadKey({ directory: dataDirectory, safeStorage });
  if (!secret) throw new Error('A chave deste computador não está disponível.');
  await request(origin, token, 'vault/device-import', { name, password, secret }, nonce);
  return { ok: true };
}

module.exports = { openDeviceVault, migrateDeviceVault, freshDeviceVault, importLegacyDeviceVault };
