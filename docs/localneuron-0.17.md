# LocalNeuron 0.17 · Central Pro

O Pro passa a reunir projetos, contexto, entregas e acompanhamento em uma central própria. Continua sendo uma assinatura mensal de recursos locais. Não inclui máquinas na nuvem, créditos de serviços externos ou uma garantia de velocidade ou qualidade dos modelos.

## Recursos novos

1. **Central Pro:** visão geral com projetos recentes, documentos, entregas concluídas, tempo médio e acesso às ferramentas.
2. **12 atalhos iniciais:** briefing, comparação, reunião em ações, estudos, revisão editorial, calendário, revisão de código, plano de testes, pesquisa, roteiro, FAQ e proposta.
3. **Atalhos pessoais:** até 100 pedidos reutilizáveis, salvos com os dados do Pro e incluídos no backup cifrado. Busca por nome, conteúdo e categoria. Preparar um atalho não executa a IA automaticamente.
4. **Central de tarefas:** fila e histórico em um só painel, com estado, etapa, número de chamadas e duração real.
5. **Prioridades:** alta, normal e baixa. A prioridade altera a ordem de início; tarefas de mesma prioridade mantêm a ordem de chegada. Uma tarefa já iniciada não é interrompida por outra de prioridade maior.
6. **Pausa da fila:** impede novas tarefas de começar. Uma tarefa ativa continua até terminar ou ser cancelada. A preferência de pausa persiste localmente; ao fechar o app, tarefas pendentes continuam marcadas como interrompidas e exigem nova execução explícita.
7. **Modo Rápido:** uma passagem, raciocínio baixo quando suportado e até 1.024 tokens de resposta, respeitando um perfil que tenha limite menor.
8. **Modo Equilibrado:** uma passagem usando o perfil do modelo e instruções da tarefa.
9. **Modo Com revisão:** duas passagens pelo mesmo modelo. A segunda recebe o pedido original, as mesmas referências disponíveis e uma parte limitada da primeira versão. A primeira versão fica preservada. Pode levar mais tempo e manter erros; não é avaliação independente nem pesquisa extra na internet.
10. **Estilo e idioma:** claro, executivo, técnico ou criativo; português, inglês ou espanhol. São instruções ao modelo, sujeitas às capacidades dele.
11. **Rascunhos por projeto:** pedido, modelo, assistente e ajustes de entrega reaparecem ao retornar à área de trabalho. Guardados no armazenamento local do navegador, fora do backup do Pro; a permissão de internet não é habilitada automaticamente ao restaurar o rascunho.
12. **Modo foco:** amplia o documento e recolhe a navegação interna e a conversa. Cmd/Ctrl+S salva versão e Cmd/Ctrl+Enter envia o pedido da área de trabalho.
13. **API com limites editáveis:** até 100 chaves por instalação, capacidade já existente agora explicitada; nome, cota diária e máximo de tokens podem ser alterados sem trocar o segredo.
14. **Pausa por chave:** bloqueia novas chamadas daquela chave, incluindo as que ainda esperam na fila; uma resposta iniciada termina normalmente. A cota é por dia UTC, não por horário local. O painel mostra uso do dia e barra de cota.
15. **Apresentação de assinatura:** comparação atualizada entre Grátis e Pro, entrada para a central quando ativa, temas claro/escuro e layout adaptado ao celular.

## Usar

Abra **Central Pro**, crie ou selecione um projeto e importe documentos. Em **Atalhos de trabalho**, prepare um pedido e adapte-o ao objetivo. Na **Área de trabalho**, escolha o modelo e o modo da entrega; habilite internet explicitamente para pesquisa. Em **Central de tarefas**, acompanhe, altere a prioridade de itens pendentes ou pause a fila. As saídas continuam disponíveis no projeto e podem ser revisadas e exportadas no editor.

Na **Minha API**, abra **Editar acesso e limites** na chave desejada. O segredo existente continua válido depois de editar os limites. Nenhuma porta do roteador é aberta automaticamente. A fila da API continua limitada a 20 chamadas e 30 segundos de espera; o motor local processa uma resposta por vez.

## Limites e validação

- O histórico mantém até 100 tarefas. As métricas consideram somente os registros retidos; não são telemetria remota nem faturamento. A duração inclui preparação local e chamadas, excluindo espera na fila. Tarefas antigas sem marcação de início/fim não entram na média.
- Em lotes, cada documento recebe uma ou duas passagens conforme o modo; a comparação preservada na ficha é a primeira versão do último item processado. Resultados finais anteriores do lote continuam guardados.
- O modelo e o hardware continuam determinando as capacidades. Não foram alterados os pesos, as revisões dos motores ou o desempenho do Grátis. Há limites de RAM e contexto; nenhum recurso promete perfeição.
- 107 testes automatizados passaram, incluindo prioridades, pausa, revisão, cancelamento, atalhos em backup, limites/pausa da API e bloqueio HTTP das novas mutações premium.
- Qwen3-0.6B executou uma tarefa real pelo formulário com duas passagens, ambas respondendo 17 + 25 = 42; primeira versão, resultado e métricas foram persistidos. Isso verifica funcionamento, não uma melhoria medida de qualidade.
- Interface conferida em 1440 px e 390 px, claro/escuro, com preparação de atalho, rascunho preservado, criação de atalho próprio, edição/pausa de chave, modo foco e estados ativo/encerrado da assinatura. Não foram observados erros de console no fluxo final.
- A configuração comercial desta distribuição continua vazia: **não há cobrança real ativada**. O Pro foi validado em uma área isolada com licença de teste assinada; nenhuma licença de teste ou chave privada foi incluída no aplicativo. Para vender, ainda é necessário configurar e homologar o serviço de assinatura e o preço comercial.
- Pacotes Windows/Linux são montados no Mac; execução nativa nessas plataformas permanece pendente.

Os três pacotes 0.17 foram comparados byte a byte com a fonte final. ZIPs e TAR passaram na verificação; assinatura ad hoc do Mac extraído válida. Os 1.004 arquivos do manifesto de preservação ficaram inalterados antes da reabertura. O aplicativo voltou à tela bloqueada com a navegação Central Pro, servindo os cinco arquivos atualizados da experiência premium. Nenhuma licença de teste foi instalada nos dados do usuário.
