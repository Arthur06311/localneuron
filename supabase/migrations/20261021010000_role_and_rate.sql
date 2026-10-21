-- Papel da aplicação, janela de limite e relógio de retenção.
-- A senha não fica neste arquivo. O publicador define o login no SQL Editor.

do $$ begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'billing_app') then
    create role billing_app nologin noinherit nosuperuser nobypassrls;
  end if;
end $$;

alter role billing_app with nologin noinherit nosuperuser nobypassrls;

alter table billing.trial_identities add column if not exists created bigint not null default 0;
alter table billing.trial_identities alter column created drop default;

create table if not exists billing.rate_windows (
  ip_hash text not null,
  route text not null,
  window_start bigint not null,
  hits integer not null,
  primary key (ip_hash, route, window_start)
);

create index if not exists events_processed_idx on billing.events (processed);
create index if not exists trial_identities_created_idx on billing.trial_identities (created);
create index if not exists rate_windows_window_idx on billing.rate_windows (window_start);

grant usage on schema billing to billing_app;
grant select, insert, update, delete on billing.devices to billing_app;
grant select, insert, update, delete on billing.events to billing_app;
grant select, insert, update, delete on billing.trial_identities to billing_app;
grant select, insert, update, delete on billing.rate_windows to billing_app;

revoke all on table billing.rate_windows from public, anon, authenticated, service_role;

alter table billing.rate_windows enable row level security;

drop policy if exists billing_app_all on billing.devices;
create policy billing_app_all on billing.devices for all to billing_app using (true) with check (true);
drop policy if exists billing_app_all on billing.events;
create policy billing_app_all on billing.events for all to billing_app using (true) with check (true);
drop policy if exists billing_app_all on billing.trial_identities;
create policy billing_app_all on billing.trial_identities for all to billing_app using (true) with check (true);
drop policy if exists billing_app_all on billing.rate_windows;
create policy billing_app_all on billing.rate_windows for all to billing_app using (true) with check (true);
