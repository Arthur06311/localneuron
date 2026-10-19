# Changelog

As mudanças notáveis do LocalNeuron estão neste arquivo, no estilo [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

Cada entrada vem de uma fonte conferível: notas em `docs/localneuron-*.md`, a revisão `docs/release-readiness.md`, tags Git, `website/downloads.json`, `website/releases.json` ou `package.json` (versão atual `0.28.0`). Não há notas separadas da 0.22 à 0.26. As notas da 0.8 à 0.21 entraram no Git juntas no commit `26d2165` (14/09/2026); a data de criação do arquivo não é a data de cada versão, e por isso essas versões ficam sem data.

O fluxo de release só continua quando três valores são iguais: a tag `vX.Y.Z`, o campo `version` de `package.json` e a seção datada `## [X.Y.Z]` deste arquivo. A data pode usar hífen ou travessão.

## [Não publicado]

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
