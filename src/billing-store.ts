import postgres from 'postgres';

export type DeviceRow = {
  id: string;
  secret: string;
  checkout: string | null;
  checkout_url: string | null;
  checkout_expires: number | null;
  checkout_attempt: string | null;
  checkout_plan: string | null;
  customer: string | null;
  subscription: string | null;
  trial_used: number;
};

const deviceColumns = ['checkout', 'checkout_url', 'checkout_expires', 'checkout_attempt', 'checkout_plan', 'customer', 'subscription', 'trial_used'] as const;

export interface BillingStore {
  getDevice(id: string): Promise<DeviceRow | undefined>;
  insertDevice(id: string, secret: string): Promise<void>;
  updateDevice(id: string, patch: Partial<DeviceRow>): Promise<void>;
  findDeviceBySubscription(subscription: string): Promise<DeviceRow | undefined>;
  markTrial(id: string): Promise<void>;
  claimCheckoutAttempt(id: string, attempt: string): Promise<string>;
  hasEvent(id: string): Promise<boolean>;
  saveEvent(id: string, processed: number): Promise<void>;
  purgeEvents(before: number): Promise<void>;
  rememberIdentity(hmac: string, subscription: string): Promise<string>;
  listIdentities(): Promise<{ hmac: string; subscription: string }[]>;
  close(): Promise<void>;
}

export class MemoryBillingStore implements BillingStore {
  readonly devices = new Map<string, DeviceRow>();
  readonly identities = new Map<string, string>();
  readonly events = new Map<string, number>();
  async getDevice(id: string) { const row = this.devices.get(id); return row ? { ...row } : undefined; }
  async insertDevice(id: string, secret: string) {
    if (this.devices.has(id)) return;
    this.devices.set(id, { id, secret, checkout: null, checkout_url: null, checkout_expires: null, checkout_attempt: null, checkout_plan: null, customer: null, subscription: null, trial_used: 0 });
  }
  async updateDevice(id: string, patch: Partial<DeviceRow>) {
    const row = this.devices.get(id); if (!row) return;
    for (const key of deviceColumns) if (key in patch) (row as any)[key] = patch[key];
  }
  async findDeviceBySubscription(subscription: string) {
    for (const row of this.devices.values()) if (row.subscription === subscription) return { ...row };
  }
  async markTrial(id: string) { const row = this.devices.get(id); if (row) row.trial_used = 1; }
  async claimCheckoutAttempt(id: string, attempt: string) {
    const row = this.devices.get(id); if (!row) throw Error('Instalação não encontrada.');
    if (!row.checkout_attempt) row.checkout_attempt = attempt;
    return row.checkout_attempt;
  }
  async hasEvent(id: string) { return this.events.has(id); }
  async saveEvent(id: string, processed: number) { if (!this.events.has(id)) this.events.set(id, processed); }
  async purgeEvents(before: number) { for (const [id, processed] of this.events) if (processed < before) this.events.delete(id); }
  async rememberIdentity(hmac: string, subscription: string) {
    const existing = this.identities.get(hmac);
    if (existing) return existing;
    this.identities.set(hmac, subscription);
    return subscription;
  }
  async listIdentities() { return [...this.identities].map(([hmac, subscription]) => ({ hmac, subscription })); }
  async close() {}
}

/** Supabase transaction pooler (port 6543) rejects prepared statements. */
export const supabasePoolOptions = Object.freeze({
  prepare: false as const,
  max: 1,
  ssl: 'require' as const,
  idle_timeout: 20,
  connect_timeout: 10,
});

export function assertTransactionPoolerUrl(databaseUrl: string) {
  let port = '';
  try { port = new URL(databaseUrl).port; } catch { port = ''; }
  if (port !== '6543') throw Error('DATABASE_URL precisa ser o pooler do Supabase em modo transação, porta 6543.');
}

function mapDevice(row: any): DeviceRow {
  return {
    id: String(row.id), secret: String(row.secret),
    checkout: row.checkout ?? null, checkout_url: row.checkout_url ?? null,
    checkout_expires: row.checkout_expires == null ? null : Number(row.checkout_expires),
    checkout_attempt: row.checkout_attempt ?? null, checkout_plan: row.checkout_plan ?? null,
    customer: row.customer ?? null, subscription: row.subscription ?? null,
    trial_used: Number(row.trial_used ?? 0),
  };
}

export function createPostgresStore(databaseUrl: string, connect: typeof postgres = postgres): BillingStore {
  assertTransactionPoolerUrl(databaseUrl);
  const sql = connect(databaseUrl, supabasePoolOptions);
  return {
    async getDevice(id) { const rows = await sql`select * from billing.devices where id = ${id} limit 1`; return rows[0] ? mapDevice(rows[0]) : undefined; },
    async insertDevice(id, secret) { await sql`insert into billing.devices (id, secret) values (${id}, ${secret}) on conflict (id) do nothing`; },
    async updateDevice(id, patch) {
      const keys = deviceColumns.filter(key => key in patch);
      if (!keys.length) return;
      const values: Record<string, string | number | null> = {};
      for (const key of keys) values[key] = (patch as any)[key] ?? null;
      await sql`update billing.devices set ${sql(values, ...keys)} where id = ${id}`;
    },
    async findDeviceBySubscription(subscription) { const rows = await sql`select * from billing.devices where subscription = ${subscription} limit 1`; return rows[0] ? mapDevice(rows[0]) : undefined; },
    async markTrial(id) { await sql`update billing.devices set trial_used = 1 where id = ${id}`; },
    async claimCheckoutAttempt(id, attempt) {
      const rows = await sql`update billing.devices set checkout_attempt = coalesce(checkout_attempt, ${attempt}) where id = ${id} returning checkout_attempt`;
      if (!rows[0]) throw Error('Instalação não encontrada.');
      return String(rows[0].checkout_attempt);
    },
    async hasEvent(id) { const rows = await sql`select id from billing.events where id = ${id} limit 1`; return rows.length > 0; },
    async saveEvent(id, processed) { await sql`insert into billing.events (id, processed) values (${id}, ${processed}) on conflict (id) do nothing`; },
    async purgeEvents(before) { await sql`delete from billing.events where processed < ${before}`; },
    async rememberIdentity(hmac, subscription) {
      const inserted = await sql`insert into billing.trial_identities (hmac, subscription) values (${hmac}, ${subscription}) on conflict (hmac) do nothing returning subscription`;
      if (inserted[0]) return String(inserted[0].subscription);
      const rows = await sql`select subscription from billing.trial_identities where hmac = ${hmac} limit 1`;
      return String(rows[0].subscription);
    },
    async listIdentities() { const rows = await sql`select hmac, subscription from billing.trial_identities`; return rows.map(row => ({ hmac: String(row.hmac), subscription: String(row.subscription) })); },
    async close() { await sql.end({ timeout: 5 }); },
  };
}
