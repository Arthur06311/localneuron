const { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');

const KEY_NAME = 'vault-device-key.bin';
const META_NAME = 'vault-device-key.json';
const FALLBACK_WARNING = 'A chave do cofre ficou em um arquivo só deste usuário porque o armazenamento seguro do sistema não está disponível.';

function encryptionAvailable(safeStorage) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function' || !safeStorage.isEncryptionAvailable()) return false;
  if (process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function' && safeStorage.getSelectedStorageBackend() === 'basic_text') return false;
  return typeof safeStorage.encryptString === 'function' && typeof safeStorage.decryptString === 'function';
}

function paths(directory) {
  return { key: join(directory, KEY_NAME), meta: join(directory, META_NAME) };
}

function readMeta(directory) {
  const { meta } = paths(directory);
  if (!existsSync(meta)) return null;
  try {
    const value = JSON.parse(readFileSync(meta, 'utf8'));
    if (value && (value.mode === 'safe' || value.mode === 'fallback')) return value;
  } catch { /* metadado ilegível não conta como chave */ }
  return null;
}

function hasKey(directory) {
  return existsSync(paths(directory).key) && readMeta(directory) !== null;
}

function createSecret() {
  return randomBytes(32).toString('base64url');
}

function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, file);
  try { chmodSync(file, 0o600); } catch { /* no Windows o modo Unix pode não se aplicar */ }
}

function storeKey({ directory, secret, safeStorage, warn = console.warn }) {
  if (typeof secret !== 'string' || secret.length < 12 || secret.length > 1024) throw new Error('Chave do dispositivo inválida');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const mode = encryptionAvailable(safeStorage) ? 'safe' : 'fallback';
  const payload = mode === 'safe' ? safeStorage.encryptString(secret) : secret;
  if (mode === 'fallback') warn(FALLBACK_WARNING);
  const files = paths(directory);
  writeAtomic(files.key, payload);
  writeAtomic(files.meta, JSON.stringify({ mode }));
  return mode;
}

function loadKey({ directory, safeStorage }) {
  if (!hasKey(directory)) return null;
  const meta = readMeta(directory);
  const file = paths(directory).key;
  if (meta.mode === 'safe') {
    if (!encryptionAvailable(safeStorage)) throw new Error('O armazenamento seguro do sistema não está disponível para ler a chave do cofre.');
    const secret = safeStorage.decryptString(readFileSync(file));
    if (typeof secret !== 'string' || secret.length < 12) throw new Error('Chave do dispositivo inválida');
    return secret;
  }
  const secret = readFileSync(file, 'utf8');
  if (secret.length < 12) throw new Error('Chave do dispositivo inválida');
  return secret;
}

function removeKey(directory) {
  for (const name of [KEY_NAME, META_NAME]) {
    rmSync(join(directory, name), { force: true });
    rmSync(join(directory, name + '.tmp'), { force: true });
  }
}

function removeLegacyAccess(directory) {
  for (const name of ['device-access.bin', 'device-access-settings.json']) {
    rmSync(join(directory, name), { force: true });
    rmSync(join(directory, name + '.tmp'), { force: true });
  }
}

module.exports = { KEY_NAME, META_NAME, FALLBACK_WARNING, encryptionAvailable, hasKey, createSecret, storeKey, loadKey, removeKey, removeLegacyAccess };
