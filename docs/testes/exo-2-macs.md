# Teste manual: EXO em dois Macs

Roteiro para o Arthur executar nos dois computadores. Só a interface do LocalNeuron e o que o EXO 1.0.71 documenta. Não há teste automático neste arquivo.

O app instala o **EXO 1.0.71**. Essa versão acha os outros Macs sozinha na rede local (libp2p) e usa a API na porta **52415**. O código novo do EXO, com Zenoh, ainda não saiu em release: não use as portas 52413 nem 52414.

Guia do produto: [Rede EXO](../exo.md).

Chame os computadores de **Mac A** (onde você conversa) e **Mac B** (só empresta memória).

## 1. Pré-requisitos

Faça a lista nos dois Macs antes de medir qualquer coisa.

1. Os dois são Mac com Apple Silicon. O botão **Instalar motor EXO** só habilita nesse caso, com macOS 26.2 ou posterior.
2. Menu Apple → **Sobre Este Mac**. Anote o texto inteiro da versão. Se o número do build não aparecer, clique no número da versão ou abra **Ajustes do Sistema → Geral → Sobre** e copie a mesma linha nos dois. A fase 2 exige a mesma versão, inclusive o beta.
3. Abra o LocalNeuron. **Conta → Configurações → Atualizações** mostra “Você está no LocalNeuron …”. Anote esse número nos dois. Use a mesma versão.
4. **Conectar → Rede EXO**. Se o motor não estiver instalado, clique em **Instalar motor EXO** nos dois e espere “Motor EXO … instalado neste computador”. Anote essa linha. O pacote deste app é o 1.0.71. Se o número for outro, pare e anote.
5. Escolha um modelo pequeno que apareça no seletor **Modelo** depois que a rede conectar. Se a lista tiver Qwen3 pequeno, use esse: uma consulta anterior neste projeto viu `Qwen3-0.6B-8bit` com divisão por camadas. Se não estiver na lista, use o menor modelo de texto do seletor. A linha embaixo do seletor mostra o id (`id · arquivos: …`). Anote esse id e use o mesmo nas duas fases.
6. Rede confiável, só local. No EXO 1.0.71 a opção **Expor a API na rede local** é obrigatória para **Iniciar neste Mac**: a porta 52415 fica aberta em todas as interfaces IPv4, sem senha. Não encaminhe essa porta no roteador.
7. Como anotar: preencha a tabela da seção 5 na hora. A linha debaixo da resposta do chat mostra o tempo e os tokens. O app não mostra tokens/s nem o tempo até o primeiro token: calcule e cronometre como a seção 2 manda.

| Item | Mac A | Mac B |
| --- | --- | --- |
| macOS (texto completo) |  |  |
| Build, se aparecer |  |  |
| LocalNeuron |  |  |
| Linha “Motor EXO …” |  |  |
| Nome e chip na lista de computadores |  |  |
| Id do modelo |  |  |

Ajustes do chat, iguais nas duas fases, no Mac A:

1. **Conversar** abre o chat. Clique em **＋ Nova conversa**.
2. **Ajustes → Ajustar minha IA**: janela de contexto **4k**, tamanho máximo da resposta **512**, criatividade **0**, raciocínio **Desligado, se suportado**.
3. **Contexto automático**: **Manual**.
4. Em **Ferramentas**, desmarque **Assistente com ferramentas** e clique em **Usar offline · desativar Internet e Terminal**.
5. O botão ao lado da caixa de texto fica **Internet desligada**. A nota no rodapé fica “IA distribuída · mensagens enviadas à Rede EXO · pesquisa online desligada”.
6. **Esforço**: **Desligado**.

Prompt curto, para medir:

```text
Conte de 1 a 40, um número por linha, sem texto extra.
```

Prompt longo, só para os testes de falha:

```text
Conte de 1 a 200, um número por linha, sem texto extra.
```

## 2. Fase 1 — Wi-Fi ou Ethernet

Use uma conexão só: os dois no mesmo Wi-Fi, ou os dois no mesmo switch Ethernet. Anote qual. Não precisa de cabo até um “coordenador”. O master é eleito; os dois nós já nascem capazes de sê-lo. O app não envia `--force-master`.

