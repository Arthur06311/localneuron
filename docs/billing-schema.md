# Banco da cobrança

O serviço de assinatura usa Postgres no Supabase, projeto `hifnfveklpskbtxyeqza`, região `sa-east-1` (São Paulo). As Edge Functions também são chamadas com `x-region: sa-east-1` e `forceFunctionRegion=sa-east-1`. O aplicativo não cria as tabelas ao subir. O publicador roda `supabase db push`, que aplica `supabase/migrations/` como dono do banco. Não rode essa migração pela porta `6543`: o pooler de transação não serve para DDL.

O código em `src/billing-store.ts` fala com o banco só por `DATABASE_URL`. Em produção a URL precisa ser o pooler de transação, porta `6543`, host com `sa-east-1`, usuário que começa com `billing_app`, `prepare: false` e TLS verify-full (certificado público e nome do host). O modo transação não guarda `search_path` nem trava de sessão. Por isso todo SQL leva o schema `billing` no nome e não há `pg_advisory_lock`. Não há transação de banco em volta das chamadas HTTP à Stripe.

Os testes usam `MemoryBillingStore`. Eles não abrem rede nem exigem `DATABASE_URL`.

## O que cada tabela guarda

Schema `billing`. Ele fica fora do `public` para não aparecer na Data API do Supabase.

| Tabela | Função |
| --- | --- |
| `billing.devices` | Uma instalação, criada só quando o Checkout começa. O segredo guardado é o SHA-256 do token local, nunca o token. |
| `billing.events` | Id do evento Stripe já processado e a hora. Só essas duas colunas. O job apaga depois de 90 dias. |
| `billing.trial_identities` | HMAC-SHA256, o id da assinatura que o viu primeiro e `created` para a retenção. |
| `billing.rate_windows` | HMAC do endereço de rede, a rota, o início da janela e a contagem. Não há coluna de IP. |

`billing.devices` tem só `id`, `secret`, `checkout`, `checkout_url`, `checkout_expires`, `checkout_attempt`, `checkout_plan`, `customer`, `subscription` e `trial_used`. Não há coluna de nome, de cartão nem de e-mail.

`billing.trial_identities` não guarda o valor em claro. O job `billing-purge-identities` apaga linhas com `created` anterior a 5 × 365 dias. `billing-purge-events` apaga eventos com mais de 90 dias. `billing-purge-rates` apaga janelas com mais de cerca de dois minutos. `billing-keep-alive` chama a saúde da função uma vez por dia. Os quatro usam `pg_cron`. Um projeto pausado não executa o cron; restaure no painel.

## Idempotência

O Checkout grava `checkout_attempt` com `coalesce`: duas instâncias da função usam a mesma chave `ln-<instalação>-<tentativa>` na Stripe. A tentativa é apagada quando a sessão fica salva.

O webhook consulta `billing.events` antes de processar. O id do evento só é inserido depois do processamento (`on conflict do nothing`). Se o processamento falhar antes do insert, a Stripe pode tentar de novo. Um evento repetido não refaz o trabalho. O corpo do evento não é copiado para o banco.

O limite durável faz `insert ... on conflict do update set hits = hits + 1`. A chave é o HMAC, a rota e a janela. A contagem em memória só evita uma ida ao banco quando a janela já passou de 60. Se o banco falhar, a função conta na memória daquela instância e não transforma o Checkout em erro 400.

## Acesso

A migração cria o papel `billing_app` com `nologin`, `noinherit`, `nosuperuser` e `nobypassrls`. A senha não está no Git. O publicador liga o login no SQL Editor. A função conecta como esse papel, então o RLS vale. Há uma política `for all to billing_app` em cada tabela. O RLS não está em modo `force`: o dono continua podendo migrar.

A migração faz `revoke all` de `public`, `anon`, `authenticated` e `service_role`. O papel não entra em `authenticator` e as tabelas não vão para `public`. A chave `anon` e a chave `service_role` não são segredos da função. O serviço só usa `DATABASE_URL`.
