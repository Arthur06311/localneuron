# Instalação Linux e revisão do crash no Omarchy

## Instalar

Para instalar sem digitar comandos, baixe **LocalNeuron-Linux-x64-Instalar.zip** na [versão gráfica](https://github.com/Arthur06311/localneuron/releases/tag/v0.27.0-linux.2).

1. Extraia o ZIP e aguarde terminar.
2. Abra a pasta `LocalNeuron-Instalar`.
3. Dê dois cliques em **Instalar LocalNeuron** (`.desktop`).
4. Aguarde a instalação: o app abre automaticamente ao concluir.

O gerenciador de arquivos pode pedir uma vez “Permitir executar” ou “Confiar e iniciar”. O pacote preserva as permissões de execução, mas não altera a política de confiança do desktop. Com Zenity, aparece uma janela de progresso. Sem Zenity, um terminal gráfico compatível realiza tudo automaticamente, sem comandos para digitar. Erros e cancelamento não iniciam o aplicativo. Nenhuma inicialização automática ao ligar o computador é cadastrada.

Também existe o **LocalNeuron-Linux-x64.run**, para uso pelo terminal. Aguarde o download terminar e execute:

```bash
bash LocalNeuron-Linux-x64.run
```

Não use `sudo`. Ao aparecer “instalado”, procure **LocalNeuron** no menu de aplicativos do Omarchy, GNOME ou KDE. Não é necessário abrir o executável dentro de uma pasta extraída. O modo de terminal `.run --install` não abre o app; o instalador gráfico ZIP abre depois da conclusão.

Para conferir somente o download:

```bash
bash LocalNeuron-Linux-x64.run --check
```

O SHA-256 publicado ao lado do instalador permite comparação independente. O hash incorporado detecta download truncado ou corrompido; não é uma assinatura digital do autor.

## O que muda

1. Verifica tamanho e SHA-256 do conteúdo antes de extrair.
2. Extrai em uma pasta temporária oculta no mesmo sistema de arquivos da instalação.
3. Confere o manifesto de todos os arquivos, incluindo snapshots do V8, recursos e executável.
4. Publica a pasta completa e troca o destino `current` por renomeação atômica.
5. Só então registra o atalho do menu, com o ícone do app.

Uma instalação interrompida não substitui a versão anterior. Duas instalações simultâneas são impedidas por um lock. Versões anteriores ficam guardadas para não interromper um processo ainda aberto. Modelos, conversas e cofre não são removidos ou migrados pelo instalador.

Programa: `${XDG_DATA_HOME:-~/.local/share}/localneuron/`.

Dados existentes: `${XDG_CONFIG_HOME:-~/.config}/Colmeia/`, ou a pasta selecionada no app. O nome legado é mantido para preservar o espaço existente.

## Requisitos e diagnóstico

Linux x64 com glibc, sessão gráfica Wayland ou X11, bibliotecas do Electron e namespaces/sandbox compatíveis com a distribuição. Bash, GNU coreutils, tar, gzip e util-linux (flock) são necessários. O `.run` não exige FUSE, Node ou Python instalados na máquina do usuário. Modelos e drivers de aceleração são preparados separadamente.

```bash
"${XDG_DATA_HOME:-$HOME/.local/share}/localneuron/start" --diagnose
```

O launcher verifica os arquivos de inicialização e informa bibliotecas ausentes antes de executar o Electron. Logs de inicialização ficam em `${XDG_STATE_HOME:-~/.local/state}/localneuron/`. Antes de compartilhar logs, revise seu conteúdo e remova dados pessoais. O app continua em alfa; o instalador não equivale a homologação de GPU, áudio, todos os motores ou modelos.

O sandbox permanece ligado. Não há uso automático de `--no-sandbox`, alteração de permissões setuid ou mudança de configuração global do sistema. Em um erro específico de sandbox, confira a política de namespaces da sua distribuição. O Electron moderno suporta Wayland nativamente; não forçamos X11 nem alteramos a configuração do Hyprland. [Documentação Electron](https://www.electronjs.org/docs/latest/tutorial/sandbox), [Wayland no Electron](https://www.electronjs.org/blog/tech-talk-wayland).

Para remover apenas o programa, feche o app e apague a pasta `localneuron` dentro do diretório de dados XDG e o arquivo `applications/localneuron.desktop` desse mesmo diretório. Preserve `~/.config/Colmeia` e quaisquer pastas de modelos/dados escolhidas no aplicativo.

## Revisão do relato recebido em 20/09/2026

O relato informa `Error loading V8 startup snapshot file`, seguido de SIGTRAP, e que `v8_context_snapshot.bin` só terminou de ser extraído depois dos cliques que provocaram os crashes. Isso é consistente com inicialização prematura durante a extração. Não tivemos acesso ao journal/core ou ao computador do colega; os horários e a conclusão sobre ausência de perda de dados são evidências fornecidas por ele, não medições repetidas nesta revisão.

Mesmo sendo uma falha anterior à lógica do aplicativo, há um problema de experiência de instalação que cabe ao LocalNeuron corrigir. O `.run` elimina essa janela no fluxo normal: o usuário não recebe um executável parcialmente extraído para abrir. Além disso, a geração do instalador recusa bundles sem os snapshots, e o launcher confere esses arquivos antes de chamar o Electron.

O texto menciona a skill `/usr/share/omarchy/default/agents/skills/diagnose-crash/SKILL.md`. Ela pertence ao computador Linux do colega e não estava disponível no ambiente macOS desta revisão. Não foi executada aqui. Não há, no relato, evidência suficiente para atribuir esse crash ao Omarchy.

## Estado do harness

- **Navegador:** janela Electron dedicada, leitura de texto/controles e ações de clique/preenchimento. Não controla automaticamente a sessão pessoal do Chrome, nem oferece automação visual universal.
- **Computador nativo:** listar/ativar apps, digitar e pressionar teclas estão implementados apenas no macOS. No Linux, essas ferramentas não são anunciadas ao modelo. Controle completo de Hyprland/Wayland ainda não foi implementado.
- **MCP:** transportes HTTP e stdio, descoberta de ferramentas, autorização por conexão e OAuth quando suportado. Cada plataforma precisa de um servidor compatível e autorização real.
- **Métodos dos bots:** há playbooks internos por especialidade. Isso não é um carregador geral de skills `SKILL.md`; esse mecanismo ainda precisa ser implementado.
- **Agente:** executa ferramentas habilitadas com limites e revisão das ações. A qualidade depende da capacidade do modelo escolhido de usar ferramentas e seguir o contexto.

A correção deste instalador não anuncia novos poderes de controle de computador ou integrações inexistentes.

## Verificação desta entrega

Em 20/09/2026, os dez testes do instalador passaram em container Linux Debian x64 (emulação sobre Mac ARM). O instalador real de aproximadamente 289 MB passou na verificação SHA-256, instalação completa, conferência de todos os arquivos e criação do atalho, executado como usuário sem root e sem rede. O runtime Electron 44.3.0 / Node 24.20.0 executou SQLite e o backend instalado respondeu HTTP 200 no Linux. O atalho passou no validador desktop-file-validate. Build TypeScript e três testes do site também passaram. Isso valida o fluxo de instalação, não a interface gráfica, GPU ou áudio de uma máquina Omarchy física.

## Gerar e testar

`npm run package -- linux x64` agora gera a pasta Electron e o `.run` com checksum em `releases/`. Para empacotar uma pasta já construída:

```bash
python3 scripts/package-linux.py releases/LocalNeuron-linux-x64 \
  --arch x64 --output releases/LocalNeuron-Linux-x64.run
```

Em Linux, com usuário sem root:

```bash
npm run test:linux-installer
```

Os testes usam um executável de teste, sem abrir o Electron, para validar instalação, atualização, preservação de dados, concorrência, corrupção, download truncado e falha de extração. Testar a interface real no Omarchy, com seus drivers e modelos, continua sendo uma etapa separada.


### Verificação do instalador gráfico

O ZIP contém o mesmo `.run` verificado, a interface de instalação e um atalho `.desktop`. O payload é escrito primeiro no ZIP e o atalho por último. A interface acompanha o processo, pode interromper a extração e só abre o app após retorno bem-sucedido do instalador. Os testes usam diálogos controlados para verificar sucesso, erro, cancelamento e alternativa via terminal; a resolução do atalho é testada com GIO e desktop-file-validate em Linux. A aparência e integração final com o gerenciador de arquivos Omarchy ainda dependem de validação nessa máquina.
