# Banco da cobrança

O serviço de assinatura usa Postgres no Supabase, região `sa-east-1` (São Paulo). O aplicativo não cria as tabelas ao subir. O publicador roda o SQL de `billing/migrations/` uma vez, no SQL Editor do Supabase, com o usuário dono do banco. Não rode essa migração pela porta `6543`: o pooler de transação não serve para DDL.

O código em `src/billing-store.ts` fala com o banco só por `DATABASE_URL`. Em produção a URL precisa ser o pooler de transação, porta `6543`, com `prepare: false`. O modo transação não guarda `search_path` nem trava de sessão. Por isso todo SQL leva o schema `billing` no nome e não há `pg_advisory_lock`.

Os testes usam `MemoryBillingStore`. Eles não abrem rede nem exigem `DATABASE_URL`.

## O que cada tabela guarda

Schema `billing`. Ele fica fora do `public` para não aparecer na Data API do Supabase.

| Tabela | Função |
| --- | --- |
| `billing.devices` | Uma instalação. O segredo guardado é o SHA-256 do token local, nunca o token. |
| `billing.events` | Id do evento Stripe já processado, com a hora. Serve à idempotência. |
| `billing.trial_identities` | HMAC-SHA256 do cartão ou do e-mail, e o id da assinatura que o viu primeiro. |

`billing.devices` tem `id`, `secret`, os campos da sessão de Checkout (`checkout`, `checkout_url`, `checkout_expires`, `checkout_attempt`, `checkout_plan`), `customer`, `subscription` e `trial_used`. Não há coluna de cartão, de impressão digital nem de e-mail.

`billing.trial_identities` tem só `hmac` (chave primária) e `subscription`. O valor em claro não entra no banco, no log nem na resposta.

## Idempotência

O Checkout grava `checkout_attempt` com `coalesce`: duas instâncias da função usam a mesma chave `ln-<instalação>-<tentativa>` na Stripe. A tentativa é apagada quando a sessão fica salva.

O webhook consulta `billing.events` antes de processar. O id do evento só é inserido depois do processamento (`on conflict do nothing`). Se o processamento falhar antes do insert, a Stripe pode tentar de novo. Um evento repetido não refaz o trabalho.

Não há transação de banco em volta das chamadas HTTP à Stripe.

## Acesso

A migração faz `revoke all` de `public`, `anon`, `authenticated` e `service_role`, e liga `row level security` nas três tabelas, sem política. Quem conecta pela `DATABASE_URL` é o dono (`postgres.PROJETO` no pooler). Esse papel ignora o RLS. Não crie política que o dono precise cumprir e não dê `grant` para os papéis da Data API. Não mova essas tabelas para o schema `public`.

A chave `anon` e a chave `service_role` do Supabase não entram na Vercel. O serviço só usa `DATABASE_URL`.
