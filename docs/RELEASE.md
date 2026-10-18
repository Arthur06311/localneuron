# Publicar uma versão do LocalNeuron

Checklist para quem for publicar. O workflow [Release](../.github/workflows/release.yml) gera o AppImage de Linux e o instalador NSIS de Windows e abre uma **GitHub Release em rascunho**. Ele não publica sozinho, não assina nada e não lê segredo.

O CI de testes continua em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), na matriz macOS, Windows e Linux (PR #6). A release não repete essa matriz. O job `Versão e changelog` desse CI só confere se a versão do `package.json` tem seção neste changelog e se `downloads.json` e `releases.json` ainda saem do mesmo catálogo.

## Antes da tag

1. Espere o CI da `main` ficar verde.
2. Atualize `"version"` em `package.json`. Exemplo: `0.28.0`.
3. Mova o texto de `## [Unreleased]` para `## [0.28.0] - AAAA-MM-DD` no `CHANGELOG.md`. A seção precisa ter data e texto. Essas linhas viram as notas do rascunho.
4. Na sua máquina: `node scripts/check-release-version.mjs --tag v0.28.0`. Tem que terminar sem erro.
5. Faça o merge na `main`. A tag deve apontar para o commit que já está na `main`.

## Disparar

```bash
git checkout main
git pull
git tag v0.28.0
git push origin v0.28.0
```

O push da tag dispara o workflow. Para reconstruir uma tag que **já existe**, abra Actions → Release → Run workflow e informe `v0.28.0`. O disparo manual não cria tag. Assim a release não dispara o workflow uma segunda vez.

A tag tem de ser exatamente `v` + a versão do `package.json`. `v0.27.0-linux.3` falha de propósito: era uma tag histórica só do Linux. O fluxo novo usa `vX.Y.Z`.

## O que o workflow faz

1. Confere a tag, o `package.json` e a seção do changelog. Se um dos três divergir, para.
2. No Linux, roda `npm run package -- linux x64`. Isso usa `@electron/packager`, o empacotador que o repositório já usa. Em seguida gera `LocalNeuron-Linux-x64.AppImage`.
3. No Windows, roda `npm run package -- win32 x64` e gera `LocalNeuron-Windows-x64-Setup.exe` com NSIS, sem assinatura.
4. Calcula `SHA256SUMS.txt` desses dois arquivos.
5. Gera um `releases.json` candidato a partir do catálogo atual mais esses artefatos. Os arquivos novos ficam com `available: false`.
6. Abre ou atualiza a release **rascunho** da tag, com as notas da seção do changelog.

Arquivos do rascunho:

- `LocalNeuron-Linux-x64.AppImage`
- `LocalNeuron-Windows-x64-Setup.exe`
- `SHA256SUMS.txt`
- `releases.json` (candidato; ainda não é o feed do site)

O macOS não entra neste workflow.

O AppImage não passa `--no-sandbox`. Dentro do AppImage o helper setuid do Electron não vale; a abertura depende dos namespaces de usuário da distribuição. Não contornamos isso desligando o sandbox.

O instalador Windows pede administrador e o SmartScreen avisa, porque não há certificado.

## Conferir o rascunho

1. Abra a release em rascunho. Enquanto estiver em draft, ela não é o lançamento público.
2. Confira o título, as notas e os quatro arquivos.
3. Baixe os instaladores e compare com `SHA256SUMS.txt` (`sha256sum -c SHA256SUMS.txt` no Linux).
4. Instale o AppImage numa máquina Linux real e o Setup numa máquina Windows real. O CI não substitui GPU, áudio, sandbox nem SmartScreen.
5. Se a release daquela tag já tiver sido publicada, o workflow recusa alterá-la.
6. Só então publique o rascunho. Enquanto for alfa, marque como pré-lançamento.
7. Atualize o catálogo do site, no passo abaixo. Não marque `available: true` antes de o link existir.

## Catálogo único de downloads

A fonte é [`website/release-source.json`](../website/release-source.json). O script gera os dois arquivos que o site e o aplicativo leem:

```bash
node scripts/build-release-manifest.mjs
node scripts/build-release-manifest.mjs --check
```

- `website/downloads.json` alimenta a página de downloads.
- `website/releases.json` é o feed do aplicativo (`gh-pages/releases.json`).

O aviso de atualização só fica verdadeiro quando o arquivo daquela plataforma e arquitetura é mais novo que a versão instalada. Hoje o Linux publicado é o DEB da tag `v0.27.0-linux.3`; Mac e Windows continuam no DMG e no ZIP da `v0.26.0`. Um pacote só de Linux não abre o aviso no Mac nem no Windows.

Quando o rascunho estiver conferido e publicado, edite o catálogo: inclua o AppImage e o Setup com bytes, SHA-256 e `available: true`, rode o script e publique o site como em [Publicação no GitHub](github-publicacao.md). O `releases.json` anexado ao rascunho já traz os hashes, com `available: false`, para copiar.

Preferência do aviso, quando mais de um arquivo da mesma plataforma está disponível:

- Linux: AppImage, depois DEB, pacote Arch e o `.tar.gz` antigo.
- Windows: instalador NSIS, depois o ZIP.
- macOS: DMG de Apple Silicon.

## Se a checagem falhar

| Situação | Efeito |
| --- | --- |
| Tag `v0.28.0` e `package.json` `0.27.0` | o workflow falha |
| `package.json` `0.28.0` sem `## [0.28.0]` | falha no CI do pull request e na release |
| Tag `v0.28.0-rc.1` com versão `0.28.0` | falha |
| Release da tag já publicada | o workflow não mexe nela |
| `downloads.json` editado à mão | o CI falha até rodar o script de novo |

## O que ainda depende do Arthur

### Segredos

Nenhum. O workflow não usa `secrets.*`. A publicação usa o token automático do GitHub Actions, com permissão `contents: write` só no job do rascunho. Não cadastre um PAT para este fluxo.

### Apple

Não há notarização nem Developer ID neste workflow, e não há pacote macOS gerado aqui. Quando for a hora, na máquina do titular:

- Certificado **Developer ID Application: Nome (TEAMID)** no Chaves
- Perfil do `notarytool`

O script [`scripts/notarize-macos.sh`](../scripts/notarize-macos.sh) descreve o uso local. Placeholders para o futuro, **sem criar agora** e **sem colocar no YAML**:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

### Windows

Não há `signtool` nem certificado. Placeholders para o futuro, sem criar agora:

- `WIN_CSC_LINK` (PFX em base64, se um dia houver assinatura)
- `WIN_CSC_KEY_PASSWORD`

Até lá, o instalador é distribuído sem assinatura Authenticode.

### Empacotador

O repositório usa `@electron/packager` (`npm run package`). Este fluxo não troca para electron-builder nem Electron Forge. O `appimagetool` 1.9.1 só embrulha a pasta Linux que o Packager gerou. O runtime do AppImage é o type2 `20251108`. Os dois SHA-256 estão fixados em `scripts/package-appimage.py`. O NSIS só embrulha a pasta Windows.

## Comandos locais

```bash
npm ci
npm test
node scripts/check-release-version.mjs --tag v0.27.0
npm run package -- linux x64
python3 scripts/package-appimage.py releases/LocalNeuron-linux-x64 --output releases/LocalNeuron-Linux-x64.AppImage
```

No Windows, com o NSIS instalado (`makensis` no PATH ou em `C:\Program Files (x86)\NSIS`):

```bash
npm run package -- win32 x64
python scripts/package-nsis.py releases/LocalNeuron-win32-x64 --output releases/LocalNeuron-Windows-x64-Setup.exe
```
