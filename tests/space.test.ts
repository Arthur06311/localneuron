import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { unzipSync } from 'fflate';
import { Core } from '../src/core.js';
import { exportSpace, importSpace } from '../src/space-archive.js';
import { SPACE_MISMATCH } from '../src/space.js';
import { createApp } from '../src/server.js';

const password = 'senha-de-teste-espaco';
const root = process.cwd();

test('Exportar e importar o espaço preserva a base e o workspace sem segredos em claro', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'espaco-origem-'));
  const restored = mkdtempSync(join(tmpdir(), 'espaco-destino-'));
  const archive = join(tmpdir(), `espaco-${randomBytes(4).toString('hex')}.zip`);
  const core = new Core(dir, root);
  const token = `sessao-${randomBytes(16).toString('hex')}`;
  try {
    await core.init();
    await core.setup(password);
    const logId = (await core.snapshot()).log_id;
    const secret = core.vault.key('organization');
    mkdirSync(join(dir, 'pro'), { recursive: true, mode: 0o700 });
    writeFileSync(join(dir, 'pro', 'workspace.json'), JSON.stringify({ version: 1, marker: 'projeto-local' }), { mode: 0o600 });
    writeFileSync(join(dir, 'session.json'), JSON.stringify({ url: `http://127.0.0.1:4317/#session=${token}` }), { mode: 0o600 });
    writeFileSync(join(dir, 'runtime-key'), 'chave-em-texto-simples', { mode: 0o600 });
    const steps: string[] = [];
    const quiesce = core.store.quiesce.bind(core.store);
    core.store.quiesce = async () => { steps.push('db'); await quiesce(); };
    await exportSpace(core, archive, async () => { steps.push('engines'); assert.equal(steps.includes('db'), false); });
    assert.deepEqual(steps, ['engines', 'db']);
    const bytes = readFileSync(archive);
    const packed = unzipSync(new Uint8Array(bytes));
    assert.deepEqual(Object.keys(packed).sort(), ['manifest.json', 'pglite.tar', 'vault.enc.json', 'workspace/workspace.json']);
    const text = Buffer.from(bytes).toString('latin1');
    assert.equal(text.includes(secret), false);
    assert.equal(text.includes(password), false);
    assert.equal(text.includes(token), false);
    assert.equal(text.includes('chave-em-texto-simples'), false);
    await core.close();
    await importSpace(archive, restored);
    const copy = new Core(restored, root);
    try {
      await copy.init();
      await copy.unlock(password);
      assert.equal((await copy.snapshot()).log_id, logId);
      assert.equal(JSON.parse(readFileSync(join(restored, 'pro', 'workspace.json'), 'utf8')).marker, 'projeto-local');
      assert.equal(copy.vault.key('organization').includes('PRIVATE KEY'), true);
    } finally { await copy.close(); }
  } finally {
    await core.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    rmSync(restored, { recursive: true, force: true });
    rmSync(archive, { force: true });
  }
});

test('Abrir um espaço recusa cofre e base que não correspondem', async () => {
  const left = mkdtempSync(join(tmpdir(), 'espaco-a-'));
  const right = mkdtempSync(join(tmpdir(), 'espaco-b-'));
  const first = new Core(left, root);
  const second = new Core(right, root);
  try {
    await first.init(); await first.setup(password);
    await second.init(); await second.setup(password + '-outra');
    await first.close(); await second.close();
    copyFileSync(join(left, 'vault.enc.json'), join(right, 'vault.enc.json'));
    const opened = new Core(right, root);
    try { await assert.rejects(opened.init(), { message: SPACE_MISMATCH }); }
    finally { await opened.close(); }
  } finally {
    await first.close().catch(() => {});
    await second.close().catch(() => {});
    rmSync(left, { recursive: true, force: true });
    rmSync(right, { recursive: true, force: true });
  }
});

test('A rota de exportação devolve o arquivo e omite o token da sessão', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'espaco-rota-'));
  const core = new Core(dir, root);
  await core.init();
  await core.setup(password);
  writeFileSync(join(dir, 'session.json'), JSON.stringify({ url: 'http://127.0.0.1:4317/#session=token-da-rota-de-exportacao' }), { mode: 0o600 });
  const { app } = await createApp(core, 'token-da-rota-de-exportacao');
  try {
    const denied = await app.inject({ method: 'GET', url: '/v1/space/export', headers: { host: '127.0.0.1:4317' } });
    assert.equal(denied.statusCode, 401);
    const headers = { host: '127.0.0.1:4317', authorization: 'Bearer token-da-rota-de-exportacao' };
    const response = await app.inject({ method: 'GET', url: '/v1/space/export', headers });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/zip');
    assert.equal(response.body.includes('token-da-rota-de-exportacao'), false);
    assert.equal(response.body.includes(password), false);
    await app.inject({ method: 'GET', url: '/v1/space/export', headers });
    await app.inject({ method: 'GET', url: '/v1/space/export', headers });
    const fourth = await app.inject({ method: 'GET', url: '/v1/space/export', headers });
    assert.equal(fourth.statusCode, 200);
    const blocked = await app.inject({ method: 'GET', url: '/v1/space/export', headers });
    assert.equal(blocked.statusCode, 429);
    assert.match(blocked.body, /Aguarde antes de exportar o espaço novamente/);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
