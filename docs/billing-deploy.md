# Publicar a cobrança em billing.localneuron.ai

Este guia é para o publicador. Ele não cria conta na Stripe, não cria conta no Fly.io, não gera chave real e não faz deploy. Os comandos abaixo são o passo a passo para executar depois, no seu computador, com a conta que você já tem.

O vendedor é pessoa física (CPF) no Stripe do Brasil. Os preços são só em BRL. O serviço fica no Fly.io, região `gru` (São Paulo), no endereço `https://billing.localneuron.ai`. O aplicativo de mesa continua sem cobrança enquanto `subscription-config.json` estiver com `serviceUrl` e `publicKey` nulos.

Preços aprovados, os dois com 7 dias grátis, uma vez por instalação ou por cliente:

| Plano | Valor | `unit_amount` | Intervalo |
| --- | --- | ---: | --- |
| Mensal | R$ 29,90 | 2990 | mês |
| Anual | R$ 299 | 29900 | ano |

O anual economiza cerca de 2 meses em relação a doze vezes o mensal. O serviço recusa subir se o preço não for exatamente um desses dois: moeda `brl`, preço fixo por unidade, quantidade 1, sem medição de uso e sem transformação de quantidade.

## O que você precisa antes

- Node 24 e o repositório na sua máquina.
- [flyctl](https://fly.io/docs/flyctl/install/) instalado. Não rode `fly auth signup` por este guia: entre na conta que você já possui.
- Stripe CLI (`stripe`) apontando para a mesma conta, em **modo de teste**.
- Acesso ao DNS de `localneuron.ai` na Name.com.

Não cole chave secreta, `whsec_` nem a chave privada da licença em chat, issue ou commit.

## 1. Gerar o par Ed25519

Na raiz do repositório:

```bash
npm run license-keys
```

O padrão grava os arquivos em `~/.localneuron/`, fora do Git:

- `~/.localneuron/license-private.pem` (permissão 600). Esta chave não entra no repositório, na imagem nem no pacote do aplicativo.
- `~/.localneuron/license-public.pem`. O comando imprime o PEM público para você copiar depois.

Para outra pasta, também fora do clone:

```bash
npm run license-keys -- --dir "$HOME/segredos-localneuron"
```

O script recusa qualquer destino dentro do repositório. `--force` substitui o par e invalida licenças já emitidas; não use sem querer.

## 2. Criar o produto e os dois preços (modo de teste)

No [painel da Stripe](https://dashboard.stripe.com), ligue **Test mode** (modo de teste) antes de qualquer clique. A conta é a do Brasil, pessoa física (CPF). Não use conta dos Estados Unidos e não use USD.

Confira o CLI:

```bash
stripe login
stripe config --list
```

A chave em uso tem de ser a de teste. Se o comando ou o painel mostrar modo ao vivo, pare.

### Pelo painel

1. **Product catalog → Add product**.
2. Nome: `LocalNeuron Pro`. Descrição: `Assinatura do LocalNeuron Pro`.
3. Primeiro preço: moeda **BRL**, valor **29.90**, recorrente, a cada **mês**, cobrança padrão por unidade. Não marque uso medido.
4. **Add another price**: moeda **BRL**, valor **299.00**, recorrente, a cada **ano**, também por unidade e sem uso medido.
5. Salve. Copie os dois identificadores `price_...`. O de R$ 29,90 é o mensal. O de R$ 299 é o anual.

### Pelo Stripe CLI

O CLI abaixo faz o mesmo, ainda em modo de teste. Troque `prod_SUBSTITUA` pelo `id` que o primeiro comando devolver.

```bash
stripe products create \
  -d name="LocalNeuron Pro" \
  -d description="Assinatura do LocalNeuron Pro"

stripe prices create \
  -d product="prod_SUBSTITUA" \
  -d currency=brl \
  -d unit_amount=2990 \
  -d billing_scheme=per_unit \
  -d "recurring[interval]=month" \
  -d "recurring[interval_count]=1" \
  -d "recurring[usage_type]=licensed"

stripe prices create \
  -d product="prod_SUBSTITUA" \
  -d currency=brl \
  -d unit_amount=29900 \
  -d billing_scheme=per_unit \
  -d "recurring[interval]=year" \
  -d "recurring[interval_count]=1" \
  -d "recurring[usage_type]=licensed"
```

Guarde os dois `price_` em variáveis do shell, sem gravar em arquivo do Git:

```bash
export STRIPE_MONTHLY_PRICE_ID="price_do_mensal"
export STRIPE_YEARLY_PRICE_ID="price_do_anual"
export STRIPE_SECRET_KEY="cole_a_chave_secreta_de_teste"
```

A chave secreta de teste começa com `sk_test_`. Ela fica só na memória do shell e, no passo 4, no cofre do Fly.

## 3. Criar o app e o volume no Fly

O nome `localneuron-billing` é global no Fly. Se ele já existir e não for seu, escolha outro, troque `app` em `fly.toml` e use esse nome no lugar de `localneuron-billing` nos comandos e no CNAME.

Na raiz do repositório, onde estão `fly.toml` e `billing/Dockerfile`:

```bash
fly auth login
fly launch --no-deploy --copy-config --ha=false --name localneuron-billing --region gru --yes
fly volumes create localneuron_billing --region gru --size 1 -a localneuron-billing -y
```

- `--no-deploy` cria o app sem publicar imagem.
- `--ha=false` deixa uma máquina só. O volume do SQLite não pode ser montado em duas.
- `--region gru` é São Paulo.
- O volume `localneuron_billing` é o disco de `LOCALNEURON_BILLING_DB` (`/data/billing.sqlite`). Um gigabyte é o menor tamanho. Não crie um segundo volume com o mesmo nome.

A máquina em `fly.toml` é a menor de CPU compartilhada: `shared-cpu-1x` com 256 MB. `force_https` está ligado. A checagem de saúde é `GET /health`. Se a máquina reiniciar por falta de memória, suba só a linha `memory` para `"512mb"` e rode `fly deploy` de novo.

Não aumente a contagem de máquinas:

```bash
fly scale count 1 --region gru -a localneuron-billing -y
```

## 4. Enviar os segredos e publicar

O `fly.toml` já define o que não é segredo: escuta em `0.0.0.0:4330`, banco em `/data/billing.sqlite`, URL pública `https://billing.localneuron.ai` e `LOCALNEURON_BILLING_TRUST_PROXY=fly` (o limite de taxa usa o IP do cabeçalho `Fly-Client-IP`).

O segredo do webhook ainda não existe. Use um valor temporário só para o processo conseguir iniciar. Você troca no passo 6, antes de qualquer pagamento de teste.

```bash
export STRIPE_WEBHOOK_SECRET="temporario_troque_no_passo_7"
fly secrets set \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  STRIPE_MONTHLY_PRICE_ID="$STRIPE_MONTHLY_PRICE_ID" \
  STRIPE_YEARLY_PRICE_ID="$STRIPE_YEARLY_PRICE_ID" \
  LOCALNEURON_LICENSE_PRIVATE_KEY="$(cat "$HOME/.localneuron/license-private.pem")" \
  -a localneuron-billing
fly deploy -a localneuron-billing
```

`fly secrets set` lê a chave privada do arquivo e guarda no Fly. O comando não imprime o PEM. A imagem não contém esse arquivo: o entrypoint grava em `/tmp` na hora de subir e apaga a variável antes de iniciar o Node.

O processo final é o usuário `node`, não root. Na primeira subida o volume pode estar gravável só pelo root. Se o log disser que `/data` não pode ser gravada:

```bash
fly logs -a localneuron-billing
fly ssh console --user root -a localneuron-billing -C "chown node:node /data && chmod 700 /data"
fly apps restart localneuron-billing
```

Confira que os dois preços foram aceitos. Se o serviço recusar iniciar, o valor, a moeda ou o intervalo na Stripe não é o da tabela do topo.

```bash
fly status -a localneuron-billing
fly logs -a localneuron-billing
```

## 5. DNS na Name.com

O site `localneuron.ai` continua no GitHub Pages. Não altere os registros **A** do domínio principal (`185.199.108.153` e os outros três) nem o **CNAME** de `www`. Não crie um curinga `*`.

O certificado pede o nome antes do DNS existir. Rode isto e anote o alvo que o Fly mostrar:

```bash
fly certs add billing.localneuron.ai -a localneuron-billing
fly certs show billing.localneuron.ai -a localneuron-billing
```

Na Name.com: **My Domains → localneuron.ai → Manage DNS Records**. Se o DNS estiver noutro provedor, faça o registro lá. O preferido para este subdomínio é CNAME:

| Type | Host | Answer |
| --- | --- | --- |
| CNAME | `billing` | `localneuron-billing.fly.dev` |

O Host é `billing`, não `billing.localneuron.ai` e não vazio. O Answer não leva `https://` nem barra. Pode manter o TTL 300. Se você tiver mudado o nome do app, o Answer é `<nome-do-app>.fly.dev`.

Se a Name.com não aceitar CNAME nesse host, use A e AAAA dedicados do Fly, sem mexer no ápice:

```bash
fly ips allocate-v4 --shared -a localneuron-billing
fly ips allocate-v6 -a localneuron-billing
fly ips list -a localneuron-billing
```

| Type | Host | Answer |
| --- | --- | --- |
| A | `billing` | o IPv4 mostrado por `fly ips list` |
| AAAA | `billing` | o IPv6 mostrado por `fly ips list` |

Espere a propagação e confira o certificado. Pode levar até algumas horas.

```bash
fly certs check billing.localneuron.ai -a localneuron-billing
curl -fsS https://billing.localneuron.ai/health
```

A resposta esperada é `{"ok":true}`.

## 6. Webhook

O endpoint é `https://billing.localneuron.ai/billing/webhook`. A versão da API tem de ser `2025-03-31.basil`, a mesma que o serviço envia. Cadastre só estes seis eventos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

No painel, ainda em **Test mode**: **Developers → Webhooks → Add endpoint**. Cole a URL, escolha a versão `2025-03-31.basil` e marque os seis eventos. Abra o endpoint e revele o segredo de assinatura (começa com `whsec_`). Ele aparece para cópia nessa tela.

Pelo CLI, no modo de teste:

```bash
stripe webhook_endpoints create \
  -d url="https://billing.localneuron.ai/billing/webhook" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d api_version="2025-03-31.basil"
```

Copie o campo `secret` da resposta para o shell e atualize o Fly. Isso reinicia a máquina. Faça isso antes do checklist.

```bash
export STRIPE_WEBHOOK_SECRET="cole_o_whsec_de_teste"
fly secrets set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" -a localneuron-billing
```

Não use `stripe listen` como endpoint definitivo. Esse comando é só um encaminhamento local.

## 7. Portal do cliente

O aplicativo abre o portal padrão da conta. Não manda um `customer` escolhido pelo navegador. Em **Test mode**, abra **Settings → Billing → Customer portal** e salve a configuração padrão assim:

- atualizar meio de pagamento: ligado;
- histórico de faturas: ligado;
- cancelar assinatura: ligado, **no fim do período** (`at_period_end`), não na hora;
- alterar quantidade: desligado;
- trocar de preço ou de produto: desligado.

O CLI equivalente, se você for marcar o resultado como padrão no painel em seguida:

```bash
stripe billing_portal configurations create \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[invoice_history][enabled]=true" \
  -d "features[customer_update][enabled]=false" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_cancel][mode]=at_period_end" \
  -d "features[subscription_update][enabled]=false"
```

Pix não entra neste fluxo. A assinatura é recorrente e o Checkout pede cartão, inclusive nos 7 dias grátis. A cobrança do plano escolhido começa quando o teste termina, se a pessoa não cancelar antes.

## 8. Preencher subscription-config.json

O arquivo no repositório permanece assim até você decidir publicar a cobrança no aplicativo:

```json
{
  "serviceUrl": null,
  "publicKey": null
}
```

Enquanto os dois estiverem nulos, Meu plano não mostra a escolha Mensal/Anual nem o botão de pagamento. Para ligar, numa versão que você vá empacotar:

```json
{
  "serviceUrl": "https://billing.localneuron.ai",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nCOLE_O_PEM_PUBLICO_EM_UMA_LINHA_COM_\\n\n-----END PUBLIC KEY-----\n"
}
```

`serviceUrl` é só a origem, sem caminho. `publicKey` é o conteúdo de `license-public.pem`, com as quebras de linha escritas como `\n`. Não coloque a chave privada neste arquivo. Os dois campos entram juntos.

```bash
node scripts/validate-subscription.mjs
```

Se o comando aceitar, reconstrua os pacotes do aplicativo. Sem esse arquivo preenchido e sem um pacote novo, o app instalado continua no Grátis.

## 9. Checklist do modo de teste

Use só cartões de teste. Nenhum `sk_live_` neste passo.

- `curl -fsS https://billing.localneuron.ai/health` devolve `{"ok":true}`.
- No aplicativo configurado, Meu plano mostra **Mensal R$ 29,90**, **Anual R$ 299 (economize ~2 meses)** e **7 dias grátis**.
- Com `serviceUrl` nulo, esses botões continuam ocultos ou desligados e nenhuma cobrança é criada.
- Mensal abre Checkout de assinatura em R$ 29,90, com 7 dias de teste e cartão obrigatório.
- Anual abre Checkout de assinatura em R$ 299,00, com 7 dias de teste.
- A mesma instalação, numa segunda abertura, não ganha outro teste.
- Cartão `4242424242424242`: assinatura fica `trialing` e **Atualizar assinatura** libera o Pro.
- Cartão `4000002500003155`: autenticação adicional.
- Fechar a janela sem pagar não libera o Pro.
- Duplo clique não cria duas sessões válidas ao mesmo tempo.
- Interromper a rede depois de criar o Checkout não apaga uma licença que já era válida.
- Ao fim dos 7 dias, a fatura do plano escolhido é cobrada. Cartão `4000000000000341` recusa a cobrança e o Pro deixa de renovar depois da sincronização.
- Portal: trocar o cartão e cancelar a próxima renovação, mantendo o período já concedido.
- Reenviar o mesmo evento de webhook não muda o estado.
- Reiniciar o app no Fly e o aplicativo de mesa.
- Ficar sete dias sem rede: a licença offline vale no máximo sete dias e não passa do fim do teste ou do período pago. Ao voltar, **Atualizar assinatura** renova a validação.

Os 7 dias grátis são o período de teste da Stripe. Os até 7 dias sem rede são a validade da licença offline. São prazos diferentes.

Defina termos, suporte para perda da instalação e política de reembolso antes de vender em escala. Reembolso isolado não encerra a assinatura: cancele na Stripe conforme a política. Uma licença já emitida pode continuar offline até expirar.

## 10. Passar para o modo ao vivo

Só depois do checklist. O modo ao vivo é outro conjunto de objetos na mesma conta.

1. No painel, desligue **Test mode**.
2. Crie de novo o produto `LocalNeuron Pro` e os dois preços: BRL 2990 por mês e BRL 29900 por ano, fixos, por unidade, sem uso medido. Os `price_` ao vivo são outros.
3. Crie outro endpoint de webhook para `https://billing.localneuron.ai/billing/webhook`, versão `2025-03-31.basil`, com os mesmos seis eventos. O `whsec_` ao vivo é outro.
4. Salve o portal padrão ao vivo com as mesmas regras do passo 7.
5. Troque os segredos. Mantenha o mesmo par Ed25519, para as licenças de teste já emitidas continuarem verificáveis. Só gere outro par se você quiser invalidar todas as licenças.

```bash
export STRIPE_SECRET_KEY="cole_a_chave_secreta_ao_vivo"
export STRIPE_WEBHOOK_SECRET="cole_o_whsec_ao_vivo"
export STRIPE_MONTHLY_PRICE_ID="price_mensal_ao_vivo"
export STRIPE_YEARLY_PRICE_ID="price_anual_ao_vivo"
fly secrets set \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  STRIPE_MONTHLY_PRICE_ID="$STRIPE_MONTHLY_PRICE_ID" \
  STRIPE_YEARLY_PRICE_ID="$STRIPE_YEARLY_PRICE_ID" \
  -a localneuron-billing
fly logs -a localneuron-billing
```

A chave ao vivo começa com `sk_live_`. Se o serviço recusar iniciar, o preço ao vivo não está na lista (2990 mensal ou 29900 anual, BRL).

6. Confirme `https://billing.localneuron.ai/health`.
7. Preencha `subscription-config.json` como no passo 8, valide e publique um pacote novo do aplicativo.
8. Faça uma compra real pequena, confira o Pro em `trialing` e cancele ou reembolse conforme a política. Não deixe `price_` de teste nos segredos ao vivo.

## Referências

- [Operação da assinatura](subscription-operations.md)
- [Domínio na Name.com](dominio-namecom.md)
- [Fly.io: fly.toml](https://docs.fly.io/reference/configuration)
- [Fly.io: volumes](https://fly.io/docs/volumes/)
- [Stripe: assinaturas e webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe: portal do cliente](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe: versões da API](https://docs.stripe.com/api/versioning)
