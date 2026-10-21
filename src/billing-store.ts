import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import postgres from 'postgres';
import { supabaseRootCa } from './billing-ca.ts';
type Env = Record<string, string | undefined>;

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
  rememberIdentity(hmac: string, subscription: string, created: number): Promise<string>;
  purgeIdentities(before: number): Promise<void>;
  listIdentities(): Promise<{ hmac: string; subscription: string }[]>;
  bumpRate(ipHash: string, route: string, windowStart: number): Promise<number>;
  purgeRateWindows(before: number): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export class MemoryBillingStore implements BillingStore {
  readonly devices = new Map<string, DeviceRow>();
  readonly identities = new Map<string, string>();
  readonly identityCreated = new Map<string, number>();
  readonly events = new Map<string, number>();
  readonly rates = new Map<string, { hits: number }>();
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
  async rememberIdentity(hmac: string, subscription: string, created: number) {
    const existing = this.identities.get(hmac);
    if (existing) return existing;
    this.identities.set(hmac, subscription);
    this.identityCreated.set(hmac, created);
    return subscription;
  }
  async purgeIdentities(before: number) {
    for (const [hmac, created] of this.identityCreated) if (created < before) { this.identityCreated.delete(hmac); this.identities.delete(hmac); }
  }
  async listIdentities() { return [...this.identities].map(([hmac, subscription]) => ({ hmac, subscription })); }
  async bumpRate(ipHash: string, route: string, windowStart: number) {
    const key = ipHash + '\0' + route + '\0' + windowStart;
    const row = this.rates.get(key) ?? { hits: 0 };
    row.hits += 1;
    this.rates.set(key, row);
    return row.hits;
  }
  async purgeRateWindows(before: number) {
    for (const key of this.rates.keys()) {
      const windowStart = Number(key.split('\0')[2]);
      if (windowStart < before) this.rates.delete(key);
    }
  }
  async ping() {}
  async close() {}
}

/** Certificado público, ou o PEM/caminho em LOCALNEURON_BILLING_DB_CA. verify-full exige o CA e o nome do host. */
export function billingDbCa(env: Env = process.env): string {
  const raw = env.LOCALNEURON_BILLING_DB_CA;
  if (typeof raw !== 'string' || !raw.trim()) return supabaseRootCa;
  const text = raw.replace(/\\n/g, '\n');
  if (text.includes('-----BEGIN CERTIFICATE-----')) return text;
  const path = text.trim();
  if (existsSync(path)) return readFileSync(path, 'utf8');
  throw Error('LOCALNEURON_BILLING_DB_CA precisa ser um PEM ou o caminho do certificado.');
}

