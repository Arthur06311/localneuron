import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { registerLocalAccess } = createRequire(import.meta.url)('../desktop/local-access.cjs');

function simulatedElectron() {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString(value) { return Buffer.from('sealed:' + Buffer.from(value).toString('hex')); },
    decryptString(value) { return Buffer.from(String(value).slice('sealed:'.length), 'hex').toString(); },
  };
}

function register(dir, fetchImpl) {
  let handler;
  const frame = { url: 'http://127.0.0.1:4318/' };
  const window = { webContents: { mainFrame: frame } };
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  registerLocalAccess({
    ipcMain: { handle(_name, fn) { handler = fn; } },
    safeStorage: simulatedElectron(),
    getWindow: () => window,
    origin: 'http://127.0.0.1:4318',
    dataDirectory: dir,
    token: 'fixture',
    nonce: 'nonce-teste',
    warn() {},
  });
  return {
    handler,
    event: { senderFrame: frame },
    restore() { globalThis.fetch = original; },
  };
}

test('abertura pelo sistema não revela a chave ao renderer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-open-'));
  let secret = '';
  const harness = register(dir, async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(url.endsWith('/v1/vault/device-open'), true);
    secret = body.secret;
    return Response.json({ ok: true });
  });
  try {
    await assert.rejects(harness.handler({ senderFrame: { url: 'http://evil.example/' } }, 'open'), /Origem/);
    const result = await harness.handler(harness.event, 'open');
    assert.deepEqual(result, { ok: true });
    assert.equal(secret.length >= 12, true);
    assert.equal(JSON.stringify(result).includes(secret), false);
    const stored = readFileSync(join(dir, 'vault-device-key.bin'));
    assert.equal(stored.includes(Buffer.from(secret)), false);
    assert.equal(existsSync(join(dir, 'vault.enc.json')), false);
  } finally { harness.restore(); rmSync(dir, { recursive: true, force: true }); }
});

test('cofre antigo pede migração e senha errada não substitui o arquivo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-migrate-'));
  const vault = join(dir, 'vault.enc.json');
  writeFileSync(vault, 'cofre-original');
  writeFileSync(join(dir, 'device-access.bin'), 'senha-antiga-cifrada');
  let calls = 0;
  const harness = register(dir, async (url) => {
    calls += 1;
    assert.equal(String(url).endsWith('/v1/vault/device-migrate'), true);
    return Response.json({ error: 'Senha incorreta ou cofre danificado' }, { status: 400 });
  });
  try {
    const pending = await harness.handler(harness.event, 'open');
    assert.deepEqual(pending, { migration: true });
    assert.equal(calls, 0);
    await assert.rejects(harness.handler(harness.event, { action: 'migrate', password: 'senha-errada' }), /incorreta/);
    assert.equal(readFileSync(vault, 'utf8'), 'cofre-original');
    assert.equal(existsSync(vault + '.next'), false);
    assert.equal(existsSync(join(dir, 'vault-device-key.bin')), false);
    assert.equal(existsSync(join(dir, 'device-access.bin')), true);
  } finally { harness.restore(); rmSync(dir, { recursive: true, force: true }); }
});

test('migração bem sucedida apaga o material antigo e não devolve a chave', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-migrate-ok-'));
  const vault = join(dir, 'vault.enc.json');
  writeFileSync(vault, 'cofre-original');
  writeFileSync(join(dir, 'device-access.bin'), 'senha-antiga-cifrada');
  writeFileSync(join(dir, 'device-access-settings.json'), '{"automatic":true}');
  let secret = '';
  const harness = register(dir, async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    if (String(url).endsWith('/v1/vault/device-migrate')) {
      secret = body.secret;
      assert.equal(body.password, 'senha-antiga');
      return Response.json({ prepared: true });
    }
    if (String(url).endsWith('/v1/vault/device-commit')) {
      writeFileSync(vault, 'cofre-novo');
      return Response.json({ ok: true });
    }
    if (String(url).endsWith('/v1/vault/device-open')) {
      assert.equal(body.secret, secret);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'rota inesperada' }, { status: 500 });
  });
  try {
    const result = await harness.handler(harness.event, { action: 'migrate', password: 'senha-antiga' });
    assert.deepEqual(result, { ok: true });
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes('senha-antiga'), false);
    const stored = readFileSync(join(dir, 'vault-device-key.bin'));
    assert.equal(stored.includes(Buffer.from(secret)), false);
    assert.equal(readFileSync(vault, 'utf8'), 'cofre-novo');
    assert.equal(existsSync(join(dir, 'device-access.bin')), false);
    assert.equal(existsSync(join(dir, 'device-access-settings.json')), false);
  } finally { harness.restore(); rmSync(dir, { recursive: true, force: true }); }
});

test('começar sem o cofre antigo não devolve a chave e preserva o arquivo se a troca falhar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-fresh-'));
  const vault = join(dir, 'vault.enc.json');
  writeFileSync(vault, 'cofre-original');
  let secret = '';
  const harness = register(dir, async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(String(url).endsWith('/v1/vault/device-fresh'), true);
    secret = body.secret;
    return Response.json({ error: 'Não foi possível guardar a cópia' }, { status: 400 });
  });
  try {
    await assert.rejects(harness.handler(harness.event, { action: 'fresh' }), /cópia/);
    assert.equal(readFileSync(vault, 'utf8'), 'cofre-original');
    assert.equal(existsSync(join(dir, 'vault-device-key.bin')), false);
    assert.equal(JSON.stringify({}).includes(secret), false);
  } finally { harness.restore(); rmSync(dir, { recursive: true, force: true }); }
});

test('começar sem o cofre antigo grava a chave cifrada e não a devolve', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-fresh-ok-'));
  const vault = join(dir, 'vault.enc.json');
  writeFileSync(vault, 'cofre-original');
  writeFileSync(join(dir, 'device-access.bin'), 'senha-antiga-cifrada');
  let secret = '';
  const harness = register(dir, async (url, options) => {
    const body = JSON.parse(options.body);
    secret = body.secret;
    writeFileSync(vault, 'cofre-novo');
    assert.equal(String(url).endsWith('/v1/vault/device-fresh'), true);
    return Response.json({ ok: true });
  });
  try {
    const result = await harness.handler(harness.event, { action: 'fresh' });
    assert.deepEqual(result, { ok: true });
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(readFileSync(vault, 'utf8'), 'cofre-novo');
    const stored = readFileSync(join(dir, 'vault-device-key.bin'));
    assert.equal(stored.includes(Buffer.from(secret)), false);
    assert.equal(readFileSync(join(dir, 'device-access.bin'), 'utf8'), 'senha-antiga-cifrada');
  } finally { harness.restore(); rmSync(dir, { recursive: true, force: true }); }
});
