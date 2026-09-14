# MLX independente — Colmeia 0.6

O pacote Mac inclui Python portátil 3.12.14, MLX 0.32.2 e MLX LM 0.31.3. São bibliotecas abertas usadas diretamente; não há código, executável ou serviço de inferência copiado do LM Studio. O carregador, serviço HTTP local, streaming, integração com ferramentas, cancelamento, limites e interface são da Colmeia. MLX continua sendo a biblioteca da Apple; não foi reescrito do zero nem houve treinamento de novos pesos.

## Usar sem outro programa

1. Abra a Colmeia e desbloqueie com sua senha habitual.
2. Escolha **Qwen3.5 9B MLX 4bit · MLX integrado · Colmeia**. A cópia independente deste modelo já foi preparada na pasta de dados. A origem foi preservada.
3. Em Ferramentas, clique em **Usar offline**. Isso desativa Internet e Terminal. Você ainda pode conversar, consultar o computador e trabalhar nos arquivos da pasta escolhida.
4. Envie sua mensagem. O próprio aplicativo carrega o modelo; LM Studio, Python instalado pelo usuário, conta de provedor e assinatura não são necessários.

O modelo e o aplicativo precisam estar no disco. A instalação/obtenção de outros modelos exige internet ou a transferência de arquivos completos por outro meio. Para incluir outro MLX, **Adicionar MLX** recebe a pasta com config.json, tokenizer e pesos .safetensors, verifica partes e copia os arquivos necessários para a Colmeia. Não copia nem executa arquivos Python do modelo. Pode levar tempo e exige espaço para a cópia.

## Offline e ferramentas

O processo MLX sempre é iniciado com conexões de saída bloqueadas pelo sandbox do macOS. Também usa HF_HUB_OFFLINE, tokenizer local e trust_remote_code=false. Serve somente um modelo local escolhido pelo gerenciador, numa porta efêmera em 127.0.0.1, com chave aleatória privada. Não aceita nomes remotos para baixar modelos durante inferência.

Pesquisa e leitura web pertencem ao assistente e precisam ser habilitadas separadamente. Terminal também pode executar programas com rede depois da revisão; por isso o atalho Usar offline desliga ambos. Isso não desliga a rede do computador nem impede que outros aplicativos a usem. Downloads de modelos são ações separadas, iniciadas pelo usuário.

O chat interpreta ferramentas com o parser fornecido por MLX LM para o template do modelo. Se esse parser não existe, a camada de agente utiliza o protocolo JSON de compatibilidade. Conformidade e qualidade ainda dependem dos pesos. Arquivos e comandos mantêm revisão, cancelamento e limites da versão anterior. Minha API pode servir o modelo MLX como geração de texto; não oferece essas ferramentas ao cliente remoto.

## Memória, desempenho e compatibilidade

Uma IA integrada fica carregada por vez, seja GGUF ou MLX. Trocar descarrega a anterior; fechar ou bloquear encerra o processo. Antes de carregar, o gerenciador estima os pesos, a memória adicional e a margem disponível. MLX aplica limite de alocação, cache de memória limitado e processa o prompt em lotes de 256 tokens. A estimativa não é promessa de RAM total do processo.

O contexto é conferido com o número real de tokens após aplicar o template, incluindo ferramentas e a reserva de saída. Pedidos grandes são recusados em vez de ampliar silenciosamente a janela. O orçamento de raciocínio usa os delimitadores reconhecidos pelo tokenizer. A resposta é transmitida aos poucos e o fechamento da conexão cancela a geração nos pontos de progresso. O MLX desta versão não reutiliza o cache de prompt entre chamadas.

Use 8k de contexto para começar com o 9B neste Mac; outros aplicativos afetam a memória disponível. Modelos maiores podem precisar de mais RAM. Não se alteram limites globais do sistema.

Este pacote MLX é para **Mac Apple Silicon, macOS 14 ou posterior**. Execução real foi verificada somente no Mac atual, macOS 26.6.2; não houve homologação em macOS 14/15. Windows e Linux continuam com o motor GGUF; esse runtime MLX/Metal não é oferecido para esses sistemas. Nem toda arquitetura, tokenizer, quantização ou modelo visual/áudio é suportado.

Não foi demonstrada superioridade geral sobre LM Studio ou equivalência completa ao Bionic. O resultado verificável é independência do serviço externo e suporte direto a inferência MLX local.

## Reproduzir o pacote

`runtime/mlx-manifest.json` fixa Python e todas as wheels por URL e SHA-256. `python3 scripts/fetch-mlx.py` monta o runtime durante a compilação. Esse script não é executado quando o usuário abre o aplicativo. As licenças das dependências acompanham Python e os diretórios .dist-info no pacote. O código-fonte contém o manifesto e o montador; executáveis ficam no pacote Mac, e pesos/dados do usuário ficam fora dele.

Fontes: [MLX da Apple](https://ml-explore.github.io/mlx/build/html/index.html), [MLX LM](https://github.com/ml-explore/mlx-lm), [Python portátil](https://github.com/astral-sh/python-build-standalone).
