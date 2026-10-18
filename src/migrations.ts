import type { PGlite } from '@electric-sql/pglite';

export type Migration = { version: number; name: string; sql: string };

export const schemaMigrations: Migration[] = [{
  version: 1,
  name: 'workspace-and-event-log',
  sql: `CREATE TABLE IF NOT EXISTS workspace_state (id integer PRIMARY KEY CHECK (id = 1), document jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS event_log (seq bigint PRIMARY KEY, entry_hash text UNIQUE NOT NULL, document jsonb NOT NULL);
      CREATE OR REPLACE FUNCTION reject_log_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'event_log is append-only'; END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS immutable_event_log ON event_log;
      CREATE TRIGGER immutable_event_log BEFORE UPDATE OR DELETE ON event_log FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();`,
}];

type Database = Pick<PGlite, 'exec' | 'query' | 'transaction'>;

function integer(value: unknown) {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(version)) throw new Error('O histórico de migração está inconsistente.');
  return version;
}

export async function applyMigrations(db: Database, migrations: Migration[]) {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1 || !migration.name || !migration.sql) throw new Error('As migrações precisam ser sequenciais a partir da versão 1.');
  });
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const existing = await db.query<{ version: number; name: string }>('SELECT version, name FROM schema_migrations ORDER BY version');
  existing.rows.forEach((row, index) => {
    const version = integer(row.version);
    if (version !== index + 1) throw new Error('O histórico de migração está inconsistente.');
    const defined = migrations[version - 1];
    if (!defined) throw new Error('Este espaço foi migrado por uma versão mais nova do aplicativo.');
    if (defined.name !== row.name) throw new Error('A migração aplicada não confere com esta versão do aplicativo.');
  });
  for (const migration of migrations.slice(existing.rows.length)) {
    await db.transaction(async tx => {
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
    });
  }
}
