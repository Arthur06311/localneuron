# Operação e recuperação

## Primeira execução

Crie a senha no onboarding e guarde-a em seu gerenciador de senhas. O cofre desta Alfa não tem recuperação administrativa. Nenhuma senha real é fornecida ou armazenada na documentação. O usuário deve criar a própria senha.

Para usar a interface equivalente no navegador: `npm run build`, `npm start` e `node scripts/open.mjs`. Ao reiniciar o serviço, abra novamente pelo iniciador: o token de sessão muda. Fechar apenas a aba não encerra o trabalho. Fechar o aplicativo Electron encerra seu serviço; uma tarefa interrompida será pausada na próxima abertura.

## Backup consistente

1. Pause tarefas em andamento e encerre o aplicativo/serviço.
2. Copie a pasta **inteira** do espaço: `.data`, `.desktop/workspace` ou `Colmeia-data/workspace`, conforme o modo de uso.
3. Preserve o cofre cifrado e o banco juntos. O download do cofre sozinho não inclui arquivos; exportação de auditoria também não é backup dos documentos.
4. Guarde a impressão digital e uma cabeça assinada em local independente para detectar apresentação de uma cópia antiga.
5. Para restaurar, use uma nova pasta, configure `COLMEIA_DATA_DIR` no modo navegador e abra com a mesma senha. Não sobreponha um banco em uso.

Os testes reabrem o banco persistido e verificam versões e assinaturas. Não houve exercício com backup real do usuário, perda física do dispositivo ou administração por terceiros.

## Tarefa interrompida

Ao desbloquear após interrupção, tarefas persistidas como `running` passam para `paused`, ganham uma geração nova e perdem as concessões anteriores. As reservas locais são liberadas. Nenhuma chamada externa paga existe nesta Alfa. O usuário revisa e autoriza a nova tentativa; não há repetição automática silenciosa.

## Integridade divergente

Se o selo de estado/log ou a exportação falhar, pare de usar o espaço. Preserve uma cópia dos arquivos para investigação. Restaure um backup confiável em outra pasta. Não edite hashes, apague entradas ou reemita um manifesto para esconder a divergência.

## Trava de processo

`server.lock` contém o PID do serviço. O servidor recusa iniciar quando aquele PID ainda existe. Depois de encerramento abrupto, remove automaticamente uma trava de PID inexistente. Em caso de reutilização de PID ou arquivo inválido, confirme que não existe serviço usando a pasta antes de retirar a trava manualmente. Nunca abra o PGlite simultaneamente em dois processos.

## Revogação

Revogar o agente pausa tentativas e impede novos commits, inclusive se uma resposta de modelo chegar depois. Versões e eventos anteriores permanecem verificáveis. A UI ainda não emite uma nova identidade; não revogue por engano em um espaço de trabalho que deseja continuar usando. Os testes de revogação usam espaços descartáveis.

## Publicação e distribuição

O bundle local não é um instalador homologado de produção. Assinatura Apple, notarização, atualizador, backup assistido, retenção legal, suporte de segundo sistema operacional e auditoria externa permanecem pendentes. A API administrativa permanece em loopback. Para inferência em outro computador, use Minha API em rede privada confiável ou VPN, conforme `minha-api.md`; o serviço usa HTTP e não configura exposição pública.


## Conversas e compartilhamento (0.4)

Parar interrompe a resposta; bloquear ou fechar também desliga Minha API. No próximo início, o cofre precisa da mesma senha e a API continua desligada. Regenerar conserva versões anteriores dentro da conversa. Excluir remove a conversa da projeção do aplicativo; backups, arquivos exportados e páginas do banco podem conservar conteúdo. O botão Liberar memória descarrega a instância, preservando o modelo no disco.


## Motor e arquivos do assistente (0.5)

Fechar ou bloquear encerra o motor integrado e desliga Minha API; o arquivo GGUF permanece no disco. O aplicativo não encerra o servidor externo do LM Studio. Ao reabrir, desbloqueie com a mesma senha e envie uma mensagem para preparar a IA integrada escolhida.

A pasta escolhida para ferramentas fica fora do banco: inclua-a separadamente em seus backups. Propostas já autorizadas podem ter alterado arquivos nessa pasta. Downloads da versão nova e da anterior ficam em `workspace/artifacts`; preservar a pasta completa do espaço inclui esses arquivos. Eles são cópias locais protegidas pelas permissões do sistema, não um backup cifrado independente.

Uma revisão expira após cinco minutos; Parar cancela a autorização pendente. Comandos de terminal exigem nova revisão por execução. Nenhuma autorização pendente é retomada automaticamente depois de reiniciar.
