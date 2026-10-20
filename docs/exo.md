# Rede EXO

A Rede EXO permite distribuir um modelo de texto compatível entre vários computadores. O LocalNeuron usa o EXO oficial e sua API; não depende de LM Studio.

## Conectar dois Macs

1. Abra **Rede EXO** no LocalNeuron dos dois computadores.
2. Clique em **Instalar motor EXO** em cada Mac. O pacote oficial tem aproximadamente 394 MiB; é conferido por SHA-256 antes de executar.
3. Copie a **Identificação da rede** do primeiro para o segundo. Use a mesma versão do EXO e a mesma rede local.
4. Clique em **Iniciar neste Mac** nos dois. A API de controle fica só em loopback, a menos que você marque **Expor a API na rede local**. Se o macOS pedir acesso à rede local, permita-o para que as máquinas se encontrem pelo canal de descoberta do EXO. No EXO 1.0.71 essa opção de exposição é obrigatória para iniciar: essa versão não consegue escutar só em loopback.
5. Quando as duas aparecerem, escolha um modelo, mantenha **Mínimo de máquinas: 2** e clique em **Preparar na rede**.
6. Aguarde o download/carregamento. Quando a instância estiver pronta, clique em **Conversar**. O chat, histórico e ferramentas do LocalNeuron continuam disponíveis.

O EXO decide se há memória e conexões suficientes e distribui o modelo. O catálogo desta página vem do EXO conectado, não do catálogo GGUF. Tensores só podem ser selecionados para modelos que declaram suporte; camadas são a opção padrão. Preparar pode baixar arquivos em cada máquina. A primeira preparação exige internet; **Iniciar sem internet** usa o modo offline do EXO para modelos já baixados.

## Requisitos e conexões existentes

- Instalador gerenciado: Mac Apple Silicon, macOS 26.2 ou posterior.
- Linux: instalação pelo projeto EXO; o README da versão declara CPU, com suporte em evolução. Esta integração não instala o motor automaticamente no Linux.
- Windows: pode controlar e conversar com uma API EXO privada de outro computador; não oferece nó de inferência EXO nativo.
- Em **Modo de conexão → Controlar um EXO existente**, informe `http://IP-PRIVADO:52415` e conecte. A identificação e o modo offline configurados no LocalNeuron só afetam o processo iniciado por ele; configure esses valores no EXO externo quando necessário.
- Ethernet/Thunderbolt podem ajudar a comunicação. Mais RAM não significa mais velocidade. RDMA é opcional e requer hardware/configuração específicos; o app não altera configurações de rede ou privilégios do sistema.

## Modo servidor

O ecrã **Modo servidor** pergunta como este computador vai participar. Fica desligado até alguém escolher um papel.

- **Contribuir** entra como worker. Só Mac Apple Silicon com macOS 26.2 ou superior. No Linux em CPU a opção fica marcada como experimental.
- **Gerenciar** pede `--force-master`. A opção **não rodar modelo aqui** acrescenta `--no-worker`. O EXO pode eleger outro master.
- **Só usar** é o cliente, em qualquer sistema, e não inicia um nó.

O mapa lê `GET /state` e desenha um círculo por computador, com a RAM. Uma ligação Thunderbolt ou RDMA sai mais grossa; a rede comum sai fina. Nesta fase o caminho é TCP. RDMA fica para uma fase posterior. **Escolher quais computadores** consulta `GET /instance/previews` e mostra a memória prevista em cada nó. Nada disso liga sozinho.

## Controle e privacidade

Use somente uma rede confiável. A identificação da rede é um namespace de descoberta com 128 bits (`neuron-` e 32 caracteres hexadecimais). Ela limita quais nós se encontram, mas **não é senha da API HTTP** e não cifra o tráfego. A API nativa do EXO não usa a autenticação do LocalNeuron.

Por padrão, o nó gerenciado escuta só em `127.0.0.1` quando o binário aceita `--api-host`. Os endereços da LAN não são anunciados. **Expor a API na rede local** é um opt-in explícito: a página mantém um aviso visível enquanto a exposição estiver ativa. Bloquear o aplicativo desliga esse opt-in e encerra o nó se ele estava acessível pela rede. Um nó preso ao loopback pode continuar neste computador. Não exponha a porta à internet.

