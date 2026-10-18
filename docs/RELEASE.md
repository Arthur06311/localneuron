# Release em rascunho

O workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) dispara com uma tag `v*` (por exemplo `v0.27.0`) e também pode ser executado à mão com `workflow_dispatch`. A execução manual só guarda os artefatos na própria Action. O rascunho no GitHub Releases só é criado no push da tag. Este repositório não cria a tag nem publica o rascunho sozinho.

O workflow não notariza e não usa certificado. A assinatura Developer ID, a notarização Apple e o Authenticode do Windows ficam para uma etapa posterior, a cargo do Arthur. O comentário no topo do workflow marca esse ponto. O Mac continua com a assinatura ad hoc que `scripts/package-macos.py` já aplica hoje.

## Artefatos

| Arquivo | Sistema |
| --- | --- |
| `LocalNeuron-macOS-arm64.dmg` e `LocalNeuron-macOS-arm64.zip` | macOS Apple Silicon, como o empacotamento atual |
| `LocalNeuron-Linux-x64.deb` | Debian e Ubuntu |
| `LocalNeuron-Linux-x64.pkg.tar.gz` | Arch e Omarchy |
| `LocalNeuron-Linux-x64.AppImage` | Linux x64 portátil, além do DEB e do Arch |
| `LocalNeuron-Windows-x64-Setup.exe` | Instalador NSIS de Windows x64, sem assinatura |
| `SHA256SUMS` | SHA-256 de cada arquivo acima |

## Conferir os hashes

Baixe `SHA256SUMS` e os instaladores para a mesma pasta. O arquivo usa o formato do `sha256sum`: hash, dois espaços e o nome do arquivo.

No Linux:

```sh
sha256sum -c SHA256SUMS
```

No macOS:

```sh
shasum -a 256 -c SHA256SUMS
```

No Windows, no PowerShell, a partir da pasta dos arquivos:

```powershell
Get-Content SHA256SUMS | ForEach-Object {
  $hash, $name = $_ -split '  ', 2
  $atual = (Get-FileHash -Algorithm SHA256 $name).Hash.ToLower()
  if ($atual -ne $hash) { throw "Hash diferente: $name" }
  "ok  $name"
}
```

Cada linha precisa terminar em `ok`. Se um nome ou um hash não bater, não instale esse arquivo. O `SHA256SUMS` antigo na raiz do repositório descreve pacotes já publicados e não substitui o arquivo anexado ao rascunho novo.
