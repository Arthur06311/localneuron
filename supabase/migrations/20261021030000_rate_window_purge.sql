-- Aproxima billing-purge-rates do TTL de dois minutos.
-- Não recria os jobs de saúde, eventos ou identidades.

do $$
declare r record;
begin
  for r in select jobid from cron.job where jobname = 'billing-purge-rates'
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'billing-purge-rates',
  '*/2 * * * *',
  $$delete from billing.rate_windows where window_start < (extract(epoch from now()) * 1000) - 120000$$
);
