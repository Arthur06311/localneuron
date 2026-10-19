import { PGlite } from '@electric-sql/pglite';
import type { State, Entry } from './types.js';
import { applyMigrations } from './migrations.js';

export class Store {
  db: PGlite;
  queue: Promise<unknown> = Promise.resolve();
  assertIntegrity: (state: State, entries: Entry[]) => void = () => {};
  sealState: (state: State, entries: Entry[]) => void = () => {};
  constructor(dir?: string) { this.db = new PGlite(dir); }
  async init() { await applyMigrations(this.db); }
  async read(): Promise<State | null> { await this.queue; const result = await this.db.query<{ document: State }>('SELECT document FROM workspace_state WHERE id = 1'); const state = result.rows[0]?.document ?? null; if (state) this.assertIntegrity(state, await this.entries()); return state; }
  async entries(): Promise<Entry[]> { const result = await this.db.query<{ document: Entry }>('SELECT document FROM event_log ORDER BY seq'); return result.rows.map(row => row.document); }
  async tx<T>(operation: (state: State | null, entries: Entry[]) => T): Promise<T> {
    const next = this.queue.then(() => this.db.transaction(async tx => {
      const records = await tx.query<{ document: State }>('SELECT document FROM workspace_state WHERE id = 1 FOR UPDATE');
      const logs = await tx.query<{ document: Entry }>('SELECT document FROM event_log ORDER BY seq');
      const state = records.rows[0]?.document ?? null;
      const entries = logs.rows.map(row => row.document);
      if (state) this.assertIntegrity(state, entries);
      const length = entries.length;
      const result = operation(state, entries);
      // No asynchronous effects are allowed while this transaction is open.
      if (result instanceof Promise) throw new Error('Operação assíncrona proibida na transação');
      if (state) { this.sealState(state, entries); await tx.query('UPDATE workspace_state SET document = $1 WHERE id = 1', [JSON.stringify(state)]); }
      for (const entry of entries.slice(length)) await tx.query('INSERT INTO event_log VALUES ($1, $2, $3)', [entry.seq, entry.entry_hash, JSON.stringify(entry)]);
      return result;
    }));
    this.queue = next.catch(() => {}); return next;
  }
  async bootstrap(state: State) { this.sealState(state, []); await this.db.query('INSERT INTO workspace_state VALUES (1, $1)', [JSON.stringify(state)]); }
  async close() { await this.queue; await this.db.close(); }
}
