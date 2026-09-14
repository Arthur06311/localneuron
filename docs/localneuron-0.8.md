# LocalNeuron 0.8 — motores e uso local

## Fluxo simples

1. **Modelos → Baixar → Instalar e conversar**. O chat prepara a IA escolhida.
2. **Internet** permite pesquisas e leitura de páginas; desligada, o assistente não usa essas ferramentas. Downloads e a busca no Hugging Face são ações separadas e precisam de conexão.
3. **Esforço** ajusta o orçamento de raciocínio. Modelos sem essa capacidade não ganham raciocínio por mover a barra. A saída continua limitada pelo contexto e pela memória.
4. **Falar** usa Whisper: instale uma variante, permita o microfone, grave e termine. Revise o texto antes de enviar. A captura para ao sair do chat. O áudio temporário é apagado após a transcrição.
5. **Estúdio** baixa modelos de imagem/vídeo e gera arquivos locais. Uma tarefa de áudio ou mídia por vez. A geração impede respostas concorrentes da API e do chat. Cancelar, bloquear e fechar encerram o motor.
6. **Minha API** compartilha a IA de texto em uma rede privada, com chave revogável. Não publica o painel, os arquivos, o microfone ou o Estúdio.

## Motores incluídos

| Motor aberto | Uso | Plataforma |
|---|---|---|
| llama.cpp b10809 | Texto GGUF, incluindo conjuntos divididos | Mac ARM64/Metal; Windows x64 e Linux x64/CPU |
| MLX 0.32.2 + MLX LM 0.31.3 | Texto MLX, com Python embarcado | Mac Apple Silicon |
| whisper.cpp b4938 | Fala para texto; português incluído | Mac ARM64; Windows x64 e Linux x64 |
| stable-diffusion.cpp master-853-b68d586 | Stable Diffusion 1.5 e Wan 2.1 | Mac ARM64 com macOS 26+; Windows x64/CPU; Linux x64 Ubuntu 24.04 ou compatível |

Os motores executam no computador, sem assinatura ou conta de provedor. São projetos abertos de terceiros incorporados ao aplicativo, com suas licenças; não são motores proprietários criados do zero. O instalador de build usa releases fixadas e SHA-256. O Whisper no Mac é compilado da revisão fixada, com Metal e bibliotecas estáticas. O MLX é independente do LM Studio; a integração externa legada continua opcional.

Não há garantia de executar qualquer arquitetura publicada no Hugging Face. Um formato compatível também pode exceder a RAM do computador. No Windows, os binários também requerem o [Microsoft Visual C++ v14 x64](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) atualizado. O app identifica a ausência das DLLs e apresenta a orientação para instalar esse componente do sistema. Windows/Linux foram empacotados; testes nativos precisam ser feitos nesses sistemas. O pacote de difusão fornecido pelo projeto exige macOS 26; Macs anteriores mostram esse motor como indisponível.

## Catálogo e descoberta

229 entradas fixas de texto continuam disponíveis, com descrição, uso, RAM estimada, tamanho exato do download, origem e licença. O explorador consulta Qwen, Google/Gemma, Meta, Mistral, Microsoft, DeepSeek, OpenAI, NVIDIA, IBM Granite, AllenAI, NousResearch, MiniMax, Moonshot, Z.ai, BAAI, Stability AI, Black Forest Labs, Wan, THUDM, MLX Community, Cohere, Hugging Face SmolLM, Falcon, ByteDance, Tencent, LG EXAONE, StepFun e Yi.

A busca tem páginas de 30 resultados; não equivale a homologar todos os repositórios. O instalador automático adicional seleciona um conjunto GGUF Q4_K_M, Q4_0, Q5_K_M ou Q8_0 com metadados verificáveis. Arquivos ficam fixados a um commit, com SHA-256, e só aparecem como instaláveis após verificação. Conversões precisam declarar o modelo de base; o usuário vê quem publicou os pesos. Repositórios restritos exigem obtenção e aceite na fonte; não se contornam licenças. Pastas MLX já baixadas podem ser importadas no chat. Modelos de imagem, vídeo, voz sintética e embeddings fora dos perfis do Estúdio são referências com limites explícitos.

ChatGPT não é um modelo baixável. A marca OpenAI no catálogo refere-se aos modelos de pesos publicados por ela, quando disponíveis. Pesos abertos nem sempre têm licença de código aberto irrestrita; a ficha informa a licença declarada.

## Perfis de mídia

- Whisper tiny, base, small e large-v3-turbo: mais tamanho costuma favorecer precisão; o resultado depende da gravação e do idioma. Áudio PCM mono, 16 kHz, até 90 segundos na API; a interface para em 85 segundos.
- Stable Diffusion 1.5: imagem PNG 512 × 512; pesos executados em FP16, atenção otimizada e VAE em blocos.
- Wan 2.1 1.3B: vídeo experimental curto, 17 quadros em 256 × 256, salvo como WebP animado. Usa difusão Q4_K_M, codificador UMT5 Q3_K_M e VAE. Pode produzir artefatos e pouca definição. Não é geração de vídeo longo ou em alta resolução.

Os perfis visuais usam mmap, descarregamento de pesos para CPU e execução por demanda. Após concluir, o processo sai e libera sua memória. Modelos de texto carregados devem ser liberados na biblioteca se faltar RAM. Estimativas incluem uma margem adicional na admissão; não representam benchmarks de todos os modelos.

## Construir

`npm ci`, `npm test`; `python3 scripts/fetch-tools.py darwin-arm64` (requer CMake e compilador no Mac para o Whisper). Os scripts de empacotamento incluem os motores da plataforma e suas licenças. Não incluem conversas, sessões, chaves ou pesos dos modelos. Consulte os manifests de runtime para URLs e hashes oficiais.

A identidade interna `dev.colmeia.local`, as chaves de preferências e as pastas legadas são preservadas para manter atualizações compatíveis. Não renomeie ou apague `Colmeia-data`.
