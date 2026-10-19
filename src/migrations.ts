export type SqlClient = {
  exec(query: string): Promise<unknown>;
  query<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export type Sql = SqlClient & {
  transaction<T>(callback: (tx: SqlClient) => Promise<T>): Promise<T>;
};

export type Migration = {
  version: number;
  name: string;
  up: (tx: SqlClient) => Promise<void>;
};

const VERSION_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'esquema inicial',
    async up(tx) {
      await tx.exec(`CREATE TABLE IF NOT EXISTS workspace_state (id integer PRIMARY KEY CHECK (id = 1), document jsonb NOT NULL);
        CREATE TABLE IF NOT EXISTS event_log (seq bigint PRIMARY KEY, entry_hash text UNIQUE NOT NULL, document jsonb NOT NULL);
        CREATE OR REPLACE FUNCTION reject_log_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'event_log is append-only'; END; $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS immutable_event_log ON event_log;
        CREATE TRIGGER immutable_event_log BEFORE UPDATE OR DELETE ON event_log FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();`);
    },
  },
  {
    version: 2,
    name: 'trechos locais dos anexos',
    async up(tx) {
      await tx.exec(`CREATE TABLE IF NOT EXISTS attachment_chunks (
        id text PRIMARY KEY,
        chat_id text NOT NULL,
        attachment_id text NOT NULL,
        name text NOT NULL,
        location text NOT NULL,
        chunk_index integer NOT NULL,
        text text NOT NULL,
        embedding jsonb
      )`);
    },
  },
];

export function futureSchemaMessage(found: number, known: number) {
  return `Não é possível abrir este espaço: a base de dados está na versão ${found} do esquema, mais recente do que a versão ${known} conhecida por esta aplicação. Atualize a aplicação.`;
}

function assertOrdered(list: Migration[]) {
  list.forEach((migration, index) => {
    if (!Number.isInteger(migration.version) || migration.version !== index + 1) throw new Error(`A migração ${migration.version} está fora da ordem esperada ${index + 1}.`);
  });
}

async function relations(db: Sql) {
  const result = await db.query<{ relname: string }>(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`);
  return new Set(result.rows.map(row => row.relname));
}

async function appliedVersions(db: Sql) {
  const result = await db.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  return result.rows.map(row => Number(row.version));
}

export async function applyMigrations(db: Sql, list: Migration[] = migrations) {
  assertOrdered(list);
  const known = list.at(-1)?.version ?? 0;
  const tables = await relations(db);
  const legacy = tables.has('workspace_state') && tables.has('event_log');
  if (!tables.has('schema_migrations')) {
    if (legacy) {
      await db.transaction(async tx => {
        await tx.exec(VERSION_TABLE);
        await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [1, list[0].name]);
      });
    } else if (tables.has('workspace_state') || tables.has('event_log')) {
      throw new Error('Não é possível abrir este espaço: o esquema da base de dados está incompleto.');
    } else {
      await db.exec(VERSION_TABLE);
    }
  }
  const applied = new Set(await appliedVersions(db));
  const newest = applied.size ? Math.max(...applied) : 0;
  if (newest > known) throw new Error(futureSchemaMessage(newest, known));
  for (const migration of list) {
    if (applied.has(migration.version)) continue;
    await db.transaction(async tx => {
      await migration.up(tx);
      await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
    });
    applied.add(migration.version);
  }
}
