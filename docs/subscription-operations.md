# Operação da assinatura Pro

Esta configuração é feita pelo publicador. Os assinantes usam somente **Meu plano** e escolhem **Mensal R$ 29,90** ou **Anual R$ 299**; não precisam configurar motores, Stripe ou variáveis. O passo a passo de hospedagem em `billing.localneuron.ai` está em [billing-deploy.md](billing-deploy.md).

## Serviço do publicador

1. Na conta Stripe do Brasil, de pessoa física (CPF), use um produto LocalNeuron Pro e dois preços recorrentes aprovados pelo proprietário: **R$ 29,90 por mês (BRL, 2990 centavos)** e **R$ 299 por ano (BRL, 29900 centavos)**. Os dois são preço fixo por unidade, quantidade 1, sem medição de uso ou transformação de quantidade. O serviço recusa iniciar se algum dos dois estiver fora dessa lista. Os dois planos têm **7 dias grátis**, uma vez por instalação ou por cliente da Stripe. Configure o portal para permitir atualização do meio de pagamento e cancelamento no fim do período, sem alteração da quantidade ou troca para outros preços.
2. Em um servidor Node 24 com armazenamento persistente, gere o par Ed25519 fora do repositório: `npm run license-keys`. A chave privada fica em `~/.localneuron/license-private.pem` e não entra no Git nem na imagem. A chave pública é a única que pode ir para `subscription-config.json`.
3. Configure no ambiente do servidor: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_YEARLY_PRICE_ID`, `LOCALNEURON_LICENSE_PRIVATE_KEY_FILE`, `LOCALNEURON_BILLING_DB` e `LOCALNEURON_BILLING_PUBLIC_URL`. Esta última é uma origem HTTPS, sem caminho. Nunca coloque esses segredos no cliente ou em mensagens de chat.
4. Compile com `npm run build` e execute `npm run billing`. No computador do publicador o serviço escuta apenas `127.0.0.1:4330`; coloque um proxy HTTPS na frente. No Fly.io o mesmo processo escuta em `0.0.0.0:4330`, atrás do proxy da plataforma. Use um único processo com disco persistente, supervisão, backups do SQLite e limites de tráfego no proxy. A porta pode ser definida por `LOCALNEURON_BILLING_PORT` e o endereço por `LOCALNEURON_BILLING_HOST`. Fora do Fly, o serviço reconhece cabeçalhos de proxy somente de loopback.
5. Cadastre o endpoint HTTPS `/billing/webhook` e eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`. A verificação usa o corpo original e tolerância de cinco minutos.
6. Configure no cliente **somente** `subscription-config.json`: `serviceUrl` com a origem HTTPS e `publicKey` com o PEM público. O empacotamento valida o arquivo e rejeita campos extras ou chaves privadas. Reconstrua os pacotes depois de configurar.

O fluxo registra uma instalação por identificador aleatório e segredo local; o servidor guarda apenas o hash do segredo. O Checkout coleta os dados de pagamento na Stripe. O portal deriva o cliente da instalação autenticada: não aceita um `customerId` escolhido pelo navegador. O serviço de pagamento não recebe conversas, arquivos ou nomes de modelos.

## Homologação obrigatória antes da venda

Em modo de teste da Stripe, verifique: Mensal R$ 29,90 e Anual R$ 299; 7 dias grátis na primeira abertura; a mesma instalação não recebe um segundo teste; compra com autenticação adicional; janela fechada sem pagar; duplo clique; rede interrompida após criar Checkout; Pro liberado enquanto o status é `trialing`; cobrança ao fim do teste; renovação; fatura recusada; recuperação do pagamento; cancelamento no fim do período; eventos repetidos/fora de ordem; reinício do serviço e do aplicativo; sete dias sem rede e retorno à rede.

Também defina termos comerciais, suporte para recuperação/transferência da instalação e política de reembolso. O reembolso isolado não encerra automaticamente a assinatura: o operador precisa cancelar/revogar a assinatura conforme a política adotada. Licenças já emitidas podem continuar offline até expirar.

O site público está em `https://localneuron.ai`, com HTTPS ativo. O proprietário confirmou uma conta Stripe existente, de pessoa física (CPF) no Brasil, e aprovou **R$ 29,90/mês** ou **R$ 299/ano**, com **7 dias grátis** nos dois. O cadastro desses preços, a hospedagem em `billing.localneuron.ai` e a homologação real no modo de teste ainda precisam ser concluídos pelo publicador; este repositório não cria conta, chave nem deploy. O site estático no GitHub Pages não executa o serviço de cobrança. Não publique um link de pagamento avulso sem o vínculo com a instalação: ele não libera o Pro neste protocolo. O aplicativo não solicita cartão enquanto a configuração está vazia.

## Referências de implementação

- [Stripe: eventos e ciclo de vida das assinaturas](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe: portal do cliente](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe: versões da API](https://docs.stripe.com/api/versioning)

Checkout usa `mode=subscription`, o plano `monthly` ou `yearly` escolhido no aplicativo e o preço correspondente no servidor. A primeira abertura do Checkout reserva os 7 dias grátis (`subscription_data.trial_period_days=7`) daquela instalação. Uma assinatura `trialing` emite licença ativa até o fim do teste, no máximo sete dias, sem exigir fatura paga. Depois do teste, o acesso pago continua exigindo a fatura paga. Eventos não são tratados como prova independente de acesso: uma consulta atual à Stripe confirma vínculo da instalação, cliente, preço e o estado vigente. Nenhuma licença é emitida pela página de sucesso.