1. Nos dois: **Conectar → Rede EXO**. **Modo de conexão**: **Participar com este Mac**.
2. No Mac A, **Copiar identificação**. No Mac B, cole no campo **Identificação da rede**. O texto começa com `neuron-` e tem 32 caracteres hexadecimais. Isso limita quem se encontra. Não é senha da API.
3. Deixe **Iniciar sem internet** desmarcado na primeira vez, para o modelo poder baixar. Marque **Expor a API na rede local** nos dois. Leia o aviso e só continue se a rede for a sua.
4. **Iniciar neste Mac** nos dois. Se o macOS pedir acesso à rede local, permita.
5. **Atualizar rede**. Os dois passaram quando **Máquinas conectadas** mostra **2**, os dois nomes estão em **Computadores da rede** e o texto diz “Rede conectada. As informações são atualizadas a cada 4 segundos.” Se aparecer “Conectado. Adicione outra máquina…”, ainda há um nó só: pare e veja a seção 6.
6. **Máquinas para esta IA**: **EXO escolhe automaticamente**. **Mínimo de máquinas**: **2**. **Divisão**: **Por camadas · compatível**.
7. **Preparar na rede**. Espere o cartão sair de “Baixando, conectando ou carregando” e ficar **Pronto para conversar**. O percentual de download não entra na medida.
8. **Conversar**. Confira o modelo no seletor do chat (o nome da rede EXO). Aplique os ajustes da seção 1.
9. Envie o prompt curto uma vez e ignore os números. É o aquecimento, com o modelo já pronto.
10. **＋ Nova conversa**. Ligue um cronômetro, clique em **Enviar** e pare o cronômetro no primeiro caractere da resposta. Esse é o tempo até o primeiro token.
11. Quando a resposta terminar, leia a linha debaixo dela, no formato `12.4 s de execução · 80 tokens`. O ponto é o separador decimal que a tela imprime. Tokens/s = tokens ÷ segundos. Se a linha não tiver a contagem de tokens, deixe tokens/s em branco e escreva “sem contagem de tokens”.

O app pede ao EXO a divisão **MlxRing** (anel por TCP, que funciona em Wi-Fi, Ethernet ou Thunderbolt Bridge). Anote “MlxRing” na coluna conexão, junto com Wi-Fi ou Ethernet.

## 3. Fase 2 — Thunderbolt 5 e RDMA

RDMA é o motor **MlxJaccl**, sobre Thunderbolt 5. Só siga esta fase se os dois Macs tiverem Thunderbolt 5. O README do EXO cita Mac mini M4 Pro, Mac Studio M4 Max, MacBook Pro M4 Max e Mac Studio M3 Ultra. Confira o hardware em vez de assumir pelo nome do modelo.

Requisitos, nos dois, antes de medir de novo:

1. macOS 26.2 ou posterior, e o mesmo texto de versão e o mesmo build nos dois. Se o build divergir, não faça a fase 2.
2. Um cabo Thunderbolt 5 direto entre os dois Macs. Com dois Macs, um cabo é a malha inteira. Hub ou switch não servem. No Mac Studio, a porta Thunderbolt 5 ao lado da Ethernet não serve.
3. **Ajustes do Sistema → Rede**: desative o serviço **Thunderbolt Bridge** nos dois. Se não houver um serviço com esse nome, anote os nomes da lista e não trate a ponte como desligada.
4. RDMA só liga no modo Recuperação, com `rdma_ctl enable`. Não funciona por ssh nem com sudo no sistema normal. Desligue o Mac, segure o botão de força até as opções de inicialização e abra **Opções**. No Terminal dessa tela:

```sh
rdma_ctl enable
```

5. Repita no outro Mac. Reinicie os dois no sistema normal.

Como ver se o RDMA ficou ativo:

