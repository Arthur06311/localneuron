-- pg_cron: saúde diária, eventos em 90 dias, HMAC em no máximo 5 anos e janelas curtas.
-- Um projeto pausado não executa estes jobs. Restaure o projeto no painel.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

do $$
declare r record;
begin
  for r in select jobid from cron.job where jobname in ('billing-keep-alive', 'billing-purge-events', 'billing-purge-identities', 'billing-purge-rates')
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'billing-keep-alive',
  '0 12 * * *',
  $$select net.http_get(
    'https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing/health?forceFunctionRegion=sa-east-1',
    '{}'::jsonb,
    '{"x-region":"sa-east-1"}'::jsonb,
    5000
  )$$
);

select cron.schedule(
  'billing-purge-events',
  '15 12 * * *',
  $$delete from billing.events where processed < (extract(epoch from now()) * 1000) - (90::bigint * 24 * 60 * 60 * 1000)$$
);

select cron.schedule(
  'billing-purge-identities',
  '20 12 * * *',
  $$delete from billing.trial_identities where created < (extract(epoch from now()) * 1000) - (5::bigint * 365 * 24 * 60 * 60 * 1000)$$
);

select cron.schedule(
  'billing-purge-rates',
  '*/15 * * * *',
  $$delete from billing.rate_windows where window_start < (extract(epoch from now()) * 1000) - 120000$$
);
