# LocalNeuron 0.27 — acesso, equipe e atualizações

Esta versão corrige os problemas do primeiro acesso e simplifica a ativação dos especialistas.

- **Lembrar o acesso:** opção no login desktop para guardar a credencial cifrada pelo armazenamento seguro do sistema. É opcional. Bloquear aplicativo mantém a sessão bloqueada, inclusive após recarregar a janela. Pode ser desativado em Preferências. No navegador, a entrada continua usando senha.
- **Wizard persistente:** chegar ao final salva a conclusão. Repetir a configuração preserva essa conclusão, o perfil anterior, as conversas e os bots. Instalações que estavam no último passo da versão anterior são reconhecidas como configuradas.
- **Equipe em um clique:** ative os seis especialistas de trabalho, os quatro auxiliares pessoais ou os dez juntos. Uma IA instalada é compartilhada. A seleção automática usa as recomendações de memória e prioriza o maior modelo instalado elegível; não baixa modelos sem escolha do usuário. Bots personalizados mantêm seus modelos e configurações.
- **Tarefas de verdade no chat:** cada especialista possui três sugestões e um método de trabalho. Dar uma tarefa prepara a IA, cria uma conversa do bot e inicia a execução pelo mesmo agente do chat, com acompanhamento, parada e revisão de ferramentas. Escrever um rascunho não depende de autorização para publicá-lo.
- **Métodos atualizáveis:** ativar novamente atualiza as instruções antigas que ainda são as originais. Instruções personalizadas e memória são preservadas. Também há uma atualização manual em Mais opções da equipe.
- **Contexto:** a reserva de resposta se adapta ao espaço disponível após as instruções e a última pergunta. Evita recusar tarefas curtas por uma reserva excessiva em modelos de contexto pequeno.
- **Aviso de versões:** consulta o manifesto público do GitHub ao abrir e a cada seis horas, com cache. Mostra as novidades e o link do instalador. Agora não dispensa aquela versão; a próxima versão volta a avisar. A consulta pode ser desativada e falhas de rede não impedem uso offline.
- **UX/UI:** equipes por área, estado da IA por bot, tarefas sugeridas, modelos compartilhados e preferências de acesso/versão em locais visíveis. Modos claro e escuro e layout responsivo.

## Limites desta versão

A ativação prepara os bots; não começa trabalho permanente sem uma tarefa. Não equivale a funcionários autônomos operando contas externas. Conexões MCP, acesso a pastas e permissões continuam sendo configurados pelo usuário. Publicações, comandos e alterações passam pelos controles de revisão existentes. Qualidade e uso correto de ferramentas dependem da capacidade do modelo; modelos muito pequenos podem produzir respostas inadequadas.

A atualização não se instala sozinha. Para receber os próximos avisos, quem está na 0.26 ou anterior precisa instalar a 0.27 uma vez. Preserve a pasta de dados ao substituir o aplicativo. O pacote Mac permanece com assinatura ad hoc, sem notarização Apple; Windows/Linux ainda precisam de execução nativa de validação.
