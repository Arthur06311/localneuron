# Publicar a cobrança em billing.localneuron.ai

Este guia é para o publicador. Ele não cria conta na Stripe, não cria projeto na Vercel, não cria projeto no Supabase, não gera chave real e não faz deploy. Os passos abaixo são para executar depois, na sua conta, no seu computador.

O vendedor é pessoa física (CPF) no Stripe do Brasil. Os preços são só em BRL. O serviço roda de graça no plano Hobby da Vercel, como Function em São Paulo (`gru1`), com Postgres grátis no Supabase na região `sa-east-1` (São Paulo). O endereço é `https://billing.localneuron.ai`. O aplicativo de mesa continua sem cobrança enquanto `subscription-config.json` estiver com `serviceUrl` e `publicKey` nulos.

A hospedagem é a Vercel com o Supabase. O repositório não inclui Dockerfile nem volume.

Preços aprovados, os dois com 7 dias grátis. O teste fica reservado quando a assinatura existe, uma vez por instalação, por cliente, por cartão ou por e-mail:

| Plano | Valor | Centavos | Intervalo |
| --- | --- | ---: | --- |
| Mensal | R$ 20,00 | 2000 | mês |
| Anual | R$ 150 | 15000 | ano |

O anual economiza cerca de 37% em relação a doze vezes o mensal, cerca de 4,5 meses. O serviço recusa iniciar se o preço não for exatamente um desses dois: moeda `brl`, preço fixo por unidade, quantidade 1, sem medição de uso e sem transformação de quantidade.

O modo de teste precisa de preços próprios, criados com o interruptor **Test mode** ligado. Os ids ao vivo não funcionam no modo de teste, e os ids de teste não funcionam ao vivo.

Ids ao vivo, já criados na Stripe. Use só no passo de ir ao vivo:

| Plano | Price ID ao vivo | Produto | Valor |
| --- | --- | --- | --- |
| Mensal | `price_1USoAyRrLFEADsDJcsg0GYfk` | `prod_VTlikjJuYKeFd4` | BRL 2000 |
| Anual | `price_1USoBjRrLFEADsDJMnwpa9NZ` | `prod_VTljxwpT8FsAqt` | BRL 15000 |

Não cole chave secreta, segredo de webhook, `DATABASE_URL` nem a chave privada da licença em chat, issue ou commit.

## O que você precisa antes

- Node 24 e o repositório na sua máquina.
- Conta na Vercel no plano Hobby, sem criar um projeto novo por este repositório.
- Conta no Supabase, sem criar o projeto por este repositório.
- Stripe CLI (`stripe`) apontando para a mesma conta, em **modo de teste**.
- Acesso ao DNS de `localneuron.ai` na Name.com. Os registros A do ápice e o CNAME de `www` são do GitHub Pages. Não os altere.

## Gerar o par Ed25519

Na raiz do repositório:

```bash
npm run license-keys
```

O padrão grava os arquivos em `~/.localneuron/`, fora do Git:

- `~/.localneuron/license-private.pem` (permissão 600). Esta chave não entra no repositório nem no pacote do aplicativo.
- `~/.localneuron/license-public.pem`. O comando imprime o PEM público para você copiar depois, em `subscription-config.json`.

Para outra pasta, também fora do clone:

```bash
npm run license-keys -- --dir "$HOME/segredos-localneuron"
```

O script recusa qualquer destino dentro do repositório. `--force` substitui o par e invalida licenças já emitidas. Não use sem querer.

Na Vercel a chave privada vai na variável `LOCALNEURON_LICENSE_PRIVATE_KEY` (o PEM inteiro). No computador, `npm run billing` também aceita `LOCALNEURON_LICENSE_PRIVATE_KEY_FILE` com o caminho do arquivo. Se as duas existirem, o PEM da variável ganha. O código troca a sequência `\n` por quebra de linha, então dá para colar o PEM em uma linha só.

## Criar os preços de teste

