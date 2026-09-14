# Motor integrado e assistente — Alfa 0.5

Colmeia agora executa GGUF diretamente, sem precisar do LM Studio. O pacote inclui **llama.cpp b10809**, a revisão indicada pela versão estável upstream v0.4.0 em 09/09/2026. A camada de gerenciamento, conversa, ferramentas e revisão é implementada no próprio aplicativo. Não houve treinamento de novos pesos nem cópia do código do Bionic. A conversa recebe informações confirmadas sobre o motor, a execução local e as ferramentas habilitadas, para responder sobre o próprio ambiente.

## Usar

1. Abra a Colmeia e use sua senha habitual.
2. Escolha no Chat uma IA marcada **integrado**. Os GGUF baixados nas versões anteriores são encontrados na pasta padrão do LM Studio e reutilizados sem copiar os pesos. Novos downloads ficam na pasta de modelos da Colmeia.
3. Em **Ferramentas**, mantenha Assistente ativo. Computador consulta sistema, CPU, RAM e data. Internet pesquisa e lê páginas públicas, mostrando as ações na conversa.
4. Para trabalhar em arquivos, clique em **Escolher pasta** e ative Arquivos. O aplicativo lê texto/código dentro dessa pasta, lista e pesquisa arquivos e propõe alterações.
5. Uma alteração mostra o conteúdo proposto antes de executar. Autorize ou recuse a ação. Arquivos criados têm botão de download; substituições preservam uma cópia anterior para baixar.
6. Terminal é opcional e separado. Cada comando mostra texto e pasta antes de executar, com seus privilégios do sistema, **sem sandbox**. Parar cancela a ação pendente ou o processo em execução. Uma alteração já confirmada não é desfeita por Parar.

A seleção da pasta é feita por diálogo nativo no desktop; no navegador, informe o caminho completo. Arquivos são lidos localmente; consultas web são enviadas ao provedor/site. Após a IA ler arquivos na conversa, cada nova consulta externa exige revisão do texto/URL a enviar. A API compartilhada continua sendo somente geração de texto e **não concede essas ferramentas ao cliente remoto**.

## Motor e desempenho

- Execução própria de um processo llama-server por aplicativo, ligado apenas ao loopback, com chave aleatória independente e porta efêmera.
- Uma sessão de inferência e contexto solicitado explicitamente. O aplicativo confere o contexto retornado pelo processo; não aceita ajuste silencioso para um contexto maior.
- Flash Attention, reutilização de prompt, lote de entrada limitado e orçamento de raciocínio por requisição. Uma chamada pode ser interrompida.
- Verificação de memória antes e após carregar. Trocar a IA integrada descarrega a anterior. Bloquear ou fechar descarrega o processo integrado. A mesma IA pode responder à Minha API; trocar o modelo compartilhado exige desligar a API.
- Mac ARM64 usa o backend Metal. Pacotes Windows/Linux x64 incluídos usam CPU; não se promete a mesma velocidade. Na versão 0.6, MLX também tem motor próprio integrado no Mac. Consulte [MLX independente](mlx-independente.md). Outras configurações externas de aceleração continuam disponíveis pelo LM Studio.
- Novos modelos precisam de arquitetura, tokenizer e template reconhecidos pela revisão do runtime. GGUFs multipartes, imagens, áudio, embeddings e toda combinação de quantização/hardware não foram homologados. Não existe garantia de compatibilidade com todos os modelos existentes.

O catálogo continua com 29 arquivos. Modelos maiores não são automaticamente melhores para todas as tarefas. Ferramentas acrescentam informações atuais e capacidade de agir; qualidade de raciocínio continua dependendo dos pesos, do contexto e da pergunta. Não foi demonstrada superioridade geral sobre Bionic.

## Ferramentas e limites

Há oito ferramentas: `computer_info`, `web_search`, `web_read`, `files_list`, `files_read`, `files_search`, `files_write` e `terminal_run`.

O agente usa até oito rodadas de ferramentas antes da resposta final. Retornos têm tamanho limitado para caber no contexto. Erros são devolvidos à IA como erros; resultados não são inventados pelo controlador. Modelos sem bom suporte nativo podem usar **Compatibilidade com o modelo → JSON**, um protocolo de texto estruturado. A conformidade depende do modelo; respostas malformadas não concedem acesso a ferramentas desconhecidas.

A busca usa páginas públicas do Bing, sem chave paga. Pode ser limitada pelo provedor ou mudar de formato; uma falha é mostrada, sem burlar verificações. Links públicos podem ser lidos diretamente. A ferramenta não usa cookies do navegador do usuário, não se autentica em sites e não controla páginas interativas ou a tela do computador. Voz, visão e controle visual de aplicativos não estão implementados nesta versão. Comandos do terminal só executam depois da revisão explícita.

A leitura web valida protocolo, credenciais, porta, DNS e cada redirecionamento. A conexão é fixada ao IP público validado; loopback, rede privada e endereços reservados são recusados. Limites: 1,5 MB por página, leitura de texto, timeout e cancelamento. Scripts não são executados. Páginas e arquivos entram como dados de ferramenta, sem acesso a sessão, chave do motor ou chave de API.

Arquivos usam caminhos relativos, checagem de pasta real, recusa de links simbólicos, extensões de texto e bloqueio de nomes comuns de credenciais. Leitura: 128 KiB por arquivo, em trechos de 12 mil caracteres com continuação por offset; busca: até 200 arquivos e 40 resultados. A gravação confere alterações desde a prévia e usa arquivo temporário com substituição atômica. Isso não substitui uma sandbox de sistema contra um processo local malicioso concorrente. O terminal tem timeout de 30 segundos e saída de até 64 mil caracteres; rede, subprocessos e filesystem seguem as permissões do usuário após autorização.

## Reprodução

`runtime/manifest.json` fixa URLs, tamanhos e SHA-256 dos três arquivos oficiais. Licença MIT do llama.cpp em `runtime/LICENSE.llama.cpp`.

```sh
npm ci
python3 scripts/fetch-runtime.py darwin-arm64
npm test
npm run desktop
```

Use `win32-x64` ou `linux-x64` para os outros pacotes. Os scripts de empacotamento obtêm a revisão fixa quando ausente e incluem somente o runtime da plataforma escolhida. Bibliotecas nativas e dados do usuário permanecem separados. Não há atualização automática remota de executáveis ou modelos.

Fontes: [llama.cpp b10809](https://github.com/ggml-org/llama.cpp/releases/tag/b10809), [servidor llama.cpp](https://github.com/ggml-org/llama.cpp/blob/b10809/tools/server/README.md), [ferramentas na API compatível do LM Studio](https://lmstudio.ai/docs/developer/openai-compat/tools), [Bionic oficial](https://lmstudio.ai/docs/bionic).
