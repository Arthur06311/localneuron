# Publicar a cobrança no Supabase

Este guia é para o publicador. Ele não cria conta na Stripe, não cria projeto no Supabase, não gera chave real e não faz deploy. Os passos abaixo são para executar depois, na sua conta, no seu computador.

O vendedor é pessoa física (CPF) no Stripe do Brasil. Os preços são só em BRL. A cobrança roda no Supabase Free: Edge Functions e Postgres na região `sa-east-1` (São Paulo). Os operadores da cobrança são só a Stripe e o Supabase. A URL pública é `https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing`. Não há domínio próprio: domínio customizado de Edge Function é pago, e este fluxo fica no plano Free. O aplicativo de mesa continua sem cobrança enquanto `subscription-config.json` estiver com `serviceUrl` e `publicKey` nulos.

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
- Os registros A do ápice e o CNAME de `www` em `localneuron.ai` são do GitHub Pages. Não os altere. A cobrança não usa domínio próprio.

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

`supabase db push` aplica, nesta ordem, `supabase/migrations/20261021000000_init.sql`, `supabase/migrations/20261021010000_role_and_rate.sql`, `supabase/migrations/20261021020000_keep_alive.sql` e `supabase/migrations/20261021030000_rate_window_purge.sql`. Não rode esse SQL pela porta `6543`: o pooler de transação não serve para DDL e rejeita prepared statements. A conexão direta do plano Free (`db.<ref>.supabase.co:5432`) é só IPv6. O modo sessão (porta `5432` no pooler) também não serve para a função.

O desenho das tabelas está em [billing-schema.md](billing-schema.md). `billing.devices` só tem as colunas da instalação e do Checkout. A linha nasce quando o Checkout começa. `billing.events` só tem id e a hora, e o job apaga o que tiver mais de 90 dias. `billing.trial_identities` guarda o HMAC e o id da assinatura, com a data de criação, e o job apaga o que tiver mais de 5 × 365 dias. `billing.rate_windows` guarda o HMAC do endereço usado no limite, a rota e a janela. Esse HMAC usa `LOCALNEURON_BILLING_RATE_HMAC_KEY`, uma chave diferente da chave do teste. O IP em claro não entra no Postgres. O código apaga janelas com mais de cerca de dois minutos, no máximo uma vez por janela, e o job `billing-purge-rates` repete essa limpeza a cada dois minutos.

No SQL Editor, como dono do banco, dê login ao papel. Troque a senha curta abaixo por uma senha sua e não a grave no Git:

```sql
alter role billing_app with login password 'SENHA';
```

O `create role` em `20261021010000_role_and_rate.sql` inclui `nosuperuser`. O `alter role` da linha seguinte não inclui essa palavra. No Supabase, `postgres` não é superusuário, e `ALTER ROLE billing_app ... NOSUPERUSER` falha com `42501`. O texto já aplicado em produção é este arquivo, sem `nosuperuser` nesse `alter role`. A tabela `supabase_migrations.schema_migrations` não tem coluna de checksum: ela só registra a versão já aplicada. Não reescreva o arquivo, porque a versão `20261021010000` já rodou com este texto. Não abra outra migração só para repetir `nosuperuser`. Na conexão, o código lê `pg_roles` e só segue se `session_user` e `current_user` forem `billing_app`, com `rolsuper` e `rolbypassrls` falsos. O nome na URI não basta.

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
- `LOCALNEURON_BILLING_RATE_HMAC_KEY`
- `LOCALNEURON_BILLING_PUBLIC_URL`
- `LOCALNEURON_BILLING_TRUST_PROXY`

`LOCALNEURON_BILLING_PUBLIC_URL` é `https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing`, sem usuário, sem query e sem fragmento. `LOCALNEURON_BILLING_TRUST_PROXY` é `supabase`. Há duas chaves de HMAC. As duas saem de `openssl rand -hex 32` e precisam ser diferentes. `LOCALNEURON_BILLING_TRIAL_HMAC_KEY` cobre cartão e e-mail do teste. `LOCALNEURON_BILLING_RATE_HMAC_KEY` cobre só o endereço do limite. Gere cada uma uma vez. Não troque a do teste depois: trocar faria o teste antigo parecer novo. Não coloque a chave `anon` nem a `service_role` nesse arquivo. As funções não leem `SUPABASE_SERVICE_ROLE_KEY`.

