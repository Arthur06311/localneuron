# Publicar a cobrança no Supabase

Este guia é para o publicador. Ele não cria conta na Stripe, não cria projeto no Supabase, não gera chave real e não faz deploy. Os passos abaixo são para executar depois, na sua conta, no seu computador.

O vendedor é pessoa física (CPF) no Stripe do Brasil. Os preços são só em BRL. A cobrança roda no Supabase Free: Edge Functions e Postgres na região `sa-east-1` (São Paulo). Os operadores da cobrança são só a Stripe e o Supabase. O domínio `billing.localneuron.ai` fica para depois; até lá o aplicativo usa a URL das funções. O aplicativo de mesa continua sem cobrança enquanto `subscription-config.json` estiver com `serviceUrl` e `publicKey` nulos.

Não há Vercel neste fluxo. O repositório não inclui Dockerfile nem volume.

Preços aprovados, os dois com 7 dias grátis. O teste fica reservado quando a assinatura existe, uma vez por pessoa e por cartão:

| Plano | Valor | Centavos | Intervalo |
| --- | --- | ---: | --- |
| Mensal | R$ 20,00 | 2000 | mês |
| Anual | R$ 150 | 15000 | ano |

O anual economiza cerca de 37% em relação a doze vezes o mensal, cerca de 4,5 meses. O serviço recusa iniciar se o preço não for exatamente um desses dois: moeda `brl`, preço fixo por unidade, quantidade 1, sem medição de uso e sem transformação de quantidade. A `DATABASE_URL` também precisa da porta `6543`, de um host com `sa-east-1` e do papel `billing_app`.

O modo de teste precisa de preços próprios, criados com o interruptor **Test mode** ligado. Os ids ao vivo não funcionam no modo de teste, e os ids de teste não funcionam ao vivo.

Ids ao vivo, já criados na Stripe. Use só no passo de ir ao vivo:

| Plano | Price ID ao vivo | Produto | Valor |
| --- | --- | --- | --- |
| Mensal | `price_1USoAyRrLFEADsDJcsg0GYfk` | `prod_VTlikjJuYKeFd4` | BRL 2000 |
| Anual | `price_1USoBjRrLFEADsDJMnwpa9NZ` | `prod_VTljxwpT8FsAqt` | BRL 15000 |

Não cole chave secreta, segredo de webhook, `DATABASE_URL` nem a chave privada da licença em chat, issue ou commit.

## O que você precisa antes

- Node 24, o repositório na sua máquina e a CLI `supabase` instalada.
- O projeto Supabase `hifnfveklpskbtxyeqza`, já em `sa-east-1`. Não crie outro projeto por este repositório.
- Stripe CLI (`stripe`) apontando para a mesma conta, em **modo de teste**.
- Os registros A do ápice e o CNAME de `www` em `localneuron.ai` são do GitHub Pages. Não os altere. O domínio `billing.localneuron.ai` é opcional e posterior; não invente um alvo de CNAME.

## Gerar o par Ed25519

Na raiz do repositório:

```bash
npm run license-keys
```

O padrão grava os arquivos em `~/.localneuron/`, fora do Git:

- `~/.localneuron/license-private.pem` (permissão 600). Esta chave não entra no repositório nem no pacote do aplicativo.
- `~/.localneuron/license-public.pem`. O comando imprime o PEM público para você copiar depois, só no terminal que abre o aplicativo.

Para outra pasta, também fora do clone:

```bash
npm run license-keys -- --dir "$HOME/.localneuron"
```

O comando recusa um caminho dentro do repositório. `--force` sobrescreve o par que já estiver nessa pasta.

No segredo da função, cole o PEM em `LOCALNEURON_LICENSE_PRIVATE_KEY`. No computador, `npm run billing` também aceita `LOCALNEURON_LICENSE_PRIVATE_KEY_FILE`. Se as duas existirem, o PEM da variável ganha. O código troca a sequência `\n` por quebra de linha, então dá para colar o PEM em uma linha só.

## 1. Preços de teste na Stripe

O modo precisa ser teste. Crie dois produtos e dois preços recorrentes. Anote cada id que o comando imprimir. Esses ids é que entram nos segredos da função enquanto você estiver no checklist.

```bash
stripe products create --name="LocalNeuron Pro Mensal (teste)"
stripe products create --name="LocalNeuron Pro Anual (teste)"
stripe prices create --currency=brl --unit-amount=2000 -d "recurring[interval]=month" -d "product=PRODUTO_MENSAL_DE_TESTE"
stripe prices create --currency=brl --unit-amount=15000 -d "recurring[interval]=year" -d "product=PRODUTO_ANUAL_DE_TESTE"
```

Troque `PRODUTO_MENSAL_DE_TESTE` e `PRODUTO_ANUAL_DE_TESTE` pelos ids que o `products create` mostrou. Confira no painel: ativo, BRL, recorrente, 2000 por mês e 15000 por ano, esquema por unidade, sem transformação de quantidade. O teste de 7 dias não é um campo do preço. O serviço acrescenta `trial_period_days=7` na sessão enquanto a pessoa e o cartão ainda podem receber o teste.

