# Rede de saída do LocalNeuron

Este documento lista cada chamada de rede que o aplicativo pode fazer. O padrão é ficar no computador. Não há análise de uso, identificador de máquina, relatório de falha enviado para fora, nem telemetria. Essa escolha fica com quem mantém o projeto: este arquivo não liga nenhum coletor.

Nada abaixo envia, por conta própria, o conteúdo do chat, caminhos de arquivos pessoais, chaves ou um identificador estável da máquina. Onde uma chamada pode revelar o endereço IP ou um dado que a pessoa pediu para enviar, isso está escrito na linha.

## O que não sai do computador

Estas conversas usam `127.0.0.1` (ou o endereço de loopback equivalente) e não atravessam a rede da casa nem a internet.

| O quê | Quando | O que viaja |
| --- | --- | --- |
| Painel e API local (`http://127.0.0.1`, porta 4317 no terminal ou 4318 no aplicativo) | O tempo todo, depois que o aplicativo abre | Sessão, conversas e arquivos. Só o próprio computador. Um pedido com outro Host, outra origem, `Sec-Fetch-Site: cross-site` ou um par que não seja loopback é recusado. |
| Motor de texto embutido (llama.cpp) e MLX | Quando um modelo local está carregado | Texto da conversa, só no processo local. |
| LM Studio, se a pessoa já o tiver aberto | Quando a biblioteca procura um motor local | Pedido à API local do LM Studio. Não é um serviço da LocalNeuron. |
| EXO em loopback (`127.0.0.1:52415`) | Quando a rede EXO local está ligada | Estado e geração no motor local. |
| Motor de música ACE-Step | Quando a pessoa instala ou gera música | Prompt e áudio no motor local. O diagnóstico mostrado no painel não devolve a chave nem o caminho da pasta pessoal. |
| Gateway do modo servidor (`52416`) | Só se a pessoa ligar o modo servidor | Pareamento na rede local. Não abre escuta em `0.0.0.0`. |

## Chamadas que podem sair, e só com um ato da pessoa

| Destino | Quando | O que o destino consegue ver | O que não é enviado |
| --- | --- | --- | --- |
| `https://raw.githubusercontent.com/Arthur06311/localneuron/gh-pages/releases.json` | Consulta de atualização. Desligada em instalação nova. Continua ligada só se o arquivo local já tiver `automatic: true`, ou se a pessoa marcar a opção, ou se usar «Verificar agora». No máximo a cada 6 horas quando a opção está ligada. | Endereço IP e o cabeçalho `User-Agent: LocalNeuron`. Sem versão do Node, sem versão do aplicativo, sem identificador. | Conversas, caminhos, chaves, nome da máquina. O manifesto é baixado com redirecionamento proibido e tamanho limitado. O link de download, se a pessoa clicar, é só um endereço público do GitHub já conferido contra a lista de instaladores. |
| `https://huggingface.co` e CDNs `*.huggingface.co` / `*.hf.co` | Pesquisa, ficha ou download de modelo que a pessoa pediu. | Endereço IP, `User-Agent: LocalNeuron` e, só para `https://huggingface.co`, o token de leitura se a pessoa conectou a conta. O token fica cifrado no cofre. | O token não vai no cabeçalho para outro domínio. Conversas não vão nesta chamada. |
| Provedor da equipe: `https://api.anthropic.com`, `https://api.x.ai` ou uma API compatível que a pessoa configurou | Só quando a pessoa cria um provedor, confirma que o texto sai do computador e envia uma mensagem da equipe. | O texto dessa mensagem e o token do provedor, para aquele destino. Um nome público precisa resolver só para endereços públicos. «Outro computador» também aceita, na gravação e no envio, nome de rede local ou VPN (`.local`, `.lan`, `.home.arpa`, `.ts.net`) e IP privado quando a pessoa marcou essa rede. Metadados e link-local continuam recusados. Há uma janela pequena entre essa consulta e o `fetch` do sistema: o resolvedor do sistema ainda pode mudar a resposta. | Outras conversas e caminhos locais. Segredos são retirados da mensagem de erro. |
| Ferramenta web (Bing e a página pública pedida) | Só se a pessoa autorizar a ferramenta na conversa. | A consulta ou a URL pública, `User-Agent: LocalNeuron/<versão> (+local AI; read-only)`. O endereço é conferido de novo em cada redirecionamento e a resposta para no 1,5 MB. | Páginas internas, metadados de nuvem, rede privada e endereços com credencial. |
| Servidor MCP HTTP | Quando a pessoa adiciona um servidor. HTTP só em loopback. HTTPS com nome público. HTTPS para IP privado, nome `.local` ou VPN só se essa conexão estiver marcada como rede confiável, opção desligada por padrão. A autorização externa em loopback só é aceita se o próprio MCP já está em loopback. | O que o servidor MCP pedir dentro da origem combinada. | Outra origem, metadados, link-local e, sem a marca de rede confiável, rede privada. HTTPS em loopback continua recusado. |
| Instalador do EXO `https://github.com/exo-explore/exo/releases/download/v1.0.71/EXO-1.0.71.dmg` | Quando a pessoa pede para instalar o EXO no Mac. | Endereço IP. O download segue redirecionamento apenas para `github.com`, `release-assets.githubusercontent.com` e `objects.githubusercontent.com`, e o arquivo é conferido pelo SHA-256. | Conversas e chaves. |
| Serviço de assinatura configurado em `subscription-config.json` | Só se essa URL estiver preenchida e a pessoa atualizar a licença, abrir checkout ou portal. O painel também pode renovar uma licença vencida. | Identificador `device` (UUID criado neste computador) e o segredo da licença, para essa URL. Checkout e portal devolvem um endereço `checkout.stripe.com` ou `billing.stripe.com`. | Conteúdo do chat. Esta chamada faz parte da licença e não foi alterada nesta revisão. |
| `https://api.stripe.com` | Só no serviço de cobrança separado (`billing-service`), que não acompanha o aplicativo de mesa. | Dados de cobrança daquele serviço. | Não é o padrão de quem só abre o LocalNeuron. |

## O que fica de fora de propósito

- Nenhum coletor de análise, crash report ou ping de presença é iniciado. Relatórios de falha permanecem na máquina.
- O aplicativo não lê um identificador de hardware para enviar a lugar nenhum.
- Chaves de Hugging Face, da equipe e de conexões MCP ficam em arquivo cifrado com a chave do cofre. A chave do cofre no aplicativo de mesa usa o cofre do sistema (`safeStorage`) quando ele existe e não é o modo fraco `basic_text` do Linux. Sem isso, a chave cai num arquivo local de permissão `0600`. O segredo de licença em `subscription.json` continua em texto, porque a licença não foi alterada.
- Abrir a API «Minha API» ou o modo servidor na rede da casa é uma opção da pessoa. A API exige chave e recusa `Sec-Fetch-Site: cross-site`. Em loopback, o Host e a Origin podem ser `127.0.0.1`, `localhost` ou `[::1]`, sempre com a porta real. `host.docker.internal` é recusado: um nome de contentor não pode apresentar-se como a API deste computador. Na rede da casa, o Host tem de ser o endereço anunciado.
