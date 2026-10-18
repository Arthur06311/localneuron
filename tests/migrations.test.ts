import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { applyMigrations, schemaMigrations, type Migration } from '../src/migrations.js';

async function versions(store: Store) {
  const result = await store.db.query<{ version: number; name: string }>('SELECT version, name FROM schema_migrations ORDER BY version');
  return result.rows.map(row => ({ version: Number(row.version), name: row.name }));
}

test('Banco vazio recebe a migração atual e repetir a inicialização não altera o histórico', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-migrate-empty-'));
  const store = new Store(dir);
  try {
    await store.init();
    assert.deepEqual(await versions(store), [{ version: 1, name: 'workspace-and-event-log' }]);
    await store.db.query(`INSERT INTO workspace_state VALUES (1, $1::jsonb)`, [JSON.stringify({ marker: 'vazio' })]);
    await store.init();
    assert.deepEqual(await versions(store), [{ version: 1, name: 'workspace-and-event-log' }]);
    const document = await store.db.query<{ document: { marker: string } }>('SELECT document FROM workspace_state WHERE id = 1');
    assert.equal(document.rows[0].document.marker, 'vazio');
    await store.db.query('INSERT INTO event_log VALUES (1, $1, $2::jsonb)', ['a'.repeat(64), JSON.stringify({ seq: 1 })]);
    await assert.rejects(store.db.exec('DELETE FROM event_log WHERE seq = 1'), /append-only/);
  } finally { await store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('Instalação anterior sem histórico conserva o documento ao entrar na versão 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-migrate-legacy-'));
  const store = new Store(dir);
  try {
    await store.db.exec(schemaMigrations[0].sql);
    await store.db.query('INSERT INTO workspace_state VALUES (1, $1::jsonb)', [JSON.stringify({ marker: 'anterior' })]);
    await assert.rejects(store.db.query('SELECT version FROM schema_migrations'), /schema_migrations/);
    await store.init();
    const document = await store.db.query<{ document: { marker: string } }>('SELECT document FROM workspace_state WHERE id = 1');
    assert.equal(document.rows[0].document.marker, 'anterior');
    assert.deepEqual(await versions(store), [{ version: 1, name: 'workspace-and-event-log' }]);
    await store.init();
    assert.equal((await versions(store)).length, 1);
  } finally { await store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('Versão antiga avança uma vez; falha não grava versão nem deixa efeito parcial', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-migrate-upgrade-'));
  const store = new Store(dir);
  const base: Migration = { version: 1, name: 'base', sql: 'CREATE TABLE items (id integer PRIMARY KEY); INSERT INTO items VALUES (1);' };
  const label: Migration = { version: 2, name: 'label', sql: `ALTER TABLE items ADD COLUMN label text NOT NULL DEFAULT 'ok';` };
  const broken: Migration = { version: 2, name: 'broken', sql: 'CREATE TABLE extra (id integer PRIMARY KEY); INSERT INTO extra VALUES (1), (1);' };
  try {
    await applyMigrations(store.db, [base]);
    assert.deepEqual(await versions(store), [{ version: 1, name: 'base' }]);
    await assert.rejects(applyMigrations(store.db, [base, broken]));
    assert.deepEqual(await versions(store), [{ version: 1, name: 'base' }]);
    await assert.rejects(store.db.query('SELECT * FROM extra'), /extra/);
    const count = await store.db.query<{ n: number }>('SELECT count(*)::int AS n FROM items');
    assert.equal(Number(count.rows[0].n), 1);
    await applyMigrations(store.db, [base, label]);
    await applyMigrations(store.db, [base, label]);
    const row = await store.db.query<{ id: number; label: string }>('SELECT id, label FROM items');
    assert.equal(row.rows.length, 1);
    assert.equal(Number(row.rows[0].id), 1);
    assert.equal(row.rows[0].label, 'ok');
    assert.deepEqual(await versions(store), [{ version: 1, name: 'base' }, { version: 2, name: 'label' }]);
    await assert.rejects(applyMigrations(store.db, [{ version: 1, name: 'outro', sql: 'SELECT 1' }]), /não confere/);
    await assert.rejects(applyMigrations(store.db, [base]), /versão mais nova/);
    await assert.rejects(applyMigrations(store.db, [base, { version: 3, name: 'salto', sql: 'SELECT 1' }]), /sequenciais/);
    assert.deepEqual(await versions(store), [{ version: 1, name: 'base' }, { version: 2, name: 'label' }]);
  } finally { await store.close(); rmSync(dir, { recursive: true, force: true }); }
});