O EXO 1.0.71 empacotado não tem opção de bind. No repositório exo-explore/exo, commit `fd707de30b42db4211d15da96b9052e1dc280ed1`, Hypercorn fica fixo em `0.0.0.0:52415` e a CLI só oferece `--api-port`. O `sandbox-exec` do macOS não consegue limitar conexões de entrada ao loopback. Por isso o LocalNeuron recusa iniciar esse binário sem o opt-in. Se você aceitar, a porta 52415 fica aberta em todas as interfaces IPv4, sem autenticação e sem cifra, até desligar ou bloquear o app. Versões posteriores que anunciam `--api-host` no `--help` recebem `127.0.0.1` por padrão e `0.0.0.0` só com o opt-in. O flag aceita um único host; `127.0.0.1` não abre `::` nem a LAN. `::1` não é escutado à parte, para não usar `::`, que abriria todas as interfaces IPv6.

Mensagens e partes do modelo circulam entre os nós. A API de controle do LocalNeuron exige sessão e cofre desbloqueado; endereços EXO aceitos se limitam a loopback e IPs privados.

**Liberar modelo** remove a instância da rede e pode afetar quem a utiliza em outras máquinas. **Desconectar** encerra apenas o processo EXO iniciado pelo LocalNeuron; um servidor externo continua executando. O botão Internet do chat controla as pesquisas do assistente separadamente do modo offline de download do EXO.

Instalação e cache ficam em `local-engines/` dentro do workspace do aplicativo. Arquivos e ferramentas continuam sob as permissões do computador que está executando o LocalNeuron. A assinatura Pro não é necessária para esta integração.

## Versão e validação

EXO 1.0.71, commit `fd707de30b42db4211d15da96b9052e1dc280ed1`. SHA-256 do DMG: `bc81a23ec647a995c5f8237857e749bc3de7ba8ec40f2aab39886c1a04beaac7`.

Os testes verificam endereços privados, estados de duas máquinas, modelo ainda não pronto, perda de nó, preparação pela API oficial e streaming com o ID correto. O fluxo visual preparar → conversar foi validado com uma rede simulada. Execução distribuída real entre duas máquinas e sistemas Windows/Linux ainda exige validação nesses equipamentos.

Código e requisitos: https://github.com/exo-explore/exo/tree/v1.0.71

Validação local adicional: motor oficial instalado neste Mac, API iniciada, 24 GiB reconhecidos e catálogo real consultado. A preparação de Qwen3 0.6B 8bit iniciou o download; a geração real não foi concluída nesta validação por lentidão da transferência. A extração mantém links simbólicos relativos do runtime MLX, verificados após a instalação.

## Controles de máquinas

- **Participar com este Mac** inicia o nó local. Os endereços privados só aparecem se **Expor a API na rede local** estiver ativo. Sem isso, outro computador não recebe um endereço da LAN para copiar.
- **Controlar um EXO existente** aceita um IP simples (porta padrão 52415) ou uma URL privada. Esse modo não acrescenta a RAM do computador controlador.
- Em **Máquinas para esta IA → Escolher os computadores**, marque os nós na lista. O planejamento oficial é consultado, mas a preparação só é enviada se a divisão usar exatamente os nós escolhidos. Se não houver divisão compatível, nenhuma instância é criada. Seleção automática continua disponível.
- Cada computador mostra RAM e modelos associados. Uma instância com nó ausente aparece como desconectada e fica indisponível no chat.
- Liberar modelo exige revisar o impacto nos outros participantes e não apaga os pesos. Não há controle da tela, arquivos, desligamento ou instalação remota do sistema operacional pelo EXO.

Validação: 115 testes automatizados passaram. O fluxo visual com seleção de dois computadores usa um servidor EXO simulado; não representa validação em duas máquinas físicas. A seleção consulta `/instance/previews` da API oficial 1.0.71, verifica o conjunto retornado e só então envia `/instance`.

Consulta adicional ao EXO real, em modo offline neste Mac: `/instance/previews` respondeu HTTP 200 para Qwen3-0.6B-8bit, com divisão Pipeline/MlxRing no nó selecionado. O formato e o ID do modelo foram conferidos. Nenhuma instância nem download foi iniciado nesse teste de planejamento.