A função medida no gateway do Supabase não recebe `x-forwarded-for` por padrão. Se o cliente enviar esse cabeçalho, o gateway o encaminha igual, então ele pode ser forjado. Os cabeçalhos presentes são `cf-connecting-ip` e `x-real-ip`. `Sb-Forwarded-For` é do Auth, opcional e só com a chave secreta; não é o cabeçalho das funções. Na Edge Function o modo padrão é `supabase`, porque o runtime tem `Deno.serve`, mesmo sem a variável e mesmo sem `SUPABASE_URL`. `LOCALNEURON_BILLING_TRUST_PROXY=off` desliga esse modo na função. No modo `supabase` o limite usa `cf-connecting-ip` e, se esse valor não for um IP único de até 64 caracteres, usa `x-real-ip`. Nunca lê `x-forwarded-for`. Antes do HMAC, um IPv6 fica só com o prefixo /64: trocar o identificador de interface não abre outro balde. Só o IPv4 mapeado `::ffff:a.b.c.d` vira esse IPv4. Um IPv6 que apenas termina em decimal pontuado continua no /64. Um endereço inválido, como `1::2::3`, `:::1` ou `::ffff:999.1.1.1`, não entra e o limite cai no socket. Um IPv4 continua inteiro. O valor entra só no HMAC da chave de limite e não é gravado em claro. Sem cabeçalho válido, o limite cai no endereço do socket.

`npm run billing` neste computador não está no gateway. O processo força `LOCALNEURON_BILLING_TRUST_PROXY=off` e não lê `cf-connecting-ip` nem `x-real-ip`, mesmo que o shell tenha `supabase`.

Depois do deploy, confira o gateway no mesmo minuto. A janela do limite dura um minuto e começa no segundo 00. Espere a virada do minuto e só então envie os pedidos. Se a janela virar no meio, a prova não vale. De uma máquina, faça 60 `POST` para `https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing/eligibility?forceFunctionRegion=sa-east-1`. O corpo é `{"device":"<uuid>"}` e o cabeçalho `Authorization` é `Bearer ` seguido de 64 hexadecimais. Uma instalação desconhecida responde `{"trial_eligible":true}` e mesmo assim conta no limite. Em cada um desses 60 pedidos, mande `cf-connecting-ip: 203.0.113.50`, `x-real-ip: 198.51.100.50` e `x-forwarded-for: 192.0.2.50`. Ainda nesse minuto, na mesma máquina: (A) repita com `cf-connecting-ip: 203.0.113.77` e os outros dois cabeçalhos iguais — a resposta precisa ser 429; (B) repita com `cf-connecting-ip: 203.0.113.5, 1.1.1.1` — a resposta também precisa ser 429. De outra rede, no mesmo minuto, sem esses três cabeçalhos, o pedido precisa ser 200. Os cabeçalhos do pedido aparecem em `edge_logs` do API Gateway, não no log da função. Não copie o endereço real para o Git, para o banco nem para o chat. `x-forwarded-for` pode aparecer em `edge_logs` com o valor forjado; o código não o lê. A rota de saúde não serve para esta prova: ela não entra no limite.

Se (A) ou (B) responder 200, a função aceitou um endereço forjado. Não passe a ler `x-forwarded-for` e não defina `LOCALNEURON_BILLING_TRUST_PROXY=off`. `off` junta todo mundo no endereço do socket, um balde só. Passe o limite a usar a instalação e o token, não o IP. Se o pedido da outra rede, sem cabeçalhos, for 429, o balde é o do socket e um cliente esgota o limite dos outros.

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

