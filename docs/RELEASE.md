# Publicar uma versão do LocalNeuron

Checklist para quem for publicar. O workflow [Release](../.github/workflows/release.yml) é o fluxo único de release e substitui o PR #32. Ele gera o ZIP e o DMG de macOS Apple Silicon, o DEB, o pacote Arch e o AppImage de Linux, e o instalador NSIS de Windows. No push de uma tag `v*`, abre uma **GitHub Release em rascunho**. O disparo manual (`workflow_dispatch`) só guarda os artefatos na própria Action e não publica. O workflow não cria tag, não assina com certificado e não lê segredo.

O CI de testes continua em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), na matriz macOS, Windows e Linux (PR #6). A release não repete essa matriz. O job `Versão e changelog` desse CI só confere se a versão do `package.json` tem seção neste changelog e se `downloads.json` e `releases.json` ainda saem do mesmo catálogo.

## Antes da tag

1. Espere o CI da `main` ficar verde.
2. Atualize `"version"` em `package.json`. Exemplo: `0.28.0`.
3. Mova o texto de `## [Não publicado]` para `## [0.28.0] — AAAA-MM-DD` no `CHANGELOG.md`. Hífen ou travessão servem. A seção precisa ter data e texto. Essas linhas viram as notas do rascunho.
4. Na sua máquina: `node scripts/check-release-version.mjs --tag v0.28.0`. Tem que terminar sem erro.
5. Faça o merge na `main`. A tag deve apontar para o commit que já está na `main`.

## Disparar

```bash
git checkout main
git pull
git tag v0.28.0
git push origin v0.28.0
```

O push da tag dispara o workflow e, se a checagem passar, abre o rascunho. Para só reconstruir os artefatos, abra Actions → Release → Run workflow. Pode informar uma tag que já existe, ou deixar o campo vazio para usar o commit selecionado. O disparo manual não cria tag e não publica nada.

A tag tem de ser exatamente `v` + a versão do `package.json`. `v0.27.0-linux.3` falha de propósito: era uma tag histórica só do Linux. O fluxo novo usa `vX.Y.Z`.

## O que o workflow faz

1. No push da tag, confere a tag, o `package.json` e a seção do changelog. Se um dos três divergir, para. No disparo manual sem tag, confere só a versão e o changelog do commit selecionado.
2. No macOS Apple Silicon, roda `python3 scripts/package-macos.py --dist-only --output-dir releases`. Isso gera `LocalNeuron-macOS-arm64.zip` e `LocalNeuron-macOS-arm64.dmg` com a assinatura ad hoc que o script já faz. Não há Developer ID nem notarização.
3. No Linux, roda `npm run package -- linux x64`. Isso usa `@electron/packager`, o empacotador que o repositório já usa, e gera o DEB e o pacote Arch. Em seguida gera `LocalNeuron-Linux-x64.AppImage`.
4. No Windows, roda `npm run package -- win32 x64` e gera `LocalNeuron-Windows-x64-Setup.exe` com NSIS, sem `signtool`.
5. No push da tag, calcula `SHA256SUMS.txt` dos seis instaladores, gera um `releases.json` candidato (arquivos novos com `available: false`) e abre ou atualiza a release **rascunho**, com as notas da seção do changelog. O disparo manual para antes deste passo.

Arquivos do rascunho:

| Arquivo | Sistema |
| --- | --- |
| `LocalNeuron-macOS-arm64.dmg` e `LocalNeuron-macOS-arm64.zip` | macOS Apple Silicon, assinatura ad hoc |
| `LocalNeuron-Linux-x64.deb` | Debian e Ubuntu |
| `LocalNeuron-Linux-x64.pkg.tar.gz` | Arch e Omarchy |
| `LocalNeuron-Linux-x64.AppImage` | Linux x64 portátil |
| `LocalNeuron-Windows-x64-Setup.exe` | Instalador NSIS de Windows x64, sem assinatura |
| `SHA256SUMS.txt` | SHA-256 de cada arquivo acima |
| `releases.json` | candidato; ainda não é o feed do site |

O AppImage não passa `--no-sandbox`. Dentro do AppImage o helper setuid do Electron não vale; a abertura depende dos namespaces de usuário da distribuição. Não contornamos isso desligando o sandbox.

O instalador Windows pede administrador e o SmartScreen avisa, porque não há certificado.

## Conferir o rascunho

1. Abra a release em rascunho. Enquanto estiver em draft, ela não é o lançamento público.
2. Confira o título, as notas e os arquivos da tabela acima.
3. Baixe `SHA256SUMS.txt` e os instaladores para a mesma pasta e confira os hashes, como na seção abaixo.
4. Instale o DMG num Mac Apple Silicon, o DEB ou o AppImage numa máquina Linux e o Setup numa máquina Windows. O CI não substitui GPU, áudio, sandbox nem SmartScreen.
5. Se a release daquela tag já tiver sido publicada, o workflow recusa alterá-la.
6. Só então publique o rascunho. Enquanto for alfa, marque como pré-lançamento.
7. Atualize o catálogo do site, no passo abaixo. Não marque `available: true` antes de o link existir.

## Catálogo único de downloads

A fonte em `main` é [`catalog/release-source.json`](../catalog/release-source.json). O script gera os dois arquivos conferidos pelo CI:

```bash
node scripts/build-release-manifest.mjs
node scripts/build-release-manifest.mjs --check
```

- `catalog/downloads.json` é o catálogo de downloads em `main`. A página pública lê o arquivo da branch `gh-pages`.
- `catalog/releases.json` é a cópia em `main` do feed. O aplicativo lê `gh-pages/releases.json`.

O aviso de atualização só fica verdadeiro quando o arquivo daquela plataforma e arquitetura é mais novo que a versão instalada. Hoje o Linux publicado é o DEB da tag `v0.27.0-linux.3`; Mac e Windows continuam no DMG e no ZIP da `v0.26.0`. Um pacote só de Linux não abre o aviso no Mac nem no Windows.

Quando o rascunho estiver conferido e publicado, edite `catalog/release-source.json`: inclua DMG, ZIP, DEB, pacote Arch, AppImage e Setup com bytes, SHA-256 e `available: true`, rode o script e envie o `releases.json` à branch `gh-pages` por um pull request contra essa branch, como em [Publicação no GitHub](github-publicacao.md). O `releases.json` anexado ao rascunho já traz os hashes, com `available: false`, para copiar.

Preferência do aviso, quando mais de um arquivo da mesma plataforma está disponível:

- Linux: AppImage, depois DEB, pacote Arch e o `.tar.gz` antigo.
- Windows: instalador NSIS, depois o ZIP.
- macOS: DMG de Apple Silicon, depois o ZIP.

## Conferir os hashes

Baixe `SHA256SUMS.txt` e os instaladores para a mesma pasta. O arquivo usa o formato do `sha256sum`: hash, dois espaços e o nome do arquivo. Ele cobre o DMG, o ZIP, o DEB, o pacote Arch, o AppImage e o Setup NSIS.

No Linux:

```sh
sha256sum -c SHA256SUMS.txt
```

No macOS:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

No Windows, no PowerShell, a partir da pasta dos arquivos:

```powershell
Get-Content SHA256SUMS.txt | ForEach-Object {
  $hash, $name = $_ -split '  ', 2
  $atual = (Get-FileHash -Algorithm SHA256 $name).Hash.ToLower()
  if ($atual -ne $hash) { throw "Hash diferente: $name" }
  "ok  $name"
}
```

Cada linha precisa terminar em `ok`. Se um nome ou um hash não bater, não instale esse arquivo. O `SHA256SUMS.txt` antigo na raiz do repositório descreve pacotes já publicados e não substitui o arquivo anexado ao rascunho novo.

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

O workflow gera o ZIP e o DMG com a assinatura ad hoc que `scripts/package-macos.py` já aplica. Não há notarização nem Developer ID. O comentário no topo do workflow marca onde isso entra depois. Quando for a hora, na máquina do titular:

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
