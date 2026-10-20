import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Core } from '../src/core.js';
import { backupInstallation, restoreInstallation } from '../src/install-backup.js';
import { acquireProcessLock } from '../src/lock.js';
import { verifyPackage } from '../scripts/protocol.mjs';

const root = resolve('.');
const password = 'somente-testes-senha-forte';
const input = { title: 'Lançamento da coleção', brief: 'Vídeo de apresentação da coleção de camisas, com tom acolhedor e sem promessas não comprovadas.', requirements: ['Tom acolhedor'], duration_seconds: 60, workflow_id: 'content', mode: 'template' as const, model: '', budget_minor: 0 };

function sha(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('Backup restaura pasta, cofre e banco juntos e o espaço volta a ser utilizável', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'neuron-install-'));
  const dir = join(parent, 'instalacao');
  const backup = join(parent, 'backup');
  const restored = join(parent, 'restaurado');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let core = new Core(dir, root);
  try {
    await core.init();
    await core.setup(password);
    const created = await core.create(input, 'backup-create-001');
    writeFileSync(join(dir, 'marker.txt'), 'arquivo-do-espaco', { mode: 0o600 });
    const before = await core.snapshot();
    const vaultHash = sha(join(dir, 'vault.enc.json'));
    await core.close();
    writeFileSync(join(dir, 'server.lock'), '2147483646', { mode: 0o600 });
    backupInstallation(dir, backup);
    assert.equal(existsSync(join(backup, 'server.lock')), false);
    assert.equal(sha(join(backup, 'vault.enc.json')), vaultHash);
    assert.equal(readFileSync(join(backup, 'marker.txt'), 'utf8'), 'arquivo-do-espaco');
    assert.equal(readFileSync(join(backup, 'postgres', 'PG_VERSION'), 'utf8').trim().length > 0, true);
    rmSync(dir, { recursive: true, force: true });
    restoreInstallation(backup, restored);
    assert.equal(existsSync(join(restored, 'server.lock')), false);
    assert.equal(sha(join(restored, 'vault.enc.json')), vaultHash);
    assert.equal(readFileSync(join(restored, 'marker.txt'), 'utf8'), 'arquivo-do-espaco');
    core = new Core(restored, root);
    await core.init();
    await assert.rejects(core.unlock('senha-incorreta-demais'), /incorreta/);
    await core.unlock(password);
    const after = await core.snapshot();
    assert.equal(after.log_id, before.log_id);
    assert.equal(after.root_fingerprint, before.root_fingerprint);
    assert.equal(after.tasks.length, 1);
    assert.equal(after.tasks[0].id, created.id);
    assert.equal(after.tasks[0].title, input.title);
    assert.equal(verifyPackage(await core.export(), after.root_fingerprint).valid, true);
    const again = await core.create({ ...input, title: 'Continuação local' }, 'backup-create-002');
    assert.notEqual(again.id, created.id);
    assert.equal((await core.snapshot()).tasks.length, 2);
    await core.close();
    const reopened = new Core(restored, root);
    try {
      await reopened.init();
      await reopened.unlock(password);
      assert.equal((await reopened.snapshot()).tasks[0].title, 'Continuação local');
    } finally { await reopened.close(); }
  } finally { await core.close().catch(() => {}); rmSync(parent, { recursive: true, force: true }); }
});

test('Backup recusa pacote incompleto, espaço aberto e restauração por cima', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'neuron-install-guard-'));
  const dir = join(parent, 'instalacao');
  const backup = join(parent, 'backup');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const core = new Core(dir, root);
  try {
    await core.init();
    await core.setup(password);
    await core.close();
    const release = acquireProcessLock(dir);
    assert.throws(() => backupInstallation(dir, backup), /Feche o aplicativo/);
    release();
    writeFileSync(join(dir, 'server.lock'), 'trava-invalida', { mode: 0o600 });
    assert.throws(() => backupInstallation(dir, backup), /Trava de processo inválida/);
    rmSync(join(dir, 'server.lock'));
    backupInstallation(dir, backup);
    const vaultOnly = join(parent, 'so-cofre');
    mkdirSync(vaultOnly, { recursive: true });
    writeFileSync(join(vaultOnly, 'vault.enc.json'), readFileSync(join(backup, 'vault.enc.json')));
    assert.throws(() => restoreInstallation(vaultOnly, join(parent, 'destino-cofre')), /juntos/);
    const databaseOnly = join(parent, 'so-banco');
    mkdirSync(join(databaseOnly, 'postgres'), { recursive: true });
    assert.throws(() => backupInstallation(databaseOnly, join(parent, 'backup-banco')), /juntos/);
    assert.throws(() => restoreInstallation(backup, dir), /Não sobreponha/);
    assert.equal(readFileSync(join(dir, 'vault.enc.json'), 'utf8'), readFileSync(join(backup, 'vault.enc.json'), 'utf8'));
    mkdirSync(join(parent, 'ocupada'));
    writeFileSync(join(parent, 'ocupada', 'outro.txt'), 'preservar');
    assert.throws(() => restoreInstallation(backup, join(parent, 'ocupada')), /Não sobreponha/);
    assert.equal(readFileSync(join(parent, 'ocupada', 'outro.txt'), 'utf8'), 'preservar');
    const linked = join(parent, 'com-link');
    mkdirSync(join(linked, 'postgres'), { recursive: true });
    symlinkSync(join(dir, 'vault.enc.json'), join(linked, 'vault.enc.json'));
    assert.throws(() => backupInstallation(linked, join(parent, 'backup-link')), /link simbólico/);
    assert.equal(existsSync(join(parent, 'backup-link')), false);
  } finally { await core.close().catch(() => {}); rmSync(parent, { recursive: true, force: true }); }
});
