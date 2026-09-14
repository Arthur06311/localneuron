> A versão 0.8 inclui Whisper e stable-diffusion.cpp. O motor visual do Mac exige macOS 26+. [Detalhes dos motores e modelos](localneuron-0.8.md).

# Executar no Mac, Windows e Linux

A Alfa 0.13 tem aplicação Electron e serviço local compartilhados entre as plataformas. O runtime GGUF acompanha os pacotes. O Mac inclui também MLX/Metal independente, com Python e dependências embarcados; LM Studio é opcional. MLX embarcado requer Apple Silicon e macOS 14+, com execução real verificada neste macOS 26.6.2. Os modelos não vêm nos pacotes do aplicativo: você os baixa na biblioteca.

| Pacote | Como abrir | Validação desta entrega |
|---|---|---|
| LocalNeuron-macOS-arm64.dmg | Abrir e arrastar LocalNeuron.app para Aplicativos | Executado em Mac Apple Silicon; fluxo real de download e inferência |
| LocalNeuron-Windows-x64.zip | Extrair a pasta inteira e abrir LocalNeuron.exe | Pacote gerado e estrutura verificada; execução no Windows pendente |
| LocalNeuron-Linux-x64.tar.gz | Extrair a pasta e executar `./LocalNeuron` dentro dela | Pacote gerado e estrutura verificada; execução no Linux pendente |

Mantenha juntos todos os arquivos dos pacotes Windows/Linux. Não mova somente o executável. O Linux precisa de ambiente gráfico, bibliotecas do Electron e configuração de sandbox compatível com a distribuição; não há opção automática para desativar sandbox. Os pacotes são Alfa de teste, sem certificado de distribuição; no Mac há assinatura ad hoc, sem notarização. Assinatura oficial e instaladores de produção continuam no plano.

O [LM Studio informa](https://lmstudio.ai/docs/app/system-requirements) suporte a macOS 14+ com Apple Silicon, Windows x64/ARM compatível e Linux x64/ARM64 compatível. Há requisitos de CPU/GPU específicos. Mac Intel não é atendido por esse motor nem pelo pacote Mac ARM64 desta entrega. Não anunciamos todas as arquiteturas como testadas.

## Dados e atualizações

Novas instalações armazenam dados fora do aplicativo:

- macOS: `~/Library/Application Support/Colmeia/`
- Windows: `%APPDATA%/Colmeia/`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/Colmeia/`

O Mac que já usou a Alfa anterior mantém a pasta irmã `Colmeia-data/` quando ela existe. Nesta máquina, ela permanece ao lado de `LocalNeuron.app`. Nenhuma migração ou troca de senha é necessária. Não apague essa pasta ao atualizar. Para backup completo, feche o aplicativo e preserve toda a pasta de dados. O download do cofre na interface contém apenas as chaves cifradas.

`COLMEIA_DESKTOP_DATA_DIR` permite escolher explicitamente outra pasta antes de abrir. Em desenvolvimento, o padrão continua `.desktop/`. O servidor de linha de comando usa `.data/` ou `COLMEIA_DATA_DIR`.

## Reproduzir os pacotes

Requer Node 24, npm e internet durante a construção:

```sh
npm ci
python3 scripts/fetch-runtime.py darwin-arm64
npm test
npm run package -- win32 x64
npm run package -- linux x64
npm run package -- darwin arm64
```

O script usa uma pasta temporária e inclui apenas runtime, interface, workflow e dependências de produção. Rejeita sobrescrever um pacote existente para não tocar em dados colocados ali. Saída em `releases/`. O script específico `python3 scripts/package-macos.py` produz o Mac local assinado ad hoc e exige fechar o aplicativo antes de substituir o bundle.

A matriz em `.github/workflows/desktop.yml` permite executar testes e empacotar em runners nativos. Ela está preparada no código; **não foi disparada em serviço remoto**. Testes de interface, download e inferência em Windows/Linux ainda exigem máquinas desses sistemas. O [Electron Packager](https://github.com/electron/packager) cria os bundles; gerar um pacote não comprova execução na plataforma de destino.

## Componente do Windows

Os binários de texto, Whisper e difusão usam o Microsoft Visual C++ v14 x64. Instale ou atualize pela [página oficial da Microsoft](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). O pacote inclui LEIA-ME.txt e a interface mostra esse requisito. Não há dependência de assinatura, conta ou servidor de inferência.

O DMG é gerado por `python3 scripts/package-dmg.py` a partir do ZIP público assinado. Inclui atalho para Applications e instruções de instalação. A configuração Pro de teste do proprietário não entra no DMG. O empacotador macOS gera os dois formatos automaticamente.
