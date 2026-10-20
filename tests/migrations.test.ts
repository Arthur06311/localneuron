import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Store } from '../src/store.js';
import { applyMigrations, futureSchemaMessage, migrations, type Migration } from '../src/migrations.js';

const legacySql = `CREATE TABLE workspace_state (id integer PRIMARY KEY CHECK (id = 1), document jsonb NOT NULL);
  CREATE TABLE event_log (seq bigint PRIMARY KEY, entry_hash text UNIQUE NOT NULL, document jsonb NOT NULL);
  CREATE OR REPLACE FUNCTION reject_log_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'event_log is append-only'; END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER immutable_event_log BEFORE UPDATE OR DELETE ON event_log FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();
  INSERT INTO workspace_state VALUES (1, '{"marker":"antigo"}');
  INSERT INTO event_log VALUES (1, 'hash-antigo', '{"seq":1}');`;

test('Base nova recebe as migrações em ordem e o registo da versão', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-new-'));
  const store = new Store(dir);
  try {
    await store.init();
    await store.init();
    const versions = await store.db.query<{ version: number; name: string }>('SELECT version, name FROM schema_migrations ORDER BY version');
    assert.deepEqual(versions.rows, [{ version: 1, name: 'esquema inicial' }, { version: 2, name: 'vínculo do espaço' }]);
    await store.db.query(`INSERT INTO event_log VALUES (1, 'hash-novo', '{"seq":1}')`);
    await assert.rejects(() => store.db.exec('DELETE FROM event_log WHERE seq = 1'), /append-only/);
    assert.equal((await store.db.query<{ n: number }>('SELECT count(*)::int AS n FROM event_log')).rows[0].n, 1);
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Base antiga sem tabela de versão fica na versão base e conserva os dados', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-old-'));
  const db = new PGlite(dir);
  await db.exec(legacySql);
  await db.close();
  const store = new Store(dir);
  try {
    let ran = false;
    const list: Migration[] = [{ version: 1, name: 'esquema inicial', up: async () => { ran = true; throw new Error('não devia correr'); } }];
    await applyMigrations(store.db, list);
    assert.equal(ran, false);
    const state = await store.db.query<{ document: { marker: string } }>('SELECT document FROM workspace_state WHERE id = 1');
    const log = await store.db.query<{ entry_hash: string }>('SELECT entry_hash FROM event_log');
    assert.equal(state.rows[0].document.marker, 'antigo');
    assert.deepEqual(log.rows.map(row => row.entry_hash), ['hash-antigo']);
    assert.deepEqual((await store.db.query('SELECT version FROM schema_migrations ORDER BY version')).rows, [{ version: 1 }]);
    await store.init();
    assert.equal((await store.db.query<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n, 2);
    assert.equal((await store.db.query<{ name: string | null }>(`SELECT to_regclass('public.space_binding') AS name`)).rows[0].name, 'space_binding');
    assert.equal((await store.db.query<{ document: { marker: string } }>('SELECT document FROM workspace_state')).rows[0].document.marker, 'antigo');
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Migração que falha desfaz a transação e conserva as anteriores', async () => {
  const db = new PGlite();
  try {
    const list: Migration[] = [
      { version: 1, name: 'ok', up: async tx => { await tx.exec('CREATE TABLE kept (id int); INSERT INTO kept VALUES (7);'); } },
      { version: 2, name: 'falha', up: async tx => { await tx.exec('CREATE TABLE doomed (id int); INSERT INTO doomed VALUES (1); INSERT INTO kept VALUES (8); SELECT 1/0;'); } },
    ];
    await assert.rejects(() => applyMigrations(db, list), /division by zero/);
    assert.deepEqual((await db.query('SELECT id FROM kept ORDER BY id')).rows, [{ id: 7 }]);
    assert.equal((await db.query<{ name: string | null }>(`SELECT to_regclass('public.doomed') AS name`)).rows[0].name, null);
    assert.deepEqual((await db.query('SELECT version FROM schema_migrations ORDER BY version')).rows, [{ version: 1 }]);
  } finally {
    await db.close();
  }
});

test('Versão futura do esquema recusa abrir e não altera a base', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE workspace_state (id integer PRIMARY KEY CHECK (id = 1), document jsonb NOT NULL);
      INSERT INTO workspace_state VALUES (1, '{"marker":"futuro"}');
      INSERT INTO schema_migrations (version, name) VALUES (99, 'futura');`);
    const known = migrations.at(-1)!.version;
    await assert.rejects(() => applyMigrations(db, migrations), new RegExp(futureSchemaMessage(99, known).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal((await db.query<{ document: { marker: string } }>('SELECT document FROM workspace_state')).rows[0].document.marker, 'futuro');
    assert.deepEqual((await db.query('SELECT version FROM schema_migrations')).rows, [{ version: 99 }]);
  } finally {
    await db.close();
  }
});

test('Lista fora de ordem e esquema incompleto são recusados sem gravar versão', async () => {
  const skipped = new PGlite();
  const partial = new PGlite();
  try {
    const list: Migration[] = [
      { version: 1, name: 'ok', up: async () => {} },
      { version: 3, name: 'salto', up: async () => { throw new Error('não devia correr'); } },
    ];
    await assert.rejects(() => applyMigrations(skipped, list), /fora da ordem/);
    assert.equal((await skipped.query<{ name: string | null }>(`SELECT to_regclass('public.schema_migrations') AS name`)).rows[0].name, null);
    await partial.exec('CREATE TABLE workspace_state (id integer PRIMARY KEY, document jsonb NOT NULL)');
    await assert.rejects(() => applyMigrations(partial), /incompleto/);
    assert.equal((await partial.query<{ name: string | null }>(`SELECT to_regclass('public.schema_migrations') AS name`)).rows[0].name, null);
    assert.equal((await partial.query<{ name: string | null }>(`SELECT to_regclass('public.event_log') AS name`)).rows[0].name, null);
  } finally {
    await skipped.close();
    await partial.close();
  }
});

test('Versão já registada recebe só a seguinte e a repetição não duplica linhas', async () => {
  const db = new PGlite();
  try {
    const list: Migration[] = [
      { version: 1, name: 'base', up: async tx => { await tx.exec('CREATE TABLE items (id integer PRIMARY KEY); INSERT INTO items VALUES (1);'); } },
      { version: 2, name: 'label', up: async tx => { await tx.exec(`ALTER TABLE items ADD COLUMN label text NOT NULL DEFAULT 'ok'; INSERT INTO items (id) VALUES (2);`); } },
    ];
    await applyMigrations(db, [list[0]]);
    await applyMigrations(db, list);
    await applyMigrations(db, list);
    assert.deepEqual((await db.query('SELECT id, label FROM items ORDER BY id')).rows, [{ id: 1, label: 'ok' }, { id: 2, label: 'ok' }]);
    assert.deepEqual((await db.query('SELECT version, name FROM schema_migrations ORDER BY version')).rows, [{ version: 1, name: 'base' }, { version: 2, name: 'label' }]);
  } finally {
    await db.close();
  }
});