No [painel da Stripe](https://dashboard.stripe.com), ligue **Test mode** antes de qualquer clique. A conta é a do Brasil, pessoa física (CPF). Não use conta dos Estados Unidos e não use USD. Não reutilize os ids ao vivo desta página.

Confira o CLI:

```bash
stripe config --list
```

O modo precisa ser teste. Crie dois produtos e dois preços recorrentes. Anote cada `id` que o comando imprimir. Esses ids é que entram na Vercel enquanto você estiver no checklist.

```bash
stripe products create --name="LocalNeuron Pro Mensal"
stripe prices create \
  --product="PRODUTO_MENSAL_DE_TESTE" \
  --currency=brl \
  --unit-amount=2000 \
  -d "recurring[interval]=month" \
  -d "recurring[interval_count]=1"

stripe products create --name="LocalNeuron Pro Anual"
stripe prices create \
  --product="PRODUTO_ANUAL_DE_TESTE" \
  --currency=brl \
  --unit-amount=15000 \
  -d "recurring[interval]=year" \
  -d "recurring[interval_count]=1"
```

Troque `PRODUTO_MENSAL_DE_TESTE` e `PRODUTO_ANUAL_DE_TESTE` pelos ids que o `products create` mostrou. Confira no painel: ativo, BRL, recorrente, 2000 por mês e 15000 por ano, esquema por unidade, sem transformação de quantidade. O teste de 7 dias não é um campo do preço. O serviço acrescenta `trial_period_days=7` na sessão enquanto a instalação ainda pode receber o teste.

Gere o segredo do HMAC uma vez e guarde no cofre, não no Git:

```bash
openssl rand -hex 32
```

São 64 caracteres hexadecimais. O mínimo que o serviço aceita é 32. Não mude esse valor depois: os HMAC já gravados deixam de reconhecer o mesmo cartão ou e-mail.

## 1. Criar o projeto Supabase em sa-east-1 e rodar as migrações

No [painel do Supabase](https://supabase.com/dashboard), crie um projeto no plano Free. Em região, escolha **South America (São Paulo)**. O código da região precisa ser `sa-east-1`. Anote a senha do banco. Ela só aparece completa na criação. Não é a chave `anon` nem a chave `service_role`.

Abra **SQL Editor**. Cole o arquivo `billing/migrations/20261021000000_init.sql` e execute. O SQL cria o schema `billing`, as tabelas `devices`, `events` e `trial_identities`, o índice de assinatura, o RLS sem políticas e o `revoke` dos papéis da Data API. O dono do banco é quem executa. O desenho das tabelas está em [billing-schema.md](billing-schema.md).

Não há outro arquivo de migração. O serviço não migra sozinho ao iniciar. Se o SQL for executado de novo, os `if not exists` não apagam dados.

Confira no editor que as três tabelas estão no schema `billing`, não no `public`.

Abra **Connect** e escolha **Transaction pooler** (modo transação). Copie a URI. Antes de guardar, confira:

- o host contém `sa-east-1` (o prefixo `aws-0` ou `aws-1` é o que o painel mostrar; não invente);
- a porta é `6543`;
- o usuário é `postgres.` seguido do id do projeto;
- o banco é `postgres`.

Se a URI copiada estiver na porta `5432`, você pegou a conexão direta ou o modo sessão. A direta do plano Free é só IPv6 e a Vercel não alcança. O modo sessão também não serve para Function. Volte ao seletor e escolha o pooler de transação.

Se a senha tiver caractere reservado na URL (`@`, `:`, `/`, `#`, `?`, `%`), troque esse caractere pelo código percentual. Não coloque aspas na variável.

O código exige a porta `6543` e abre o cliente `postgres` com `prepare: false`, uma conexão, SSL obrigatório. O pooler de transação rejeita prepared statement. Não existe variável para ligar isso: já está no serviço.

Essa URI é a `DATABASE_URL`. Ela não entra no Git.

## 2. Criar o projeto na Vercel e definir as variáveis

No [painel da Vercel](https://vercel.com), plano Hobby, importe o repositório `Arthur06311/localneuron`. Framework: **Other**. A raiz do projeto é a raiz do repositório. Não aponte a pasta de saída para `public/`: o `vercel.json` já publica só `billing/static`, para o site da cobrança não servir a interface do Electron.

O `vercel.json` também fixa:

- `buildCommand`: `npm run build`;
- região `gru1` (São Paulo), a única região do projeto, ao lado do Supabase `sa-east-1`;
- rewrites de `/health` e `/billing/:path*` para `api/billing.js`.

Em **Settings → General → Node.js Version**, escolha **24.x**. O `package.json` pede Node `>=24`.

A função está em `api/billing.js`. Ela desliga o leitor de corpo (`bodyParser: false`) e entrega os bytes originais ao Fastify. A assinatura do webhook da Stripe depende desses bytes. Não remova essa opção e não acrescente outro parser na frente.

Em **Settings → Environment Variables**, ambiente **Production**, crie cada nome abaixo. Cole o valor só no painel. Não marque nenhuma variável para o cliente do navegador.

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | URI do pooler de transação, porta `6543` |
| `STRIPE_SECRET_KEY` | Chave secreta de **teste** (`sk_test_`) enquanto o checklist não passar |
| `STRIPE_WEBHOOK_SECRET` | Segredo do endpoint de teste; o passo 4 mostra onde copiar |
| `STRIPE_MONTHLY_PRICE_ID` | Price id mensal de **teste** (BRL 2000) |
| `STRIPE_YEARLY_PRICE_ID` | Price id anual de **teste** (BRL 15000) |
| `LOCALNEURON_LICENSE_PRIVATE_KEY` | PEM privado gerado acima |
| `LOCALNEURON_BILLING_TRIAL_HMAC_KEY` | Saída do `openssl rand -hex 32` |
| `LOCALNEURON_BILLING_PUBLIC_URL` | `https://billing.localneuron.ai` |

`LOCALNEURON_BILLING_PUBLIC_URL` é uma origem HTTPS, sem caminho, sem usuário e sem query. A Vercel define `VERCEL=1`. Com isso o limite de taxa lê `x-real-ip` ou o primeiro hop de `x-forwarded-for`. Não é preciso criar `LOCALNEURON_BILLING_TRUST_PROXY`. Se quiser deixar explícito, o valor é `vercel`.

Não crie `LOCALNEURON_BILLING_DB`. Esse nome era do SQLite e o serviço não lê mais.

Faça o deploy de Production depois que as variáveis existirem. O primeiro request abre o Postgres e confere os dois preços na Stripe. Se a região do banco não for `sa-east-1`, se a porta não for `6543`, ou se o preço não for BRL 2000 / 15000, a função responde erro e não cobra.

O comando local continua valendo, com as mesmas variáveis (a chave privada pode ser o arquivo):

```bash
npm run build && npm run billing
```

Nesse modo o processo escuta só em `127.0.0.1:4330`. A porta muda com `LOCALNEURON_BILLING_PORT`. Não use `0.0.0.0` no computador. O `DATABASE_URL` local também precisa ser o pooler `6543`: o serviço recusa outra porta.

## 3. CNAME de billing.localneuron.ai na Name.com

No projeto da Vercel, abra **Settings → Domains** e adicione `billing.localneuron.ai`. A tela mostra o alvo do CNAME. Copie esse alvo. Em geral é `cname.vercel-dns.com`. Use o texto que a Vercel mostrar, não um chute.

Na Name.com: **My Domains → localneuron.ai → Manage DNS Records**. O DNS deste domínio fica na Name.com. Adicione só esta linha. O TTL pode ficar em 300.

| Type | Host | Answer |
| --- | --- | --- |
| CNAME | `billing` | o alvo que a Vercel mostrou |

O Host é `billing`, não `billing.localneuron.ai` e não vazio. Não acrescente `https://`. Não crie registro A para `billing`. Não mexa nos quatro A do ápice (`185.199.108.153` a `185.199.111.153`) nem no CNAME `www`, que são do GitHub Pages. Preserve MX e TXT de e-mail.

Volte à Vercel e espere o domínio ficar válido, com HTTPS. A propagação pode levar até 24 horas. Confira `https://billing.localneuron.ai/health`. A resposta é `{"ok":true}`. A página `/` é só um aviso estático. Ela não é o aplicativo.

## 4. Webhook da Stripe e os eventos

Ainda em **Test mode**, crie o endpoint:

```bash
stripe webhook_endpoints create \
  --url="https://billing.localneuron.ai/billing/webhook" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=invoice.payment_failed"
```

São exatamente estes seis. Não marque o curinga de todos os eventos. A API usada pelo serviço é `2025-03-31.basil`.

O comando imprime o segredo do endpoint uma vez. Copie para `STRIPE_WEBHOOK_SECRET` na Vercel (Production) e faça um novo deploy. O serviço confere o HMAC do corpo cru, com tolerância de cinco minutos. Se o corpo for reescrito por um parser, a assinatura falha e o evento é recusado.

No painel, envie um evento de teste `invoice.paid` para a URL. A entrega precisa voltar HTTP 200. Um evento sem instalação conhecida também responde 200 e fica gravado em `billing.events`, para não repetir.

## 5. Portal do cliente com os dois preços

O código abre o portal sem um id de configuração. Vale a configuração padrão da conta. Quem já assina (ativa, em teste, pendente ou pausada) recebe o portal em vez de um Checkout novo, e a tela do aplicativo manda trocar Mensal e Anual em **Gerenciar assinatura**.

No modo de teste, crie a configuração padrão com os dois produtos de teste e só os dois preços de teste. Troque os ids pelos que você anotou no passo dos preços de teste:

```bash
stripe billing_portal configurations create \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[subscription_update][enabled]=true" \
  -d "features[subscription_update][default_allowed_updates][]=price" \
  -d "features[subscription_update][products][0][product]=PRODUTO_MENSAL_DE_TESTE" \
  -d "features[subscription_update][products][0][prices][]=PRECO_MENSAL_DE_TESTE" \
  -d "features[subscription_update][products][1][product]=PRODUTO_ANUAL_DE_TESTE" \
  -d "features[subscription_update][products][1][prices][]=PRECO_ANUAL_DE_TESTE" \
  -d "features[subscription_update][proration_behavior]=create_prorations" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_cancel][mode]=at_period_end" \
  -d "default_return_url=https://billing.localneuron.ai/billing/success"
```

No painel, em **Settings → Billing → Customer portal**, deixe esta configuração como padrão. A troca de preço fica limitada a esses dois preços. Quantidade desligada. Cancelamento só no fim do período. Não inclua outro produto.

Repita este passo no modo ao vivo, com os dois produtos e os dois prices da tabela do começo deste guia. Teste e ao vivo têm portais separados.

## 6. Checklist do modo de teste e ida ao vivo

Com as variáveis de **teste** na Vercel e `subscription-config.json` ainda nulo, rode o serviço só pelo aplicativo apontando para `https://billing.localneuron.ai` numa cópia local de configuração. Não faça commit dessa cópia.

Confira, com cartão de teste da Stripe:

- Mensal R$ 20,00 e Anual R$ 150, os dois com a frase de 7 dias grátis só quando a instalação é elegível.
- Trocar Mensal/Anual antes de pagar, ou deixar a sessão expirar, não gasta o teste. A sessão seguinte ainda pede 7 dias.
- Depois que a assinatura existe, a mesma instalação não ganha outro teste. O status `trialing` libera o Pro sem fatura paga, no máximo sete dias.
- O mesmo cartão ou o mesmo e-mail em outra instalação encerra o teste na hora (`trial_end=now`). O banco só fica com HMAC de 64 hex e o id `sub_`.
- Quem já assina e clica de novo cai no portal e troca Mensal e Anual lá. A quantidade não muda.
- Compra com autenticação adicional, janela fechada sem pagar, duplo clique e rede interrompida depois de criar o Checkout.
- Cobrança ao fim do teste, renovação, fatura recusada, recuperação do pagamento e cancelamento no fim do período.
- Evento repetido e evento fora de ordem. Reinício do aplicativo. Sete dias sem rede e a volta da rede. A licença offline vale no máximo sete dias.
- `GET /health` responde sem contar no limite de 60 pedidos por minuto. Pedido com cabeçalho `Origin` recebe 403.

O reembolso isolado não encerra a assinatura. Cancele ou revogue no painel, conforme a política que você publicar. Licenças já emitidas podem continuar offline até expirar.

### Ir ao vivo

Só depois do checklist:

1. No painel da Stripe, desligue **Test mode**.
2. Confira os preços ao vivo da tabela deste guia. Não crie outros valores.
3. Crie o webhook ao vivo na mesma URL e com os mesmos seis eventos. O segredo ao vivo é outro. Não reutilize o segredo de teste.
4. Crie o portal ao vivo com `prod_VTlikjJuYKeFd4` / `price_1USoAyRrLFEADsDJcsg0GYfk` e `prod_VTljxwpT8FsAqt` / `price_1USoBjRrLFEADsDJMnwpa9NZ`.
5. Na Vercel, ambiente Production, troque `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID` e `STRIPE_YEARLY_PRICE_ID` para os valores ao vivo. Mantenha `DATABASE_URL`, a chave privada e o HMAC. Faça um novo deploy.
6. Confira de novo um Checkout de teste... não: ao vivo, use um cartão real só quando os termos, o suporte e a política de reembolso estiverem publicados. Um pedido ao vivo cobra de verdade.
7. Aí sim preencha `subscription-config.json` com `serviceUrl` `https://billing.localneuron.ai` e `publicKey` o PEM público. Os dois campos entram juntos. Reconstrua os pacotes. Não coloque a chave privada nesse arquivo.

## Logs, para a página de privacidade

A Vercel guarda log da Function (pedido, status, erro e o IP que a plataforma vê). O Supabase guarda log do Postgres e da API. Esses logs podem incluir o IP, o id da instalação e o id do evento Stripe. Não incluem conversa, documento, nome de modelo nem o cartão: o cartão fica na Stripe, e o banco da cobrança só tem o HMAC.

O site em `localneuron.ai` é GitHub Pages e não está neste fluxo. Na página de privacidade, o publicador precisa dizer que a cobrança usa a Vercel e o Supabase, que esses dois serviços têm logs operacionais com IP, id de instalação e id de evento, e que conversas, documentos e modelos continuam no computador de quem usa o aplicativo. Não há página de privacidade neste branch para editar.

## Referências

- [Esquema do banco](billing-schema.md)
- [Stripe: eventos de assinatura](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe: portal do cliente](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe: versões da API](https://docs.stripe.com/api/versioning)
- [Supabase: pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel: Functions em Node.js](https://vercel.com/docs/functions/runtimes/node-js)
- [Name.com: CNAME](https://www.name.com/support/articles/115004895548-adding-a-cname-record)