## 2. Banco, papel e segredos

Na raiz do repositório:

```bash
supabase login
supabase link --project-ref hifnfveklpskbtxyeqza
supabase db push
```

`supabase db push` aplica, nesta ordem, `supabase/migrations/20261021000000_init.sql`, `supabase/migrations/20261021010000_role_and_rate.sql` e `supabase/migrations/20261021020000_keep_alive.sql`. Não rode esse SQL pela porta `6543`: o pooler de transação não serve para DDL e rejeita prepared statements. A conexão direta do plano Free (`db.<ref>.supabase.co:5432`) é só IPv6. O modo sessão (porta `5432` no pooler) também não serve para a função.

O desenho das tabelas está em [billing-schema.md](billing-schema.md). `billing.devices` só tem as colunas da instalação e do Checkout. A linha nasce quando o Checkout começa. `billing.events` só tem id e a hora, e o job apaga o que tiver mais de 90 dias. `billing.trial_identities` guarda o HMAC e o id da assinatura, com a data de criação, e o job apaga o que tiver mais de 5 × 365 dias. `billing.rate_windows` guarda o HMAC do endereço de rede, a rota e a janela. O IP em claro não entra no Postgres.

No SQL Editor, como dono do banco, dê login ao papel. Troque a senha curta abaixo por uma senha sua e não a grave no Git:

```sql
alter role billing_app with login password 'SENHA';
```

A URI da função é o pooler de transação. O usuário é `billing_app.hifnfveklpskbtxyeqza`, o host contém `sa-east-1` e a porta é `6543`. Codifique os caracteres especiais da senha. Não use o usuário `postgres` nem a chave `anon` ou `service_role`.

O TLS é verify-full: o código exige o certificado público da Supabase e confere o nome do host. `LOCALNEURON_BILLING_DB_CA` é opcional. Se existir, precisa ser um PEM ou o caminho de um arquivo. Não é chave privada.

Crie `supabase/.env.billing` no seu computador. Esse nome já entra no `.gitignore` por `.env.*`. Uma variável por linha, sem aspas em volta do valor. Os nomes são:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_YEARLY_PRICE_ID`
- `LOCALNEURON_LICENSE_PRIVATE_KEY`
- `LOCALNEURON_BILLING_TRIAL_HMAC_KEY`
- `LOCALNEURON_BILLING_PUBLIC_URL`
- `LOCALNEURON_BILLING_TRUST_PROXY`

`LOCALNEURON_BILLING_PUBLIC_URL` é `https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing`, sem usuário, sem query e sem fragmento. `LOCALNEURON_BILLING_TRUST_PROXY` é `supabase`. O HMAC sai de `openssl rand -hex 32`. Gere uma vez e não troque depois: trocar faria o teste antigo parecer novo. Não coloque a chave `anon` nem a `service_role` nesse arquivo. As funções não leem `SUPABASE_SERVICE_ROLE_KEY`.

```bash
supabase secrets set --env-file supabase/.env.billing
supabase functions deploy billing
supabase functions deploy stripe-webhook
```

As duas funções estão com `verify_jwt = false` em `supabase/config.toml`. O aplicativo manda o segredo da instalação, não um JWT de usuário do Supabase. A conferência continua dentro da função. O webhook usa o corpo cru e `constructEventAsync` com SubtleCrypto.

Cada chamada de Checkout, sucesso, cancelamento e saúde manda a região `sa-east-1` no cabeçalho `x-region` e na query `forceFunctionRegion`. A Stripe não envia esse cabeçalho. Por isso a URL do webhook e a URL de retorno já trazem a query.

Saúde com banco: `https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing/health?forceFunctionRegion=sa-east-1`. A resposta é `{"ok":true}`. Se o banco falhar, a resposta é `{"ok":false}` com status 503, sem o texto do erro. `GET /health` no processo local só diz que o processo está no ar e não consulta o banco.

O plano Free pausa o projeto depois de cerca de sete dias sem atividade. Um projeto pausado não roda `pg_cron` e um HTTP não tira a pausa. Restaure o projeto no painel. O job `billing-keep-alive` chama a saúde uma vez por dia, ao meio-dia UTC, sem cabeçalho `Origin` (com `Origin` a função responde 403). Os outros jobs apagam eventos com mais de 90 dias, HMAC com mais de 5 × 365 dias e janelas de limite com mais de cerca de dois minutos.

No computador, sem deploy:

```bash
npm run build && npm run billing
```

O processo escuta só em `127.0.0.1:4330`. A porta pode ser `LOCALNEURON_BILLING_PORT` e o endereço `LOCALNEURON_BILLING_HOST`.

## 3. Webhook e portal

A URL do endpoint, no modo de teste e ao vivo, é:

`https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/stripe-webhook?forceFunctionRegion=sa-east-1`

Eventos, os sete:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`

O comando imprime o segredo do endpoint uma vez. Copie para `STRIPE_WEBHOOK_SECRET` e rode `supabase functions deploy stripe-webhook` de novo se o segredo mudou. A tolerância é de cinco minutos. O serviço não grava uma cópia do corpo.

