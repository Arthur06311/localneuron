# Changelog

As mudanças notáveis do LocalNeuron estão neste arquivo, no estilo [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

Cada entrada vem de uma fonte conferível: notas em `docs/localneuron-*.md`, a revisão `docs/release-readiness.md`, tags Git, `website/downloads.json`, `website/releases.json` ou `package.json` (versão atual `0.27.0`). Não há notas separadas da 0.22 à 0.26. As notas da 0.8 à 0.21 entraram no Git juntas no commit `26d2165` (14/09/2026); a data de criação do arquivo não é a data de cada versão, e por isso essas versões ficam sem data.

O fluxo de release só continua quando três valores são iguais: a tag `vX.Y.Z`, o campo `version` de `package.json` e a seção datada `## [X.Y.Z]` deste arquivo. A data pode usar hífen ou travessão.

## [Não publicado]

O `package.json` continua em `0.27.0`. Não há tag mais nova que `v0.27.0-linux.3`.

### Adicionado

- Workflow de release no GitHub Actions. Este fluxo substitui o PR #32. Ele dispara com a tag `vX.Y.Z`. O disparo manual só gera artefatos e não publica. Produz o ZIP e o DMG de macOS Apple Silicon com a assinatura ad hoc já existente (sem Developer ID e sem notarização), o DEB, o pacote Arch e o AppImage de Linux, e o instalador NSIS de Windows. Anexa `SHA256SUMS.txt` de todos esses arquivos e abre a GitHub Release em rascunho, com as notas da seção correspondente deste arquivo. Não usa segredo.

### Corrigido

- O aviso de atualização reconhece os artefatos deste fluxo (DMG, ZIP, AppImage, DEB, pacote Arch e Setup NSIS na tag `vX.Y.Z`) e os pacotes já publicados: DEB e Arch em `v0.27.0-linux.3`, DMG e ZIP em `v0.26.0`.
- O aviso só aparece quando há um instalador mais novo para o sistema e a arquitetura atuais. Um pacote só de Linux não abre o aviso no Mac nem no Windows.
- `website/downloads.json` e `website/releases.json` passam a ser gerados de `website/release-source.json`, para os dois não divergirem. A conferência ignora a diferença entre LF e CRLF, para o CI no Windows não falhar quando o checkout converte as quebras de linha.

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
