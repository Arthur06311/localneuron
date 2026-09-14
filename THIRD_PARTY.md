# Componentes de terceiros — LocalNeuron 0.13

O LocalNeuron integra motores e bibliotecas independentes. Seus autores e licenças continuam aplicáveis. Os arquivos LICENSE/COPYING incluídos nos pacotes npm e nos runtimes acompanham a distribuição.

- llama.cpp e whisper.cpp: MIT, textos em runtime/LICENSE.llama.cpp e runtime/LICENSE.whisper.cpp. Código e versões fixadas nos manifests em runtime/.
- MLX: motor e bibliotecas embarcados somente em macOS Apple Silicon; versões e origem em runtime/mlx-manifest.json. Licenças nos respectivos pacotes Python.
- sherpa-onnx 1.13.8: Apache-2.0. Texto em licenses/sherpa-onnx-APACHE-2.0.txt. Código-fonte e instruções de compilação: https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8 ; arquivo-fonte: https://github.com/k2-fsa/sherpa-onnx/archive/refs/tags/v1.13.8.tar.gz . Os scripts CMake identificam as dependências usadas na compilação.
- ONNX Runtime: MIT. Texto em licenses/onnxruntime-MIT.txt; código-fonte: https://github.com/microsoft/onnxruntime .
- eSpeak NG, usado pela síntese VITS: GPL-3.0. Texto em licenses/espeak-ng-GPL-3.0.txt. Código-fonte e compilação: https://github.com/espeak-ng/espeak-ng ; integração e revisão usadas pelo sherpa: https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8/cmake . A licença do dataset da voz não substitui a licença do motor ou dos componentes.
- Voz Faber em português brasileiro: model card original em licenses/faber-MODEL_CARD.txt, com dataset CC0, ajustes sobre lessac medium e referência ao projeto Piper. Origem: https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber/medium . A voz é baixada separadamente; tamanho e SHA-256 fixados em src/pro-media.ts.
- PDF.js: Apache-2.0; docx: MIT; ExcelJS: MIT; PptxGenJS: MIT; fflate: MIT; tar: ISC; seek-bzip: MIT. Versões exatas em package-lock.json e licenças nos pacotes node_modules.
- Node.js 24.14.1: runtime independente embarcado para o motor de voz; licença e avisos em runtime/voice-node-*/LICENSE. SHA-256 e origem em runtime/voice-node-manifest.json; código-fonte: https://nodejs.org/dist/v24.14.1/node-v24.14.1.tar.gz .
- Electron, Chromium e Node.js: veja LICENSE, LICENSES.chromium.html e demais avisos fornecidos pela distribuição Electron.

Os modelos baixados possuem licenças próprias, indicadas em sua ficha. A inclusão no catálogo não transfere direitos sobre modelos, imagens, vozes ou dados de treinamento.

## Identificação visual dos modelos

Avatares públicos de publicadores do Hugging Face são armazenados localmente para identificação no catálogo. As marcas e imagens pertencem aos respectivos titulares; sua inclusão não implica endosso nem concede licença sobre a marca. Origens e correspondências estão em `docs/model-icon-sources.json`. Entradas sem imagem adequada usam iniciais e cores locais.

## EXO (instalação opcional)

Integração com [exo-explore/exo](https://github.com/exo-explore/exo), versão 1.0.71, commit `fd707de30b42db4211d15da96b9052e1dc280ed1`, Apache-2.0. O instalador baixa o pacote oficial por HTTPS e confere tamanho e SHA-256 antes de extrair o runtime. [Licença](licenses/EXO-Apache-2.0.txt). Dependências do runtime mantêm suas próprias licenças e os arquivos que acompanham o pacote. O EXO não é derivado do LM Studio.


## MCP TypeScript SDK

@modelcontextprotocol/sdk — MIT. Cliente oficial de Model Context Protocol para HTTP/stdio e OAuth. Código: https://github.com/modelcontextprotocol/typescript-sdk . Licença incluída em licenses/LICENSE.mcp-sdk.

## Optional music engine and video editor

ACE-Step 1.5 (MIT, copyright 2026 ACEStep) is downloaded separately by the music installer. Pinned source and model revisions are documented in docs/creative-studio.md. Its original license is retained in the installed source directory. uv and Python are installed in an isolated engine directory with their upstream dependencies and licenses.

The DaVinci Resolve bridge calls the SDK provided by a separately installed DaVinci Resolve Studio. No Blackmagic binaries or SDK files are redistributed.
