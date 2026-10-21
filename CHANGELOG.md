# Changelog

As mudanças notáveis do LocalNeuron estão neste arquivo, no estilo [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

Cada entrada vem de uma fonte conferível: notas em `docs/localneuron-*.md`, a revisão `docs/release-readiness.md`, tags Git, `catalog/downloads.json`, `catalog/releases.json` ou `package.json` (versão atual `0.28.1`). Não há notas separadas da 0.22 à 0.26. As notas da 0.8 à 0.21 entraram no Git juntas no commit `26d2165` (14/09/2026); a data de criação do arquivo não é a data de cada versão, e por isso essas versões ficam sem data.

O fluxo de release só continua quando três valores são iguais: a tag `vX.Y.Z`, o campo `version` de `package.json` e a seção datada `## [X.Y.Z]` deste arquivo. A data pode usar hífen ou travessão.

## [Não publicado]

### Adicionado

- O Pro passa a oferecer Mensal R$ 20,00 ou Anual R$ 150 (cerca de 37% a menos, cerca de 4,5 meses), com 7 dias grátis, uma vez por pessoa e por cartão. O teste só fica reservado quando a assinatura existe. Cartão ou e-mail repetido, guardados só como HMAC, encerra o teste na hora. O portal só cancela a renovação e atualiza o pagamento. A cobrança roda em Edge Functions e Postgres no Supabase (`sa-east-1`) e continua desligada até `subscription-config.json` receber o serviço. O passo a passo está em `docs/billing-deploy.md`.
- A biblioteca quantiza um modelo já instalado, em GGUF com llama-quantize ou em MLX no Mac, e salva o resultado como outro modelo. O original permanece. A comparação das abordagens está em `docs/quantizacao.md`.
- Anexos de texto e PDF passam a ser divididos em trechos, indexados no computador e consultados na conversa. Sem um modelo de embeddings, os trechos ficam guardados e a busca semântica avisa que não está disponível (#46).
- O Modo servidor começa desligado e distingue Contribuir, Gerenciar e Só usar. O mapa lê o estado do EXO. RDMA permanece só como caminho futuro; a conexão desta fase é TCP (#57).
- O gateway do Modo servidor escuta só na rede local, na porta 52416, com pareamento por código de seis dígitos e chave por máquina. Enquanto o EXO está ligado, a porta 52415 continua sem senha (#59).
- O site ganha SEO, página 404 e a escolha do idioma pelo navegador (#62).
- A especificação da ilha Equipes entra em `docs/design/equipes/`, com marcas e mockup. Minha equipe permanece (#66).
- Quem ainda tem cofre com senha pode **Começar sem o cofre antigo**. A cópia datada fica guardada, o Chat abre com a chave da máquina, e a cópia pode ser importada depois, nas Configurações, com a senha (#69).

### Alterado

- As mensagens ao abrir um espaço dizem “banco de dados”.
- Uma conexão MCP pode ser editada em Conexões. Dá para corrigir o comando, os argumentos e a opção rede confiável. A validação é a mesma de uma conexão nova. O token permanece se o campo ficar vazio e o endereço não mudar de origem. Trocar a origem sem um token novo apaga o antigo. Remover token apaga o token guardado. A lista de conexões não devolve comando nem argumentos; eles só aparecem ao editar.
- O navegador da IA aplica a mesma política de endereço público ao WebSocket (`ws` e `wss`).
- Uma conexão MCP local deixa de aceitar um shell como comando (`/bin/bash`, `cmd.exe` e equivalentes). O comando precisa ser o caminho absoluto do programa, e os argumentos vão no campo separado. Uma conexão já salva que apontava para um shell falha no próximo teste até ser editada em Conexões: aponte o comando para o programa e passe os argumentos à parte.
- HTTPS de uma conexão MCP para IP privado ou VPN (Tailscale) só funciona se a conexão estiver marcada como rede confiável. A opção nasce desligada. Uma conexão antiga nessa situação pode ser editada em Conexões e marcada.

- O aplicativo abre direto no Chat, na primeira execução e na atualização. A confirmação da senha do cofre antigo deixa de aparecer: a cópia datada é guardada sozinha, sem pedir senha, código ou PIN, e pode ser importada depois em Configurações.
- O aplicativo abre direto, sem tela de desbloqueio; a chave do cofre fica no armazenamento seguro do sistema. Quem ainda tem senha confirma uma vez, e a interface deixa de oferecer desbloqueio e senha (#50).
- A ilha passa a se chamar Equipes, em pt-BR, com o visual grafite. Os identificadores internos continuam `crews` e `/v1/crews` (#58).
- O download de Linux no site oferece o AppImage da 0.28.1, junto do DEB e do pacote Arch (#60).
- Os tokens de cor da página Equipes passam a usar os mesmos nomes do mockup (#61).
- O aplicativo passa ao visual grafite partilhado (`public/tokens.css`) e a tela de ajustes passa a se chamar Configurações (#63).
- A pasta `website/` em main fica vazia de propósito e deixa de ser o site. O site publicado mora na branch `gh-pages` (#64).
- O site em `gh-pages` adota o visual sóbrio e o guia de instalação do Linux deixa de citar o ZIP antigo (`Instalar.zip`) (#65).
- A ilha Equipes segue a especificação visual: visão, lista, conversa, painel e marcas. O menor modelo local vem primeiro, e modelos grandes ficam só para o coordenador, em Avançado (#67).
- Os guias passam a chamar a tela de ajustes de Configurações, e esta seção registra os PRs já na main (#74).

## [0.28.1] - 2026-10-19

- A 0.28.0 não chegou a publicar binários. O empacotamento instala o `Electron.app` no macOS e entrega os caminhos do NSIS com barra invertida, gerando DMG, ZIP, Setup, AppImage, DEB, pacote Arch e `SHA256SUMS.txt` (#42).
- A narração usa a voz do sistema e o instalador deixa de embutir o eSpeak (#11).
- A primeira utilização sugere um único modelo de acordo com a RAM (#31).
- Os restos visíveis de Colmeia passam a LocalNeuron (#15).
- O formulário de bug em português acompanha os pacotes reais e deixa de citar RPM (#5).
- A instalação guarda um backup offline, e os testes cobrem migrações e os aliases de ambiente (#34).
- A biblioteca acompanha o download sem baixar o catálogo inteiro (#18).
- Os testes aceitam a mensagem opcional do `assert` no TypeScript 7 (#40).
- O CI ganha ESLint e Prettier (#10).
- O SDK MCP sobe de versão e o OAuth deixa de aceitar qualquer host HTTPS (#13).

## [0.28.0] - 2026-10-19

- O aviso de atualização reconhece DMG, ZIP, AppImage, DEB, pacote Arch e o Setup NSIS, inclusive as tags já publicadas (`v0.27.0-linux.3` e `v0.26.0`), e só aparece quando há pacote mais novo para o sistema atual (#20).
- `website/downloads.json` e `website/releases.json` passam a sair de um único catálogo, e a conferência ignora CRLF no Windows (#20).
- O EXO gerenciado fica no loopback, salvo quando a exposição na rede local é explícita (#21).
- A landing ganha traduções e a versão visível do site permanece alinhada aos pacotes publicados da 0.27.0 (#17).
- A documentação corrige a restauração, os títulos e este changelog (#16).
- Ilhas de navegação, mascote e contraste ficam mais fáceis de reconhecer (#9).
- O esquema do PGlite passa a ter versão e as bases antigas são preservadas (#24).
- `LOCALNEURON_*` vira o alias preferido das variáveis `COLMEIA_*` (#23).
- O nome do pacote e o iniciador ficam LocalNeuron, e o CI deixa de compilar duas vezes (#19).
- O CI ganha gitleaks, CodeQL e npm audit (#14).
- O Dependabot semanal cobre npm e GitHub Actions (#12).
- Dependências apontadas pelo npm audit são atualizadas (#8).
- O projeto fica marcado como software proprietário (#7).
- Os testes do CI passam a rodar em macOS, Windows e Linux (#6).
- A primeira visita e a comparação com o LM Studio ganham texto novo (#4).
- A documentação corrige a contagem de testes, o índice e as pastas de dados (#3, #2).
- O repositório ganha `.env.example` e a tabela de variáveis (#1).
- As ações do GitHub Actions usadas no CI e na release sobem de versão: checkout, setup-node e setup-python para a 7, upload-artifact para a 7 e download-artifact para a 8 (#37).
- As janelas Electron ficam isoladas: navegação externa só em http/https e o preload só chama a lista fechada de canais (#26).
- A Minha API responde 429 com Retry-After quando a chave ou o IP passa do limite, e a interface avisa se a Minha API ou o EXO local escuta fora do loopback (#29).
- O workflow de release no GitHub Actions dispara com a tag `vX.Y.Z`. O disparo manual não publica. Ele gera ZIP e DMG de macOS Apple Silicon com a assinatura ad hoc já existente, DEB, pacote Arch e AppImage no Linux, e o instalador NSIS no Windows, anexa `SHA256SUMS.txt` e abre a GitHub Release em rascunho. Não usa segredo nem notarização (#20).

## [0.27.0] — 2026-09-17

Nota: [LocalNeuron 0.27](docs/localneuron-0.27.md), commit `2e37cfb`. O `website/releases.json` resume: acesso lembrado opcional, wizard que preserva a conclusão, equipes em um clique, tarefas por especialista, melhor uso do contexto e avisos de novas versões.

Não existe tag `v0.27.0`. As tags leves abaixo apontam para commits do instalador Linux, posteriores a essa nota:

- `v0.27.0-linux.1` (2026-09-20, `dd20c50`) — “Repair damaged Linux installations and record runtime validation”.
- `v0.27.0-linux.2` (2026-09-20, `0e8b42b`) — “Add clickable Linux installer with automatic launch and cancellation”.
- `v0.27.0-linux.3` (2026-09-27, `c27fcae`) — “Keep native downloads gated until release assets finish uploading”. É a tag do instalador Linux em `website/downloads.json`.

## [0.26.0] — 2026-09-14

Tag leve `v0.26.0` (`42bf83d`, “Show current LocalNeuron interface in public documentation”). Não existe `docs/localneuron-0.26.md`. Mac e Windows em `website/downloads.json` usam esta tag. O commit `26d2165`, no mesmo dia, publica o código, a documentação e o site.

## [0.23.0]

Revisão de 13/09/2026 em [release-readiness.md](docs/release-readiness.md). A data está no próprio documento. Não há tag Git nem `docs/localneuron-0.23.md`.

## [0.21]

[Interface profissional](docs/localneuron-0.21.md).

## [0.20]

[Mascote 2D e expressões](docs/localneuron-0.20.md).

## [0.19]

[Mascote](docs/localneuron-0.19.md).

## [0.18]

[Um Pro mais fácil de reconhecer e usar](docs/localneuron-0.18.md).

## [0.17]

[Central Pro](docs/localneuron-0.17.md).

## [0.16]

[Imagem, vídeo e identificação visual](docs/localneuron-0.16.md).

## [0.15]

[Biblioteca e acesso](docs/localneuron-0.15.md).

## [0.14]

[Assinatura Pro mensal](docs/localneuron-0.14.md).

## [0.13]

[Chat e ferramentas](docs/localneuron-0.13.md).

## [0.12]

[Pro e Estúdio](docs/localneuron-0.12.md).

## [0.11]

[Estúdio de criação](docs/localneuron-0.11.md).

## [0.10]

[Interface](docs/localneuron-0.10.md).

## [0.9]

[Voz e biblioteca](docs/localneuron-0.9.md).

## [0.8]

[Motores e uso local](docs/localneuron-0.8.md).