O portal só cancela a próxima renovação e atualiza o meio de pagamento. A troca de plano fica desligada. Não cadastre produtos nem preços nesta configuração.

```bash
stripe billing_portal configurations create \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_cancel][mode]=at_period_end" \
  -d "features[subscription_update][enabled]=false"
```

No painel, em **Settings → Billing → Customer portal**, deixe esta configuração como padrão. Quem já assina recebe o portal em vez de um segundo Checkout. A escolha Mensal ou Anual acontece só antes do primeiro Checkout. Uma assinatura cancelada pode abrir outro Checkout, sem um segundo teste.

## 4. Checklist no aplicativo

Deixe `subscription-config.json` nulo no Git. No terminal que abre o aplicativo, e só nele, exporte `LOCALNEURON_BILLING_URL` e `LOCALNEURON_LICENSE_PUBLIC_KEY`. `subscriptionConfig()` lê essas duas variáveis. Não faça commit dessa sessão.

`LOCALNEURON_BILLING_URL` é a mesma URL pública das funções, sem query. O aplicativo acrescenta `forceFunctionRegion=sa-east-1` e o cabeçalho `x-region` na hora de chamar.

Confira, com cartão de teste da Stripe:

- Mensal R$ 20,00 e Anual R$ 150. A frase de 7 dias grátis só aparece em Meu plano quando a instalação ainda pode receber o teste.
- Abrir o chat ou a central Pro não dispara essa consulta. Ela só sai de Meu plano, no máximo a cada dez minutos, e não trava a tela. Falha de rede esconde os 7 dias.
- Trocar Mensal/Anual antes de pagar, ou deixar a sessão expirar, não gasta o teste.
- A linha em `billing.devices` só nasce no Checkout. A elegibilidade de uma instalação nova não grava linha.
- Depois que a assinatura existe, a mesma pessoa e o mesmo cartão não ganham outro teste. O status `trialing` libera o Pro sem fatura paga, no máximo sete dias, ou até o fim do período, o que for antes.
- No refresh, um teste repetido termina na hora e a resposta traz `trial_repeat`. O aplicativo mostra que o teste desta pessoa ou deste cartão já foi usado. Não sai uma licença ativa de teste.
- O banco só fica com HMAC de 64 hex, o id `sub_` e a data de criação. Não fica com cartão, e-mail nem IP.
- Quem já assina e clica de novo cai no portal para atualizar o pagamento ou cancelar a próxima renovação. O portal não troca Mensal e Anual.
- Compra com autenticação adicional, janela fechada sem pagar, duplo clique e rede interrompida depois de criar o Checkout.
- Cobrança ao fim do teste, renovação, fatura recusada e recuperação do pagamento.
- Evento repetido e evento fora de ordem. Reinício do aplicativo. Cerca de um dia depois de uma validação bem-sucedida, abrir o aplicativo pede a licença de novo, sem bloquear a tela. A licença vale no máximo sete dias.
- `GET /health` e `GET /billing/health` não contam no limite de 60 pedidos por minuto. Pedido com cabeçalho `Origin` recebe 403.
- Um reembolso integral (`charge.refunded` com a cobrança toda devolvida) cancela a assinatura na Stripe. Um reembolso parcial não cancela. Renovação automática não reabre o direito de arrependimento do primeiro pagamento. A licença já salva no computador pode continuar até expirar. O próximo **Atualizar assinatura** busca o estado novo.

Um pedido ao vivo cobra de verdade. Use um cartão real só quando os termos, o suporte e a política de reembolso estiverem publicados.

## 5. Ir ao vivo

Só depois do checklist:

1. No painel da Stripe, desligue **Test mode**.
2. Confira os preços ao vivo da tabela deste guia. Não crie outros valores.
3. Crie o webhook ao vivo na mesma URL e com os mesmos sete eventos. O segredo ao vivo é outro. Não reutilize o segredo de teste.
4. Crie o portal ao vivo com o mesmo comando: atualizar pagamento, cancelar no fim do período e `subscription_update` desligado. Sem produtos e sem preços na configuração.
5. Troque nos segredos da função `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID` e `STRIPE_YEARLY_PRICE_ID` para os valores ao vivo. Mantenha `DATABASE_URL`, a chave privada e o HMAC. Rode de novo `supabase functions deploy billing` e `supabase functions deploy stripe-webhook`.
6. Aí sim, no terminal do aplicativo, aponte `LOCALNEURON_BILLING_URL` para a URL das funções e `LOCALNEURON_LICENSE_PUBLIC_KEY` para o PEM público. Os dois entram juntos. Não coloque a chave privada em `subscription-config.json`.

## Logs

O Supabase guarda log da função e do Postgres. Esses logs podem incluir o IP. Esse IP não entra nas tabelas `billing`. O banco da cobrança não guarda conversa, documento, nome de modelo nem cartão. O cartão fica na Stripe. Para a Stripe segue só o id da instalação, em `client_reference_id` e nos metadados.

O site em `localneuron.ai` é GitHub Pages e não está neste fluxo.

## Referências

- [Esquema do banco](billing-schema.md)
- [Stripe: eventos de assinatura](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe: portal do cliente](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Supabase: conectar ao Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase: pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
