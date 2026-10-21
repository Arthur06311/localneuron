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
    name: 'equipas sobre os bots existentes',
    async up(tx) {
      await tx.exec(`CREATE TABLE crew_providers (
          id text PRIMARY KEY,
          kind text NOT NULL CHECK (kind IN ('local','exo','openai','anthropic','xai')),
          label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
          endpoint text NOT NULL DEFAULT '',
          model text NOT NULL DEFAULT '',
          leaves_computer boolean NOT NULL DEFAULT false,
          trusted_network boolean NOT NULL DEFAULT false,
          acknowledged boolean NOT NULL DEFAULT false,
          confirm_remote boolean NOT NULL DEFAULT false,
          token_hint text NOT NULL DEFAULT '',
          enabled boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        INSERT INTO crew_providers (id, kind, label, enabled) VALUES ('local', 'local', 'Neste computador', true);
        CREATE TABLE crew_settings (
          id integer PRIMARY KEY CHECK (id = 1),
          max_rounds integer NOT NULL DEFAULT 4 CHECK (max_rounds BETWEEN 1 AND 8),
          max_tokens integer NOT NULL DEFAULT 4096 CHECK (max_tokens BETWEEN 256 AND 32768)
        );
        INSERT INTO crew_settings (id) VALUES (1);
        CREATE TABLE crew_members (
          bot_id text PRIMARY KEY,
          mascot text NOT NULL,
          coordinator boolean NOT NULL DEFAULT false,
          unread integer NOT NULL DEFAULT 0 CHECK (unread >= 0),
          provider_id text NOT NULL DEFAULT 'local' REFERENCES crew_providers (id),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX crew_one_coordinator ON crew_members (coordinator) WHERE coordinator;
        CREATE TABLE crew_messages (
          id text PRIMARY KEY,
          scope text NOT NULL CHECK (scope IN ('agent','team')),
          bot_id text REFERENCES crew_members (bot_id) ON DELETE CASCADE,
          author text NOT NULL CHECK (author IN ('user','agent','coordinator','system')),
          author_bot_id text,
          content text NOT NULL,
          tokens integer NOT NULL DEFAULT 0 CHECK (tokens >= 0 AND tokens <= 1000000),
          round integer NOT NULL DEFAULT 0 CHECK (round >= 0 AND round <= 100),
          created_at timestamptz NOT NULL DEFAULT now(),
          CHECK ((scope = 'team' AND bot_id IS NULL) OR (scope = 'agent' AND bot_id IS NOT NULL))
        );
        CREATE INDEX crew_messages_bot_idx ON crew_messages (bot_id, created_at);
        CREATE INDEX crew_messages_scope_idx ON crew_messages (scope, created_at);`);
    },
  },
  {
    version: 3,
    name: 'vínculo do espaço',
    async up(tx) {
      await tx.exec('CREATE TABLE IF NOT EXISTS space_binding (id integer PRIMARY KEY CHECK (id = 1), space_id text NOT NULL)');
    },
  },
  {
    version: 4,
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
  return `Não é possível abrir este espaço: o banco de dados está na versão ${found} do esquema, mais recente do que a versão ${known} conhecida por esta aplicação. Atualize a aplicação.`;
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
      throw new Error('Não é possível abrir este espaço: o esquema do banco de dados está incompleto.');
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
