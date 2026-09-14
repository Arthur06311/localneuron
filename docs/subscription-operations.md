# Operação da assinatura mensal

Esta configuração é feita pelo publicador. Os assinantes usam somente **Meu plano → Assinar Pro mensal**; não precisam configurar motores, Stripe ou variáveis.

## Serviço do publicador

1. Em uma conta Stripe própria, crie um produto LocalNeuron Pro e um preço recorrente mensal. Defina o valor aprovado e a moeda. Configure o portal para permitir atualização do meio de pagamento e cancelamento no fim do período, sem troca para preços não suportados.
2. Em um servidor Node 24 com armazenamento persistente, gere um par Ed25519. Guarde a chave privada fora do repositório e dos pacotes. Por exemplo: `openssl genpkey -algorithm ED25519 -out /caminho-privado/license-private.pem`, seguido de `openssl pkey -in /caminho-privado/license-private.pem -pubout -out /caminho-publico/license-public.pem`. A chave privada deve ter acesso restrito ao serviço.
3. Configure no ambiente do servidor: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `LOCALNEURON_LICENSE_PRIVATE_KEY_FILE`, `LOCALNEURON_BILLING_DB` e `LOCALNEURON_BILLING_PUBLIC_URL`. Esta última é uma origem HTTPS, sem caminho. Nunca coloque esses segredos no cliente ou em mensagens de chat.
4. Compile com `npm run build` e execute `npm run billing`. O serviço escuta apenas `127.0.0.1:4330`; coloque um proxy HTTPS na frente. Use um único processo com disco persistente, supervisão, backups do SQLite e limites de tráfego no proxy. A porta pode ser definida por `LOCALNEURON_BILLING_PORT`. O serviço reconhece cabeçalhos de proxy somente de loopback.
5. Cadastre o endpoint HTTPS `/billing/webhook` e eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`. A verificação usa o corpo original e tolerância de cinco minutos.
6. Configure no cliente **somente** `subscription-config.json`: `serviceUrl` com a origem HTTPS e `publicKey` com o PEM público. O empacotamento valida o arquivo e rejeita campos extras ou chaves privadas. Reconstrua os pacotes depois de configurar.

O fluxo registra uma instalação por identificador aleatório e segredo local; o servidor guarda apenas o hash do segredo. O Checkout coleta os dados de pagamento na Stripe. O portal deriva o cliente da instalação autenticada: não aceita um `customerId` escolhido pelo navegador. O serviço de pagamento não recebe conversas, arquivos ou nomes de modelos.

## Homologação obrigatória antes da venda

Em modo de teste da Stripe, verifique: compra com autenticação adicional; janela fechada sem pagar; duplo clique; rede interrompida após criar Checkout; pagamento confirmado; renovação; fatura recusada; recuperação do pagamento; cancelamento no fim do período; eventos repetidos/fora de ordem; reinício do serviço e do aplicativo; sete dias sem rede e retorno à rede.

Também defina termos comerciais, suporte para recuperação/transferência da instalação e política de reembolso. O reembolso isolado não encerra automaticamente a assinatura: o operador precisa cancelar/revogar a assinatura conforme a política adotada. Licenças já emitidas podem continuar offline até expirar.

Não foi provisionado domínio, hospedagem, conta de pagamentos ou cobrança real nesta versão. O preço sugerido de R$ 29,90/mês não foi cadastrado. O aplicativo não solicita cartão enquanto a configuração está vazia.

## Referências de implementação

- [Stripe: eventos e ciclo de vida das assinaturas](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe: portal do cliente](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe: versões da API](https://docs.stripe.com/api/versioning)

Checkout usa `mode=subscription` e um preço escolhido pelo servidor. Eventos não são tratados como prova independente de acesso: uma consulta atual à Stripe confirma vínculo da instalação, cliente, preço e fatura paga. Nenhuma licença é emitida pela página de sucesso.