export function supabasePoolOptions(env: Env = process.env) {
  return Object.freeze({
    prepare: false as const,
    max: 1,
    ssl: Object.freeze({ rejectUnauthorized: true as const, ca: billingDbCa(env) }),
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function assertTransactionPoolerUrl(databaseUrl: string) {
  let port = '';
  try { port = new URL(databaseUrl).port; } catch { port = ''; }
  if (port !== '6543') throw Error('DATABASE_URL precisa ser o pooler do Supabase em modo transação, porta 6543.');
}

export function assertSaoPauloHost(databaseUrl: string) {
  let host = '';
  try { host = new URL(databaseUrl).hostname; } catch { host = ''; }
  if (!host.includes('sa-east-1')) throw Error('DATABASE_URL precisa ser o pooler do projeto em sa-east-1 (São Paulo).');
}

export function assertBillingRole(databaseUrl: string) {
  let user = '';
  try { user = decodeURIComponent(new URL(databaseUrl).username); } catch { user = ''; }
  if (!user.startsWith('billing_app')) throw Error('DATABASE_URL precisa usar o papel billing_app.');
}

export function assertConnectedRole(row: { session_user?: unknown; current_user?: unknown; rolsuper?: unknown; rolbypassrls?: unknown } | undefined) {
  if (!row || row.session_user !== 'billing_app' || row.current_user !== 'billing_app' || row.rolsuper !== false || row.rolbypassrls !== false) {
    throw Error('A conexão precisa ser o papel billing_app, sem superuser e sem bypassrls.');
  }
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

export function createPostgresStore(databaseUrl: string, connect?: typeof postgres, env: Env = process.env): BillingStore {
  assertTransactionPoolerUrl(databaseUrl);
  assertSaoPauloHost(databaseUrl);
  assertBillingRole(databaseUrl);
  const sql = (connect ?? postgres)(databaseUrl, supabasePoolOptions(env));
  let roleOk: Promise<void> | null = null;
  function ensureRole() {
    if (roleOk) return roleOk;
    roleOk = (async () => {
      try {
        const rows = await sql`select session_user as session_user, current_user as current_user, rolsuper, rolbypassrls from pg_catalog.pg_roles where rolname = session_user`;
        assertConnectedRole(rows[0]);
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'A conexão precisa ser o papel billing_app, sem superuser e sem bypassrls.') roleOk = null;
        throw err;
      }
    })();
    return roleOk;
  }
  return {
    async getDevice(id) { await ensureRole(); const rows = await sql`select * from billing.devices where id = ${id} limit 1`; return rows[0] ? mapDevice(rows[0]) : undefined; },
    async insertDevice(id, secret) { await ensureRole(); await sql`insert into billing.devices (id, secret) values (${id}, ${secret}) on conflict (id) do nothing`; },
    async updateDevice(id, patch) { await ensureRole();
      const keys = deviceColumns.filter(key => key in patch);
      if (!keys.length) return;
      const values: Record<string, string | number | null> = {};
      for (const key of keys) values[key] = (patch as any)[key] ?? null;
      await sql`update billing.devices set ${sql(values, ...keys)} where id = ${id}`;
    },
    async findDeviceBySubscription(subscription) { await ensureRole(); const rows = await sql`select * from billing.devices where subscription = ${subscription} limit 1`; return rows[0] ? mapDevice(rows[0]) : undefined; },
    async markTrial(id) { await ensureRole(); await sql`update billing.devices set trial_used = 1 where id = ${id}`; },
    async claimCheckoutAttempt(id, attempt) { await ensureRole();
      const rows = await sql`update billing.devices set checkout_attempt = coalesce(checkout_attempt, ${attempt}) where id = ${id} returning checkout_attempt`;
      if (!rows[0]) throw Error('Instalação não encontrada.');
      return String(rows[0].checkout_attempt);
    },
    async hasEvent(id) { await ensureRole(); const rows = await sql`select id from billing.events where id = ${id} limit 1`; return rows.length > 0; },
    async saveEvent(id, processed) { await ensureRole(); await sql`insert into billing.events (id, processed) values (${id}, ${processed}) on conflict (id) do nothing`; },
    async purgeEvents(before) { await ensureRole(); await sql`delete from billing.events where processed < ${before}`; },
    async rememberIdentity(hmac, subscription, created) { await ensureRole();
      const inserted = await sql`insert into billing.trial_identities (hmac, subscription, created) values (${hmac}, ${subscription}, ${created}) on conflict (hmac) do nothing returning subscription`;
      if (inserted[0]) return String(inserted[0].subscription);
      const rows = await sql`select subscription from billing.trial_identities where hmac = ${hmac} limit 1`;
      return String(rows[0].subscription);
    },
    async purgeIdentities(before) { await ensureRole(); await sql`delete from billing.trial_identities where created < ${before}`; },
    async listIdentities() { await ensureRole(); const rows = await sql`select hmac, subscription from billing.trial_identities`; return rows.map(row => ({ hmac: String(row.hmac), subscription: String(row.subscription) })); },
    async bumpRate(ipHash, route, windowStart) { await ensureRole();
      const rows = await sql`insert into billing.rate_windows (ip_hash, route, window_start, hits) values (${ipHash}, ${route}, ${windowStart}, 1) on conflict (ip_hash, route, window_start) do update set hits = billing.rate_windows.hits + 1 returning hits`;
      return Number(rows[0].hits);
    },
    async purgeRateWindows(before) { await ensureRole(); await sql`delete from billing.rate_windows where window_start < ${before}`; },
    async ping() { await ensureRole(); await sql`select 1`; },
    async close() { await sql.end({ timeout: 5 }); },
  };
}
