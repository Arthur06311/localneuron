# Componentes de terceiros

O LocalNeuron integra motores e bibliotecas independentes. Seus autores e licenças continuam aplicáveis. Os arquivos LICENSE/COPYING incluídos nos pacotes npm e nos runtimes acompanham a distribuição.

- llama.cpp e whisper.cpp: MIT, textos em runtime/LICENSE.llama.cpp e runtime/LICENSE.whisper.cpp. Código e versões fixadas nos manifests em runtime/.
- MLX: motor e bibliotecas embarcados somente em macOS Apple Silicon; versões e origem em runtime/mlx-manifest.json. Licenças nos respectivos pacotes Python.
- Narração: voz do sistema operacional (macOS `say`, Windows SAPI / System.Speech, Linux speech-dispatcher / `spd-say`). Nenhum motor de síntese, dado do eSpeak NG ou voz Faber é empacotado. A voz instalada no sistema permanece sob a licença do próprio sistema.
- PDF.js: Apache-2.0; docx: MIT; ExcelJS: MIT; PptxGenJS: MIT; fflate: MIT. Versões exatas em package-lock.json e licenças nos pacotes node_modules.
- Electron, Chromium e Node.js: veja LICENSE, LICENSES.chromium.html e demais avisos fornecidos pela distribuição Electron.

Os modelos baixados possuem licenças próprias, indicadas em sua ficha. A inclusão no catálogo não transfere direitos sobre modelos, imagens, vozes ou dados de treinamento.

## Identificação visual dos modelos

Avatares públicos de publicadores do Hugging Face são armazenados localmente para identificação no catálogo. As marcas e imagens pertencem aos respectivos titulares; sua inclusão não implica endosso nem concede licença sobre a marca. Origens e correspondências estão em `docs/model-icon-sources.json`. Entradas sem imagem adequada usam iniciais e cores locais.

## EXO (instalação opcional)

Integração com [exo-explore/exo](https://github.com/exo-explore/exo), versão 1.0.71, commit `fd707de30b42db4211d15da96b9052e1dc280ed1`, Apache-2.0. O instalador baixa o pacote oficial por HTTPS e confere tamanho e SHA-256 antes de extrair o runtime. [Licença](licenses/EXO-Apache-2.0.txt). Dependências do runtime mantêm suas próprias licenças e os arquivos que acompanham o pacote. O EXO não é derivado do LM Studio.


## MCP TypeScript SDK

@modelcontextprotocol/sdk — MIT. Cliente oficial de Model Context Protocol para HTTP/stdio e OAuth. Código: https://github.com/modelcontextprotocol/typescript-sdk . Licença incluída em licenses/LICENSE.mcp-sdk.

## Motor de música e editor de vídeo opcionais

O ACE-Step 1.5 (MIT, copyright 2026 ACEStep) é baixado separadamente pelo instalador de música. As revisões fixadas do código e dos modelos estão em docs/creative-studio.md. A licença original permanece no diretório de código instalado. uv e Python são instalados num diretório isolado do motor, com as dependências e as licenças de origem.

A ponte do DaVinci Resolve chama o SDK fornecido por um DaVinci Resolve Studio instalado à parte. Nenhum binário nem arquivo de SDK da Blackmagic é redistribuído.
