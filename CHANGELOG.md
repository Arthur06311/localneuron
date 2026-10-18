# Changelog

Registro das versões publicadas do LocalNeuron. O fluxo de release só continua quando três valores são iguais: a tag `vX.Y.Z`, o campo `version` de `package.json` e a seção `## [X.Y.Z]` deste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Adicionado

- Workflow de release no GitHub Actions, disparado pela tag `vX.Y.Z` ou manualmente. Ele gera o AppImage Linux e o instalador NSIS Windows com o Electron Packager que o repositório já usa, anexa `SHA256SUMS.txt` e abre a GitHub Release em rascunho. Não assina código e não usa segredo.

### Corrigido

- O aviso de atualização reconhece os artefatos deste fluxo (`LocalNeuron-Linux-x64.AppImage` e `LocalNeuron-Windows-x64-Setup.exe` na tag `vX.Y.Z`) e os pacotes já publicados: DEB e Arch em `v0.27.0-linux.3`, DMG e ZIP em `v0.26.0`.
- O aviso só aparece quando há um instalador mais novo para o sistema e a arquitetura atuais. Um pacote só de Linux não abre o aviso no Mac nem no Windows.
- `website/downloads.json` e `website/releases.json` passam a ser gerados de `website/release-source.json`, para os dois não divergirem.

## [0.27.0] - 2026-09-17

### Adicionado

- Opção de lembrar o acesso no aplicativo, com a credencial cifrada pelo armazenamento seguro do sistema. Bloquear o aplicativo mantém a sessão bloqueada, inclusive depois de recarregar a janela. A opção pode ser desligada em Preferências. No navegador, a entrada continua pedindo senha.
- Ativação da equipe em um clique: os seis especialistas de trabalho, os quatro auxiliares pessoais ou os dez juntos. Uma IA já instalada é compartilhada. A seleção automática usa as recomendações de memória e o maior modelo instalado elegível. Nenhum modelo é baixado sem escolha de quem usa. Bots personalizados mantêm seus modelos e configurações.
- Tarefas no chat: cada especialista tem três sugestões e um método de trabalho. Dar uma tarefa prepara a IA, abre uma conversa do bot e usa o mesmo agente do chat, com acompanhamento, parada e revisão de ferramentas. Escrever um rascunho não depende de autorização para publicá-lo.
- Aviso de versão nova ao abrir o aplicativo e a cada seis horas, com cache, notas e link do instalador. Dispensar o aviso vale só para aquela versão; a próxima volta a avisar. A consulta pode ser desligada. Falha de rede não impede o uso offline.

### Alterado

- O assistente de primeira configuração grava a conclusão ao chegar ao fim. Repetir a configuração preserva essa conclusão, o perfil anterior, as conversas e os bots. Instalações que estavam no último passo da versão anterior são reconhecidas como configuradas.
- Ativar a equipe de novo atualiza instruções antigas que ainda são as originais. Instruções personalizadas e a memória são preservadas. Também há atualização manual em Mais opções da equipe.
- A reserva de resposta passa a usar o espaço que sobra depois das instruções e da última pergunta, para não recusar uma tarefa curta em modelo de contexto pequeno.
- Equipes por área, estado da IA por bot, tarefas sugeridas, modelos compartilhados e preferências de acesso e versão ficam em locais visíveis, nos modos claro e escuro.

### Limitações

- A ativação prepara os bots. Não começa trabalho permanente sem uma tarefa e não opera contas externas sozinha. Conexões, pastas e permissões continuam a cargo de quem usa o aplicativo. Publicações, comandos e alterações passam pela revisão já existente. A qualidade depende do modelo; modelos muito pequenos podem responder mal.
- A atualização não se instala sozinha. Quem está na 0.26 ou anterior precisa instalar a 0.27 uma vez. A pasta de dados existente deve ser preservada.
- O pacote macOS desta linha segue com assinatura ad hoc, sem notarização Apple. O instalador Windows gerado pelo fluxo de release sai sem assinatura de código.