1. O LocalNeuron não mostra o tipo da conexão. Suba os dois nós de novo, como na fase 1 (mesma identificação, **Iniciar neste Mac**).
2. No Safari do Mac A, abra `http://127.0.0.1:52415/state`. Busque na página `rdma`, `jaccl`, `MlxJaccl`, `MlxRing` e `socket`. Copie as linhas que aparecerem para as observações. Se nenhuma aparecer, escreva “tipo de conexão ausente no /state”.
3. Se, no Terminal do sistema normal, `rdma_ctl` existir e a ajuda listar um subcomando de consulta, rode esse subcomando e cole a saída. Se o comando não existir fora da Recuperação, escreva isso. Não invente a saída.

Medir de novo:

1. **Liberar modelo** na instância antiga, se ela ainda existir. Liberar tira a instância da rede e não apaga os arquivos.
2. **Preparar na rede** outra vez, com o mesmo modelo, mínimo 2 e **Por camadas**.
3. Repita o aquecimento e o prompt curto da fase 1. Mesmos ajustes. Anote tokens/s e o tempo até o primeiro token.

O que esta fase mede: **Preparar na rede** continua enviando `MlxRing`, na escolha automática e também quando se filtra **Escolher os computadores**. O app não pede `MlxJaccl`. A comparação com a fase 1 só é uma comparação de RDMA se o `/state` mostrar RDMA ou MlxJaccl. Se mostrar MlxRing ou socket, anote “RDMA não entrou na instância” e registre os números mesmo assim. Não chame a API na mão para trocar o motor.

## 4. Falhas

Comece com as duas máquinas visíveis e a instância em **Pronto para conversar**. Use o prompt longo. Entre um teste e o outro, suba de novo quem saiu (**Iniciar neste Mac**, mesma identificação) e espere **Máquinas conectadas** voltar a 2. Se a instância ficar indisponível, **Preparar na rede** de novo.

### 4.1 Um nó sai no meio da geração

1. No Mac A, conversa nova, prompt longo, **Enviar**.
2. Enquanto o texto ainda cresce, no Mac B clique em **Desconectar**. Pode, no lugar disso, desligar o Mac B. Faça um dos dois.
3. No Mac A, **Conectar → Rede EXO → Atualizar rede**.

Esperado: a resposta para ou mostra erro. O cartão fica **Máquina desconectada · modelo indisponível**, ou a lista fica com uma máquina. O chat deixa de tratar essa instância como pronta.

- [ ] Passou — a geração interrompeu e a tela mostra a máquina ausente ou um erro
- [ ] Falhou — a resposta completou e as duas máquinas continuaram listadas com o Mac B desligado
- [ ] Inconclusivo

Anotação:

### 4.2 Cabo Thunderbolt puxado

Faça isto na fase 2, com o cabo Thunderbolt 5 ligado entre os dois, durante o prompt longo.

1. No Mac A, **Enviar** o prompt longo.
2. Enquanto o texto cresce, desconecte o cabo Thunderbolt entre os Macs. Deixe o Wi-Fi ou a Ethernet como estavam.

Esperado, se o `/state` mostrou RDMA ou MlxJaccl: a geração para ou falha. Esse cabo único é a malha inteira.

Esperado, se o `/state` mostrou MlxRing, socket, ou não tinha o tipo: a geração pode seguir pela rede da fase 1. Anote “cabo não era o caminho da geração”.

- [ ] Passou — RDMA confirmado e a geração interrompeu ao sair o cabo
- [ ] Passou — a instância não era RDMA e a geração seguiu; isso ficou anotado
- [ ] Falhou — o `/state` dizia RDMA e a resposta completou com o cabo fora
- [ ] Inconclusivo

Anotação:

### 4.3 Outro nó assume o master

O app não mostra quem é o master e não envia `--force-master`. O EXO elege um master; se ele cai, há nova eleição.

1. Sem geração em andamento, no Safari do Mac A abra `http://127.0.0.1:52415/node_id` e copie a resposta. Repita no Mac B.
2. Se a resposta indicar qual máquina é o master, **Desconectar** nesse Mac.
3. Se as duas respostas não disserem quem é o master, marque inconclusivo, cole o texto e não chute.
4. No Mac que ficou ligado: **Atualizar rede** e abra `/node_id` de novo.
5. No Mac que você desconectou: **Iniciar neste Mac**, mesma identificação. **Atualizar rede** nos dois.