A API `2025-03-31.basil` tirou `charge.invoice`. O cliente HTTP e o construtor do webhook ficam nessa versão (`Stripe-Version` e `apiVersion`). Um reembolso integral de assinatura chega com `payment_intent`. O serviço lista `invoice_payments` por esse payment intent, lê a fatura e cancela a assinatura em `parent.subscription_details.subscription`. Uma cobrança reembolsada sem `payment_intent`, sem fatura ou sem assinatura nessa fatura é registrada no log e respondida com sucesso, para a Stripe não repetir até desligar o endpoint. Falha de rede ou falha ao cancelar uma assinatura encontrada não grava o evento, e a Stripe tenta de novo. Um reembolso parcial não cancela. Crie o endpoint com a mesma versão:

```bash
stripe webhook_endpoints create \
  --url="https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/stripe-webhook?forceFunctionRegion=sa-east-1" \
  --api-version=2025-03-31.basil \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=charge.refunded"
```

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

- Mensal R$ 20,00 e Anual R$ 150. A frase de 7 dias grátis só aparece em Meu plano quando a consulta já guardada diz que a instalação pode receber o teste. Na primeira abertura, sem essa consulta, o texto fica neutro: a pessoa escolhe Mensal ou Anual, sem a oferta. Quem já assinou não vê os 7 dias antes da consulta. Se a consulta falhar ou disser que não há teste, a frase continua oculta. Quem já usou o teste vê o aviso de que ele terminou, sem a oferta.
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
5. Troque nos segredos da função `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID` e `STRIPE_YEARLY_PRICE_ID` para os valores ao vivo. Mantenha `DATABASE_URL`, a chave privada e as duas chaves de HMAC. Rode de novo `supabase functions deploy billing` e `supabase functions deploy stripe-webhook`.
6. Aí sim, no terminal do aplicativo, aponte `LOCALNEURON_BILLING_URL` para a URL das funções e `LOCALNEURON_LICENSE_PUBLIC_KEY` para o PEM público. Os dois entram juntos. Não coloque a chave privada em `subscription-config.json`.

## Limites do plano Free

Cada função tem 256 MB de memória. O tempo de parede no Free é de 150 segundos (no pago, 400). O tempo de CPU é de 2 segundos por pedido; espera de rede, como o `fetch` à Stripe, não entra nessa conta. Um pedido parado por 150 segundos recebe 504. O pacote da função pode ter até 20 MB. O projeto Free aceita até 100 funções. A cota é de 500.000 invocações por mês. Passar disso no Free não gera cobrança: a plataforma avisa e aplica o uso justo. No Pro, a cota é de 2 milhões e cada milhão extra custa US$ 2. O log guarda cerca de 10.000 caracteres e até 100 eventos a cada 10 segundos. As portas de saída 25 e 587 ficam bloqueadas.

Sem domínio customizado, o Supabase reescreve uma resposta `text/html` para `text/plain`. As páginas de sucesso e de cancelamento já saem como `text/plain`, para o texto continuar legível nessa URL gratuita.

O serviço continua em Fastify com `@fastify/rate-limit`. O mesmo processo serve `npm run billing`, os testes e a Edge Function. O CodeQL reconhece o registro global do limite antes das rotas. Trocar por Hono ou por `Deno.serve` puro reduziria a inicialização a frio, mas perderia essa conferência e duplicaria o roteador. O grafo da cobrança importa os arquivos locais com extensão `.ts`. O `tsc` reescreve essas extensões para `.js` no `dist`, com `allowImportingTsExtensions` e `rewriteRelativeImportExtensions`. A API de deploy do Supabase ignora `sloppy-imports` do `deno.json` e não acha `src/billing-store.js`. Por isso esse modo não entra no `deno.json`. Cada função tem um `deno.json` com o mapa dos pacotes npm. O `deno.json` da raiz repete esse mapa, porque `deno check` partindo da raiz lê esse arquivo. O comando é `deno check supabase/functions/*/index.ts`. O webhook usa `stripe` 18.0.0, a versão cujo tipo padrão é `2025-03-31.basil`.

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
