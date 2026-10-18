# LocalNeuron e LM Studio: o que muda entre eles

LocalNeuron 0.27 · Alfa. Comparação factual, conferida em 18/10/2026. O LM Studio é um aplicativo maduro e muito usado para rodar modelos locais; esta página não pretende dizer qual é “melhor”, e sim mostrar para que cada um foi pensado, para você escolher — ou usar os dois.

LM Studio é uma marca da Element Labs, Inc. O LocalNeuron não tem afiliação com o LM Studio. As informações sobre o LM Studio vêm da documentação pública dele (fontes no fim da página) e podem mudar a qualquer momento.

## Resumo

- **Os dois** rodam modelos de texto localmente com llama.cpp (GGUF) e, no Mac Apple Silicon, com MLX; funcionam offline depois que os modelos foram baixados; conectam servidores MCP; e oferecem um endpoint compatível com OpenAI.
- **O LM Studio** é focado em LLMs e no desenvolvedor: API ampla (Chat Completions, Responses, Embeddings, compatibilidade Anthropic), SDKs Python/TypeScript, CLI `lms`, modo headless (`llmster`), acesso entre dispositivos com LM Link e interface em vários idiomas. É multiplataforma.
- **O LocalNeuron** é um espaço de trabalho local mais amplo, em versão alfa: além de texto, reúne motores próprios de voz, imagem/vídeo e música, rede EXO para dividir um modelo entre computadores, **Minha API** com chaves e cotas por cliente, bots especialistas e uma ponte para o DaVinci Resolve Studio. A interface do app está em português.

## Tabela comparativa

| Tema | LocalNeuron 0.27 (alfa) | LM Studio |
|---|---|---|
| Sistemas | macOS Apple Silicon, Windows x64, Linux x64 (DEB e pacote Arch). Mac Intel não é atendido. Windows: interface e backend validados; motores/GPU pendentes. | macOS 14+ com Apple Silicon, Windows x64 (AVX2) e ARM, Linux x64 e ARM64 (AppImage; changelog também cita `.deb`). Mac Intel não é atendido. [L1][L9] |
| Texto GGUF | llama.cpp b10809 incluído no pacote. Mac usa Metal; os pacotes Windows/Linux incluídos usam CPU. | llama.cpp, com runtimes que podem ser baixados e trocados sem atualizar o app; o changelog cita aceleração por CUDA, Vulkan e ROCm. [L2][L3][L9] |
| MLX (Apple Silicon) | Runtime próprio embarcado (Python 3.12.14, MLX 0.32.2, MLX LM 0.31.3), com o processo de inferência isolado da rede pelo sandbox do macOS. | Suporte a MLX em Macs Apple Silicon. [L2] |
| Voz | Transcrição local com whisper.cpp (perfis tiny, base, small e large-v3-turbo). Síntese de voz em português com sherpa-onnx/Piper (voz Faber), usada na narração do estúdio. | Transcrição de voz offline citada no plano gratuito; entrada de voz documentada no Bionic. [L7][L8] Síntese de voz nativa: não documentada em 18/10/2026. |
| Imagem e vídeo | stable-diffusion.cpp com perfis integrados (SD 1.5 para imagem, Wan 2.1 para vídeo), projetos, cenas e exportação. O binário visual do Mac exige macOS 26+. | Geração de imagem nativa: não documentada em 18/10/2026. Modelos de visão podem receber imagens no Chat Completions. [L4] |
| Música | ACE-Step 1.5 opcional, instalado em pasta própria (25 GiB livres), faixas de 10 a 120 s. Geração real de 10 s verificada no Mac Apple Silicon. | Geração de música: não documentada em 18/10/2026. |
| Vários computadores | **Rede EXO** (EXO 1.0.71): divide um modelo de texto compatível entre máquinas. Instalação gerenciada em Mac com macOS 26.2+; outros sistemas podem controlar um EXO existente. Teste com duas máquinas físicas ainda pendente. | **LM Link**: rede criptografada de ponta a ponta (com Tailscale) para usar modelos de outro dispositivo seu, inclusive pelo app Locally no iPhone; até 5 dispositivos no plano gratuito. [L6][L7] Dividir um único modelo entre máquinas: não documentado em 18/10/2026. |
| API local | **Minha API**: servidor separado (porta 4320), desligado por padrão, compatível com OpenAI Chat Completions para texto, com streaming. Uma chave por cliente, cotas e revogação; acesso só local ou em rede privada/VPN. Não implementa ferramentas, imagens, áudio, Responses nem Embeddings. | Endpoints compatíveis com OpenAI (`/v1/models`, `/v1/responses`, `/v1/chat/completions` com texto e imagens, `/v1/embeddings`, `/v1/completions`), compatibilidade Anthropic (`/v1/messages`), REST API própria, SDKs Python e TypeScript e CLI `lms`. Tokens de API opcionais (0.4.0+). [L4][L5][L10] |
| MCP | Cliente MCP para servidores HTTP e stdio, OAuth com PKCE quando o servidor suporta, tokens guardados no cofre, escolha de quais bots podem usar cada conexão e revisão das chamadas. | Host MCP desde a 0.3.17, servidores locais e remotos via `mcp.json` ou botão “Add to LM Studio”; MCP também via API. [L3][L5] |
| Agente e ferramentas | Assistente com informações do computador, pesquisa e leitura web, arquivos de uma pasta escolhida e terminal opcional, sempre com revisão antes de alterar arquivos ou executar comandos. Bots pessoais e profissionais com equipe ativada em um clique. | Bionic, app separado de agente para código, pesquisa e documentos, com modelos locais, remotos (LM Link) ou na nuvem do LM Studio. [L8] Conversa com documentos (RAG) offline no LM Studio. [L2][L11] |
| Funções extras | Ponte para DaVinci Resolve Studio (cortes propostos por metadados, nova timeline após revisão); catálogo com mais de mil entradas (inclui variantes), RAM estimada, hashes e downloads retomáveis. | Busca e download de modelos do Hugging Face, presets, decodificação especulativa, requisições paralelas, modo headless (`llmster`). [L2][L3] |
| Idioma da interface | Português (o site tem 7 idiomas). | Interface em vários idiomas (“LM Studio in your language”). [L3] |
| Preço e licença | Download e execução de modelos locais compatíveis sem custo e sem conta. Plano Pro opcional ainda sem cobrança pública. Software proprietário, de código fechado, com todos os direitos reservados. Os componentes de terceiros e os modelos mantêm suas próprias licenças. | Gratuito para uso pessoal e no trabalho. [L12] Planos pagos opcionais (Bionic+ e Pro) para modelos na nuvem. [L7] Software proprietário, licenciado para uso pessoal ou interno. [L13] |
| Maturidade | Alfa. Pacote Mac com assinatura ad hoc, sem notarização Apple; sem suporte universal a modelos ou hardware. | Atualizações frequentes (0.4.26 em 13/10/2026). [L9] |

