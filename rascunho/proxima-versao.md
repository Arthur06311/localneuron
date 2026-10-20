# RASCUNHO — textos da próxima versão

Este arquivo é rascunho. Não é página do site e não deve ser publicado.

Os parágrafos abaixo só repetem o que está no código ou na documentação de `main` no momento desta nota. Onde a interface e a documentação usam nomes diferentes, os dois nomes aparecem. Nada aqui descreve a versão instalada 0.28.1.

Fontes consultadas: `docs/configuracao.md`, `docs/api.md`, `docs/exo.md`, `public/app.js`, `public/ux.js`, `public/server-mode.js`, `src/server-gateway.ts`, `src/server-mode.ts`.

## Configurações

Na tela de preferências, o rótulo de seção é **CONFIGURAÇÕES** e o título continua **Preferências**. O texto de apoio é “Aparência, dados, memória e seu motor local.” O item do menu, em Conta, continua **Preferências**.

A mesma tela diz que a aparência usa os botões **Claro**, **Escuro** e **Sistema** no topo, e que a escolha fica salva neste dispositivo.

Fonte: `public/app.js` (a função da página `settings`) e `public/index.html` (o botão Preferências).

## Entrada direta, sem pedir senha

O guia de `main` descreve a abertura assim: o aplicativo entra direto no espaço. O LocalNeuron não pede senha para abrir. Uma chave aleatória, criada pelo aplicativo, protege o cofre com AES-256-GCM e scrypt. No aplicativo instalado, essa chave fica cifrada no armazenamento seguro do sistema: Keychain no macOS, DPAPI no Windows e libsecret no Linux. Ela não aparece na tela e não fica em texto claro.

Quem já tinha senha vê esse pedido uma única vez. Se a senha estiver errada, o cofre antigo permanece intacto. Não há senha opcional. Nas aberturas seguintes, o aplicativo entra direto.

Na tela de preferências, o bloco do cofre diz: o aplicativo abre direto; a chave é aleatória e fica cifrada no armazenamento seguro do sistema; não há senha para criar nem para lembrar.

Este texto não chama esse fluxo de “código”. O código de 6 dígitos documentado no repositório é o pareamento do modo servidor, na seção da porta 52416.

Fonte: `docs/configuracao.md` e `public/ux.js`.

## Equipes

A interface chama a página de **Equipes**. A seção correspondente da API está titulada **Equipas**.

A ilha não cria outra lista de especialistas. `bot_id` aponta para um bot que já existe em Minha equipe. Nome, papel, instruções, memória e modelo continuam nesse bot.

Os colegas ficam no modelo deste computador. O coordenador pode usar Anthropic, xAI, outro computador ou EXO em loopback. Um modelo de 70B ou mais, EXO, outro computador, Anthropic ou xAI só pode ficar no coordenador. O endereço e o aviso são revistos na hora da chamada. O redirecionamento não é seguido e o token não volta na resposta.

O token do provedor vai para o cofre cifrado. A resposta só devolve `has_token` e `token_hint`.

O EXO da equipe só aceita loopback. Esta API não abre a Minha API nem o EXO na rede.

Fonte: `docs/api.md` (seção Equipas) e o nome **Equipes** em `public/app.js`.

## Porta 52416

O gateway do modo servidor escuta na porta **52416** (`GATEWAY_PORT`). Ele só aceita um endereço de rede local. Escuta aberta para todas as interfaces e endereço público ficam de fora.

O pareamento usa um código de 6 dígitos. O código expira em 60 segundos. Há no máximo 5 tentativas; depois disso é preciso gerar outro. Cada máquina pareada recebe uma chave própria. A interface resume: o código tem 6 dígitos e expira depressa; cada máquina recebe uma chave própria, guardada no cofre; só a rede local entra; nada é aberto para a internet.

A porta **52415** é outra. Enquanto o EXO estiver ligado, ela continua acessível na rede local e não tem senha. O aviso do código diz que os outros computadores falam com este LocalNeuron, não com a porta 52415.

Os papéis documentados para esta participação são **Contribuir**, **Gerenciar** e **Só usar**. Contribuir entra como worker e só está disponível no Mac Apple Silicon com macOS 26.2 ou superior; no Linux em CPU a opção fica marcada como experimental. Gerenciar pede `--force-master`. A opção “não rodar modelo aqui” acrescenta `--no-worker`. O EXO pode eleger outro master. Só usar é o cliente, em qualquer sistema, e não inicia um nó.

Fonte: `src/server-gateway.ts`, `public/server-mode.js`, `docs/exo.md` e `src/server-mode.ts`.
