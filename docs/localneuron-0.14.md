# LocalNeuron 0.14 — assinatura Pro mensal

O Pro passa a ser um plano do aplicativo. A antiga página Pro agora se chama **Projetos**; **Meu plano** mostra a divisão de recursos, o status da assinatura e sua validade offline. O ícone foi preservado.

## Produto

| Grátis | Pro mensal |
| --- | --- |
| Downloads e motores llama.cpp/MLX completos | Tudo do Grátis |
| Chat, voz, anexos, memória e controles manuais | Ajuste automático de contexto: economizar RAM, equilibrado ou ampliado |
| Ferramentas com permissões e pesquisa no chat | Projetos com documentos, assistentes e pesquisa com fontes |
| Geração e edição básica de mídia | Storyboard, narração, legendas, máscaras e ferramentas avançadas |
| Uma chave de API | Chaves individuais, quotas e fila de chamadas |
| Leitura, edição manual, backup e exportação dos trabalhos existentes | Novos projetos, tarefas em lote, fila e perfis por modelo |

Não há redução artificial da velocidade ou da qualidade dos motores gratuitos. O Pro melhora o contexto, a organização e os recursos do aplicativo. Não transforma um modelo pequeno em um modelo maior nem acrescenta RAM ao computador. Não há cobrança por mensagem local; serviços de terceiros e licenças dos modelos não estão incluídos.

**Preço:** ainda não publicado. R$ 29,90/mês foi uma sugestão anterior, e não um preço comercial configurado. O lançamento desta versão usa somente plano mensal; não oferece cobrança anual, vitalícia ou créditos de inferência. O valor real aparece no Checkout antes do pagamento e é definido por um único `priceId` mensal no serviço do publicador.

## Comportamento implementado

- A licença Ed25519 é verificada no backend local. A interface não pode liberar endpoints premium apenas mudando um campo no navegador.
- Cancelar a próxima renovação mantém o acesso até o fim do período pago. Pagamento pendente ou assinatura encerrada desativa novas operações premium após sincronização.
- A licença offline vale por até sete dias, sem ultrapassar o período pago. A consulta de Meu plano tenta atualizá-la uma vez por dia quando há validação anterior; falhas de rede preservam a licença ainda válida. A atualização manual também está disponível.
- Expiração não apaga dados. Projetos existentes continuam editáveis manualmente e exportáveis, inclusive DOCX/XLSX/PPTX. Backup/restauração, cancelamento de tarefas e revogação de chaves continuam disponíveis.
- Uma tarefa já iniciada pode terminar; tarefas premium na fila aguardam uma licença válida. Chaves Pro da API são verificadas antes de iniciar cada geração, inclusive após esperar na fila. A chave básica continua funcionando.
- O modo automático do chat estima a margem de RAM, limita contexto/saída e tenta manter um contexto carregado compatível. O perfil resultante fica salvo por modelo e também pode orientar tarefas em Projetos. O motor ainda realiza sua própria checagem de memória. Não foi medido um ganho universal de velocidade.
- Sem assinatura, um chat que usava ajuste automático volta ao modo manual; o texto digitado não é descartado.

## Cobrança: preparada, ainda não ativada

`subscription-config.json` está sem serviço e sem chave pública. O pacote inicia no Grátis; os botões de compra informam que a venda está em preparação. Não existem contas Stripe, produtos, cobranças ou assinaturas reais criados por esta alteração.

O serviço separado `src/billing-service.ts` implementa Checkout mensal, portal do cliente, verificação de webhook, idempotência e emissão de licenças. Usa SQLite persistente no servidor do publicador e a API Stripe fixada em `2025-03-31.basil`. Ele consulta a assinatura atual, o preço esperado e a última fatura paga; não libera acesso por uma URL de sucesso ou pelo conteúdo antigo de um evento.

Os testes usam um adaptador Stripe simulado. Ainda é necessário executar a homologação com uma conta Stripe em modo de teste, configurar o portal para cancelamento no fim do período, hospedar o serviço e só então habilitar produção. Veja [configuração comercial](subscription-operations.md).

## Limites explícitos

- O processamento das IAs continua independente e local; a confirmação de pagamento depende do serviço de assinatura e da Stripe.
- Licença vinculada à instalação, não a uma conta de usuário com login. Recuperação após perda dos dados da instalação e transferência entre computadores ainda precisam de um fluxo comercial de suporte antes de venda ampla.
- Revogação offline pode demorar até o fim da licença de sete dias. Cancelamento de renovação não revoga o período já pago.
- A aplicação é local e tem código acessível: o controle protege a distribuição oficial, não é DRM impossível de modificar. Nenhuma chave privada de assinatura acompanha os pacotes.
- Windows e Linux recebem pacotes, mas a execução nativa continua pendente de validação nesses sistemas.
