-- Cobrança do LocalNeuron. Rode com supabase db push, como dono do banco.
-- O aplicativo usa o schema billing. Ele não fica na Data API.
-- trial_identities guarda só o HMAC, nunca o valor.

create schema if not exists billing;

revoke all on schema billing from public;
revoke all on schema billing from anon, authenticated, service_role;

create table if not exists billing.devices (
  id text primary key,
  secret text not null,
  checkout text,
  checkout_url text,
  checkout_expires bigint,
  checkout_attempt text,
  checkout_plan text,
  customer text,
  subscription text,
  trial_used integer not null default 0
);

create table if not exists billing.events (
  id text primary key,
  processed bigint not null
);

create table if not exists billing.trial_identities (
  hmac text primary key,
  subscription text not null,
  created bigint not null
);

create index if not exists devices_subscription_idx on billing.devices (subscription);

revoke all on table billing.devices from public, anon, authenticated, service_role;
revoke all on table billing.events from public, anon, authenticated, service_role;
revoke all on table billing.trial_identities from public, anon, authenticated, service_role;

alter table billing.devices enable row level security;
alter table billing.events enable row level security;
alter table billing.trial_identities enable row level security;
