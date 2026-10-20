import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { FALLBACK_WARNING, createSecret, loadKey, storeKey } = createRequire(import.meta.url)('../desktop/vault-key.cjs');

function simulatedElectron() {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString(value) { return Buffer.from('sealed:' + Buffer.from(value).toString('hex')); },
    decryptString(value) { return Buffer.from(String(value).slice('sealed:'.length), 'hex').toString(); },
  };
}

test('Electron simulado guarda a chave cifrada e não a escreve em claro', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-key-safe-'));
  const warnings = [];
  try {
    const secret = createSecret();
    const safeStorage = simulatedElectron();
    assert.equal(storeKey({ directory: dir, secret, safeStorage, warn: message => warnings.push(message) }), 'safe');
    const stored = readFileSync(join(dir, 'vault-device-key.bin'));
    assert.equal(stored.includes(Buffer.from(secret)), false);
    assert.equal(stored.toString('utf8').includes(secret), false);
    assert.equal(readFileSync(join(dir, 'vault-device-key.json'), 'utf8').includes(secret), false);
    assert.equal(loadKey({ directory: dir, safeStorage }), secret);
    assert.deepEqual(warnings, []);
    if (process.platform !== 'win32') assert.equal(statSync(join(dir, 'vault-device-key.bin')).mode & 0o777, 0o600);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('sem armazenamento seguro a chave fica em arquivo 0600 e o aviso não revela o segredo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-key-file-'));
  const warnings = [];
  try {
    const secret = createSecret();
    const safeStorage = { isEncryptionAvailable: () => false, encryptString() { throw new Error('não devia cifrar'); }, decryptString() { throw new Error('não devia ler'); } };
    assert.equal(storeKey({ directory: dir, secret, safeStorage, warn: message => warnings.push(message) }), 'fallback');
    assert.deepEqual(warnings, [FALLBACK_WARNING]);
    assert.equal(FALLBACK_WARNING.includes(secret), false);
    const file = join(dir, 'vault-device-key.bin');
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(loadKey({ directory: dir, safeStorage: null }), secret);
    assert.equal(loadKey({ directory: dir, safeStorage }), secret);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Linux sem keyring não trata basic_text como cofre seguro', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-key-linux-'));
  const warnings = [];
  try {
    const secret = createSecret();
    const safeStorage = {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'basic_text',
      encryptString(value) { return Buffer.from('sealed:' + Buffer.from(value).toString('hex')); },
      decryptString(value) { return Buffer.from(String(value).slice('sealed:'.length), 'hex').toString(); },
    };
    const mode = storeKey({ directory: dir, secret, safeStorage, warn: message => warnings.push(message) });
    if (process.platform === 'linux') {
      assert.equal(mode, 'fallback');
      assert.equal(warnings[0], FALLBACK_WARNING);
      assert.equal(warnings[0].includes(secret), false);
      assert.equal(loadKey({ directory: dir, safeStorage: null }), secret);
    } else {
      assert.equal(mode, 'safe');
      assert.equal(readFileSync(join(dir, 'vault-device-key.bin')).includes(Buffer.from(secret)), false);
      assert.equal(loadKey({ directory: dir, safeStorage }), secret);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