Esperado: o Mac que ficou ligado continua respondendo `/node_id`. Se dava para ler o master antigo, a resposta nova deixa de ser aquele. Ao iniciar de novo, os dois nomes voltam em **Computadores da rede**. A instância antiga pode continuar **Máquina desconectada**; isso é o modelo sem um nó, não a queda do Mac que sobrou. Para conversar de novo, **Preparar na rede**.

- [ ] Passou — o nó restante respondeu e, ao religar o outro, os dois apareceram
- [ ] Falhou — o nó restante parou, ou os dois não se viram de novo com a mesma identificação
- [ ] Inconclusivo — `/node_id` não identificou o master

Anotação:

## 5. Resultados e o que devolver

| Fase | Conexão | Modelo | Tokens/s | Tempo até o primeiro token | Observações |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |

Na conexão, escreva o que você usou e o que conferiu. Exemplos do que preencher, sem inventar o número: `Wi-Fi · MlxRing`, `Ethernet · MlxRing`, `TB5 · /state mostrou MlxJaccl`, `TB5 · /state mostrou MlxRing · RDMA não entrou na instância`.

Mande de volta:

1. A lista da seção 1 e esta tabela.
2. As três caixas da seção 4, com a anotação.
3. O texto de `/node_id` e as linhas do `/state` que citam a conexão ou o motor (`MlxRing`, `MlxJaccl`, socket, RDMA).
4. O texto de erro do cartão da instância, se aparecer.

Não mande a identificação da rede, outras conversas nem capturas com arquivos pessoais.

## 6. Problemas e como desfazer

- **Só uma máquina aparece.** Confira a mesma identificação, a mesma rede, a permissão de rede local e **Iniciar neste Mac** nos dois. **Atualizar rede**. Não abra a porta na internet para “ajudar” a descoberta.
- **O início é recusado.** No 1.0.71 marque **Expor a API na rede local**. Sem isso o app não sobe o binário, porque ele não oferece bind em loopback.
- **“Já existe um EXO na porta 52415.”** **Desconectar**, ou use **Controlar um EXO existente** com o IP privado (a porta padrão é 52415). Não suba um segundo processo.
- **“Não há máquinas suficientes.”** O mínimo está em 2 e a lista tem uma máquina.
- **“Este modelo não informa suporte a divisão por tensores.”** Volte para **Por camadas · compatível**.
- **“O EXO não encontrou uma divisão usando exatamente as máquinas selecionadas.”** Deixe **EXO escolhe automaticamente**.
- **A preparação fica em download.** A primeira vez precisa de internet. **Iniciar sem internet** só serve para modelo já baixado. O teste de velocidade começa depois de **Pronto para conversar**.
- **RDMA trava, cai depois de parado ou só volta se os dois reiniciarem.** Há relatos abertos disso no EXO. Reinicie os dois Macs e anote. O app não tem um botão para corrigir o RDMA do sistema.
- **Mac Studio.** Não use a porta Thunderbolt 5 ao lado da Ethernet.

Mais RAM somada não garante mais tokens/s. A rede pesa.

Para encerrar:

1. Com os dois ainda visíveis, **Liberar modelo** se a instância existir. Isso afeta quem estiver usando o modelo no outro Mac e não apaga os pesos.
2. **Desconectar** nos dois. Isso encerra o EXO que o LocalNeuron iniciou.
3. **Bloquear aplicativo**, na barra lateral, desliga a exposição na rede e encerra o nó se ele estava acessível pela rede.

Para desfazer a fase 2:

1. **Ajustes do Sistema → Rede**: reative o serviço **Thunderbolt Bridge** que você desligou.
2. O README do EXO documenta `rdma_ctl enable` na Recuperação e não documenta aqui um subcomando para desligar. Volte ao modo Recuperação, rode `rdma_ctl` sem argumentos e, se a ajuda listar um subcomando para desligar, use esse e anote o nome. Se a ajuda não listar, deixe o RDMA como está e escreva isso no relatório.