## Quando cada um faz mais sentido

**O LM Studio tende a atender melhor** se você quer principalmente rodar e servir LLMs; precisa de uma API ampla (Responses, Embeddings, Anthropic) ou de SDKs; quer usar seus modelos em vários dispositivos com LM Link; usa Windows/Linux com GPU; ou precisa de uma interface em outro idioma.

**O LocalNeuron tende a atender melhor** se você quer texto, voz, imagem, vídeo e música no mesmo espaço local, em português; quer dividir um modelo entre Macs com EXO; quer compartilhar uma IA com chave e cota por cliente pela Minha API; ou quer bots especialistas com permissões e revisão de ferramentas.

## Usar os dois

Não é preciso escolher. O LocalNeuron não depende do LM Studio: os motores integrados funcionam sem ele aberto. Se você já tem modelos GGUF na pasta padrão do LM Studio (`~/.lmstudio/models`), o LocalNeuron os encontra e reutiliza sem copiar os pesos. A Minha API usa a porta 4320. O servidor local do LM Studio costuma usar a 1234 [L4]. A integração do LocalNeuron com esse servidor usa a porta 8080 (`127.0.0.1:8080` em `src/model-library.ts`): para o app reconhecê-lo como motor externo, inicie o LM Studio nessa porta. Com o LM Studio na 1234, os dois podem ficar instalados no mesmo computador. Cada modelo carregado ocupa sua própria memória.

## O que esta página não compara

- **Velocidade.** Não publicamos benchmarks. O desempenho depende do modelo, da quantização, do contexto e do hardware; compare no seu próprio computador.
- **Qualidade das respostas.** Ela depende dos pesos do modelo, não do aplicativo. Nenhum dos dois torna um modelo mais inteligente.
- **Todas as funções.** Os dois mudam com frequência. Confira a documentação oficial de cada um antes de decidir.

Viu um erro sobre o LM Studio ou sobre o LocalNeuron? [Abra uma issue](https://github.com/Arthur06311/localneuron/issues) com a fonte, e esta página será corrigida.

## Fontes

Sobre o LocalNeuron: [README](https://github.com/Arthur06311/localneuron#readme), [guia de configuração](https://localneuron.ai/guide.html), [Minha API](https://github.com/Arthur06311/localneuron/blob/main/docs/minha-api.md), [Rede EXO](https://github.com/Arthur06311/localneuron/blob/main/docs/exo.md), [MLX independente](https://github.com/Arthur06311/localneuron/blob/main/docs/mlx-independente.md), [Estúdio criativo](https://github.com/Arthur06311/localneuron/blob/main/docs/creative-studio.md) e [componentes de terceiros](https://github.com/Arthur06311/localneuron/blob/main/THIRD_PARTY.md).

Sobre o LM Studio (consultado em 18/10/2026):

- [L1] [System Requirements](https://lmstudio.ai/docs/app/system-requirements)
- [L2] [Welcome to LM Studio Docs](https://lmstudio.ai/docs/app)
- [L3] [Offline Operation](https://lmstudio.ai/docs/app/offline) e [Use MCP Servers](https://lmstudio.ai/docs/app/mcp)
- [L4] [OpenAI Compatibility Endpoints](https://lmstudio.ai/docs/developer/openai-compat)
- [L5] [Developer Docs](https://lmstudio.ai/docs/developer)
- [L6] [LM Link](https://lmstudio.ai/docs/lmlink)
- [L7] [Pricing](https://lmstudio.ai/pricing)
- [L8] [Bionic](https://lmstudio.ai/docs/bionic)
- [L9] [Changelog](https://lmstudio.ai/changelog/lmstudio)
- [L10] [Authentication](https://lmstudio.ai/docs/developer/core/authentication)
- [L11] [Chat with Documents](https://lmstudio.ai/docs/app/basics/rag)
- [L12] [Free to use at Home, and now also at Work](https://lmstudio.ai/blog/free-for-work)
- [L13] [App Terms of Service](https://lmstudio.ai/app-terms)
