# Equipes — especificação de interface

Documento para implementação. Não altera o aplicativo. O mockup em `mockup.html` e as marcas em `mascotes/` são a referência visual. Tom da interface: sóbrio, frases curtas, sem diminutivos.

A ilha segue o padrão do PR #9 (commit `dbb5cdc`): ícone e cor próprios, item atual com a palavra **Atual** via `content: "Atual" / ""`, `aria-current="page"`, foco `:focus-visible`, `prefers-reduced-motion`, escala e espaçamento dos tokens existentes, contraste WCAG 2.1 AA, e layout até 320px.

## 1. O que é

Equipes é uma ilha nova. Uma equipe reúne agentes no mesmo pedido. Eles se respondem em rodadas, com um coordenador. Cada agente tem marca, função e um lugar onde o modelo roda.

A página existente **Minha equipe** (`data-page="team"`, ilha Trabalhar) permanece. Não migrar bots, não reaproveitar o organograma e não remover o destino. Equipes usa registros novos.

## 2. Modelo: local menor primeiro

O padrão de um agente novo é um **modelo local já instalado**, o menor que esteja pronto. A lista local ordena por tamanho crescente. Não pré-selecionar EXO, API remota, Anthropic nem Grok.

70B ou mais é opção avançada, fechada por padrão:

| Opção | Quando |
| --- | --- |
| Este computador | Padrão. Não pede chave. O texto não sai da máquina. |
| Rede EXO | Avançado. Modelo que não cabe em um computador. Exige a rede EXO ligada. |
| API em outro computador | Avançado. Servidor do usuário, endereço privado. |
| Anthropic | Avançado. Chave do usuário. O texto sai deste computador. |
| Grok | Avançado. Chave do usuário. O texto sai deste computador. |

Se não houver modelo local, o agente fica em Atenção com `local-missing`. Não saltar para um backend avançado.

## 3. Ilha na navegação

Ordem: Trabalhar, Equipes, Criar, Conectar, Conta.

- Grupo: `data-nav-island-group="teams"`.
- Gatilho: **Equipes** / **Agentes no mesmo pedido**. `aria-expanded`, `aria-controls="nav-island-teams"`.
- Itens: **Visão da equipe** (`data-page="equipes"` `data-equipes-view="visao"`) e **Conversas** (`data-equipes-view="conversas"`).
- A ilha fica `data-current="true"` nas duas vistas. O item da vista aberta leva `aria-current="page"` e a palavra Atual. O outro não.
- Ícone `teams` em `public/icons.js`, traço 1.6, `currentColor`, 16px: dois círculos de cabeça e dois arcos de ombro. Sem preenchimento colorido além do estado já usado pelas ilhas (ícone vazado no repouso, preenchido com `--island-on` quando a ilha está aberta ou atual).

No topo estreito (≤720px) a grade passa de 4 para **5 colunas**. Os cinco nomes continuam visíveis, sem reticências e sem “•••”. O menu de Equipes abre alinhado à esquerda da ilha; se passar da janela, alinhar à direita da ilha. Itens com pelo menos 40px de altura.

## 4. Layout

Área de trabalho, da esquerda para a direita, acima de 1100px:

1. **Lista** (248px): seletor de equipe, busca, seções, agentes, conversa da equipe.
2. **Conversa** (flex): cabeçalho, registro, compositor.
3. **Detalhes** (280px): esta conversa, agente em foco, resumo da equipe.

Entre 721px e 1100px o painel de detalhes vira o disclosure **Detalhes** acima do compositor. Lista e conversa continuam lado a lado.

Até 720px é troca de tela, não coluna empilhada:

- `data-pane="lista"`: só a lista.
- `data-pane="conversa"`: só a conversa, com **← Equipes** (mínimo 40px) voltando à lista e devolvendo o foco ao item que abriu a conversa.
- Visão da equipe ocupa a área inteira sob as ilhas, sem lista ao lado.

A visão da equipe é uma grade de cartões: nome da equipe, quantidade de agentes, modelo predominante, estado (palavra + símbolo). **Nova equipe** é o botão primário. Equipe vazia usa o texto da seção 10.

## 5. Dados que a interface precisa

```ts
type Mark = "norte" | "grade" | "lente" | "traco" | "selo" | "marco";
type Status = "pronto" | "trabalhando" | "concluido" | "atencao";
type Attention =
  | "local-missing" | "exo-offline" | "remote-offline"
  | "key-missing" | "key-invalid" | "bad-address" | "work-stopped";

type Backend =
  | { kind: "local"; modelKey: string }
  | { kind: "exo"; modelId: string }
  | { kind: "remote"; baseUrl: string; modelId: string }
  | { kind: "anthropic"; modelId: string }
  | { kind: "grok"; modelId: string };

type Agent = {
  id: string; name: string; role: string; mark: Mark;
  sectionId: string | null; lead: boolean;
  backend: Backend | null; status: Status;
  attention?: Attention; unread: number;
};
```

Nome 1–40 caracteres. Função 1–80. Uma equipe tem no máximo um `lead`. Rodadas: 1 a 3, padrão 2.

A chave não entra no objeto. Referência no cofre: `equipes:{agentId}:anthropic` ou `:grok`. Depois de salvar, a interface só recebe `{ configured: true, last4 }`. Campo `type="password"`, `autocomplete="off"`. Não logar, não recolocar a chave inteira na tela, não ecoar em mensagem de erro.

Mensagem da conversa: `user`, `agent` ou `handoff`. `handoff` cita origem e destinos. Token e rodada vêm no objeto da mensagem de agente. Texto em curso chega no mesmo nó, com `pending: true`.

## 6. Componentes e estados

Estados visuais comuns: repouso, hover (`background: var(--eq-panel-2)`), foco (`outline: 3px solid var(--focus); outline-offset: 2px`), ativo, desabilitado, trabalhando, não lidas, erro. Desabilitado não usa opacidade no texto: cor `--eq-muted`, `aria-disabled="true"`, sem `pointer-events` no clique. O contraste do texto desabilitado permanece ≥ 4,5:1.

### Linha de agente

Grade: marca 28px, nome e função, canto direito. Mínimo 44px de altura.

| Estado | Além do hover/foco |
| --- | --- |
| Atual | Fundo `--eq-panel-2`. Palavra Atual no `::after` com `content: "Atual" / ""`. `aria-selected="true"` e `tabindex="0"`. |
| Pronto | Subtítulo é a função. Marca `*-pronto.svg`. |
| Trabalhando | Subtítulo **Trabalhando**. Marca `*-pensando.svg`. Palavra na cor `--eq-warn`. |
| Concluído | Subtítulo **Concluído**. Marca `*-concluido.svg`. |
| Atenção | Subtítulo **Atenção · {motivo curto}**. Marca `*-atencao.svg`. |
| Não lidas | Número em `--eq-muted`, tabular. Acima de 9, mostrar `9+`. |
| Desabilitado | Sem backend e sem ação de abrir conversa. O botão **Escolher modelo** da visão, ou a linha, abre o diálogo. |

A linha atual pode estar trabalhando ao mesmo tempo. Atual fica no canto; o estado fica no subtítulo. Não usar só um ponto colorido.

Nome acessível, nesta ordem: nome, função, estado, motivo se houver, “N novas” se `unread > 0`. A imagem da marca tem `alt=""`.

### Conversa da equipe

Primeira opção da lista, fora das seções. Abre o registro único. Mensagem do usuário: nome **Você**. Mensagem de agente: marca, nome, selo **coordenador** só no líder, hora e tokens. Passagem entre agentes é um parágrafo, não um balão:

`Entre agentes · {origem} passou para {destinos}`

Separador de rodada: `Rodada {n}`, caixa alta, 11px, cor `--eq-faint`.

### Cabeçalho da conversa

Chips de texto, não só cor: **… Trabalhando** (só enquanto houver agente em trabalho), **Rodada n de N**, **{usados} / {teto} tokens**, **Modelo {nome} · local** (ou o nome do backend avançado se a equipe não for toda local). Ações: **Limites**, **Parar**. **Parar** habilita quando há trabalho em curso.

### Painel de detalhes

Três blocos: **Esta conversa** (rodadas, tokens, duração), **{agente em foco}** (modelo, onde roda, estado), **Equipe** (quantidade, “Local, o menor” ou “Misto”, Avançado ligado ou desligado). A barra de tokens é `aria-hidden="true"`; o número é o texto. Não anunciar a barra.

### Diálogo Novo agente / Editar

Foco no nome ao abrir. Escape ou **Cancelar** devolve o foco ao controle que abriu.

1. Nome, função, marca (seis rádios com a figura e o nome da marca), seção opcional (lista existente ou **Nova seção**).
2. **Onde este agente roda.** Rádio **Este computador** selecionado. Combo de modelos locais, menor primeiro. Texto: “Recomendado. O menor modelo local pronto.”
3. Disclosure fechado **Modelos grandes**: EXO, API em outro computador, Anthropic, Grok. Texto: “O texto sai deste computador nos serviços externos. EXO usa a sua rede.”
4. Campos condicionais e **Testar**. **Salvar** só habilita com teste ok, ou com modelo local já instalado (teste local pode ser a presença do modelo, sem geração).

Seção apagada não apaga agentes: eles vão para o grupo **Sem seção**. Esse grupo só aparece se existir ao menos uma seção e algum agente sem seção.

### Erros de backend

Um `role="alert"` no primeiro aparecimento. Não repetir a cada render.

| Código | Texto |
| --- | --- |
| `local-missing` | Nenhum modelo local instalado. Instale um modelo em Modelos. Modelos grandes ficam em Avançado. |
| `exo-offline` | A rede EXO não respondeu. Abra Conectar, em Rede EXO, e confira se o motor está ligado. |
| `remote-offline` | A API não respondeu nesse endereço. Confira o outro computador e se os dois estão na mesma rede. |
| `key-missing` | Falta a chave. Cole a chave da sua conta. Ela fica no cofre deste computador. |
| `key-invalid` | A chave foi recusada. Confira se está completa e se a conta ainda tem acesso. |
| `bad-address` | Use um endereço privado, por exemplo http://192.168.0.20:8080. Endereços públicos não são aceitos. |
| `work-stopped` | A rodada parou antes de terminar. O que já foi escrito continua na conversa. |

Motivo curto na linha: “sem modelo local”, “EXO sem resposta”, “API sem resposta”, “falta a chave”, “chave recusada”, “endereço inválido”, “rodada interrompida”.

### Trabalho longo

- Ao iniciar, o agente vai para `trabalhando` e a marca Pensando. Anunciar uma vez.
- Duração visível: “há menos de 1 min”, “há 4 min”, “há 1 h”. Atualizar o texto a cada 30s. Não anunciar cada atualização.
- Tokens parciais entram no mesmo nó de texto. Não criar um elemento por token.
- **Parar** pede interrupção. O já escrito permanece. Estado Atenção `work-stopped` se a interrupção não for uma conclusão normal.
- Sair da conversa não cancela. A linha segue **Trabalhando**.
- Conclusão: estado `concluido`, marca Concluído, anunciar uma vez “{nome} concluiu”.
- Texto fixo sob o compositor enquanto houver trabalho: “Você pode sair desta conversa. A rodada continua.”

## 7. Teclado

Ordem de tabulação com Equipes aberta em Conversas, janela larga:

1. Marca LocalNeuron, gatilhos das ilhas e itens só do menu aberto (menus fechados fora da ordem).
2. Seletor **Equipe**, **Nova equipe**, **Buscar agente**.
3. A lista é **um** tab stop.
4. Compositor, **Enviar** ou **Parar**, **Limites**, depois os controles do painel de detalhes.
5. No chrome estreito, a marca some como hoje; a ordem começa no gatilho Trabalhar. **← Equipes** entra antes do compositor.

Lista, `role="listbox"` `aria-orientation="vertical"`:

- Só a opção selecionada tem `tabindex="0"`. As outras, `-1`.
- Seta para cima e para baixo movem seleção e foco. Home e End vão aos extremos. A seleção segue o foco e troca o miolo. Isso não anuncia o histórico de novo.
- Enter e Espaço confirmam a opção já selecionada. Até 720px, a confirmação troca para a conversa.
- Cabeçalho de seção entra na sequência (não é `option`): Enter ou Espaço alterna `aria-expanded`. Seção fechada some da sequência.
- Letra imprimível, com foco na lista e fora de campo de texto, salta para o próximo nome que começa com ela.
- Tab sai da lista. Setas não saem da lista.

Compositor: Enter envia, Shift+Enter quebra a linha, como no Chat. Não criar atalho global de letra. Escape fecha diálogo e devolve o foco.

## 8. Leitor de tela

- Registro: `role="log"` `aria-relevant="additions"` `aria-atomic="false"`. Mensagem nova anuncia uma vez. Token parcial não.
- Região educada à parte, uma frase por transição: “{nome} está trabalhando”, “{nome} concluiu”, “Nova mensagem de {nome}” se a conversa daquele agente não estiver aberta. Não ler o corpo inteiro de uma mensagem de fundo.
- Conversa aberta: o log anuncia a mensagem completa uma vez. Não duplicar na região de status.
- `role="alert"` só no erro novo de backend ou na parada da rodada.
- Busca: depois de 150ms sem tecla, `role="status"` com “{n} agentes”. Não anunciar cada caractere.
- Separador “Rodada n” pode estar no log; anuncia uma vez ao entrar.
- Contagem de tokens e a barra não são ao vivo.

## 9. Responsivo

| Largura | Comportamento |
| --- | --- |
| >1100px | Lista, conversa e detalhes. |
| 721–1100px | Detalhes no disclosure. |
| ≤720px | Ilhas em 5 colunas no topo. Lista ou conversa, nunca as duas. Voltar é **← Equipes**. |
| 320px | Igual ao anterior. Nome de ilha em `--text-xs`, pode quebrar em duas linhas, não truncar. Compositor em coluna; **Enviar** a 100% e no mínimo 40px. `overflow-wrap: anywhere` nas mensagens. Sem rolagem horizontal da página. |

`prefers-reduced-motion: reduce`: sem pulso, sem deslize na troca de painel, seta da ilha sem rotação animada. O estado continua na marca, no símbolo e na palavra.

## 10. Copy

Usar estes textos. Idioma: pt-BR.

| Id | Texto |
| --- | --- |
| `island.title` | Equipes |
| `island.desc` | Agentes no mesmo pedido |
| `nav.overview` | Visão da equipe |
| `nav.threads` | Conversas |
| `team.new` | Nova equipe |
| `team.empty.title` | Nenhuma equipe |
| `team.empty.body` | Crie uma equipe para dividir um pedido entre agentes. O modelo inicial é o menor modelo local. Modelos grandes ficam em Avançado. |
| `team.empty.action` | Criar equipe |
| `agent.empty` | Esta equipe ainda não tem agentes. |
| `agent.add` | Adicionar agente |
| `agent.search` | Buscar agente |
| `agent.search.empty` | Nenhum agente com esse nome. |
| `thread.all` | Conversa da equipe |
| `thread.all.sub` | Todas as mensagens |
| `composer.label` | Pedido para a equipe |
| `composer.hint` | O coordenador divide o pedido · até 3 rodadas · Enter envia |
| `composer.send` | Enviar |
| `composer.stop` | Parar |
| `composer.leave` | Você pode sair desta conversa. A rodada continua. |
| `status.working` | Trabalhando |
| `status.ready` | Pronto |
| `status.done` | Concluído |
| `status.attention` | Atenção |
| `handoff` | Entre agentes · {origem} passou para {destinos} |
| `round` | Rodada {n} |
| `backend.local` | Este computador |
| `backend.local.hint` | Recomendado. O menor modelo local pronto. |
| `backend.advanced` | Modelos grandes |
| `backend.advanced.hint` | O texto sai deste computador nos serviços externos. EXO usa a sua rede. |
| `backend.exo` | Rede EXO |
| `backend.remote` | API em outro computador |
| `backend.anthropic` | Anthropic |
| `backend.grok` | Grok |
| `backend.key` | Chave da API |
| `backend.key.hint` | A chave fica no cofre deste computador. A tela não volta a mostrar a chave inteira. |
| `backend.test` | Testar |
| `overview.advanced.off` | Modelos grandes — EXO, API em outro computador, Anthropic e Grok — ficam em Avançado e não estão em uso. |

Símbolos dos estados, junto da palavra: Pronto `●`, Pensando / Trabalhando `…`, Concluído `✓`, Atenção `!`.

## 11. Contraste e tokens

Reutilizar de `public/polish.css`: `--text-xs` a `--text-2xl`, `--leading-tight`, `--leading-body`, `--space-1` a `--space-6`, `--radius-sm`, `--radius-md`, `--focus` (`#8a4b12` claro, `#f0c48a` escuro).

A tela Equipes usa tokens `--eq-*` para não herdar o verde decorativo antigo. O cinza `#5d646d` do mockup de referência fica abaixo de 4,5:1; o token `--eq-faint` é `#818a93`.

Novos tokens de ilha:

| Token | Claro | Escuro |
| --- | --- | --- |
| `--island-teams` | `#1c3d66` | `#7aa2f7` |
| `--island-teams-soft` | `#e4eaf4` | `#1a2433` |
| `--island-on` | `#ffffff` | `#14161b` (já existe) |

Tokens da área Equipes:

| Token | Claro | Escuro |
| --- | --- | --- |
| `--eq-bg` | `#f4f5f7` | `#0f1114` |
| `--eq-panel` | `#ffffff` | `#15181c` |
| `--eq-panel-2` | `#eceef2` | `#1b1f24` |
| `--eq-line` | `#d9dee5` | `#262b31` |
| `--eq-ink` | `#1c1f24` | `#e6e8eb` |
| `--eq-muted` | `#5c6570` | `#8b929b` |
| `--eq-faint` | `#5e6772` | `#818a93` |
| `--eq-accent` | `#1c3d66` | `#7aa2f7` |
| `--eq-ok` | `#0f6b45` | `#5fb98a` |
| `--eq-warn` | `#7a4e12` | `#d6a652` |
| `--eq-avatar` | `#e6e8ec` | `#22272e` |

Razões (fórmula WCAG 2.1). Texto ≥ 4,5:1. Foco e ícone preenchido ≥ 3:1.

### Escuro

| Uso | Frente | Fundo | Razão |
| --- | --- | --- | --- |
| Texto | `#e6e8eb` | `#0f1114` | 15,40:1 |
| Texto | `#e6e8eb` | `#15181c` | 14,51:1 |
| Texto | `#e6e8eb` | `#1b1f24` | 13,49:1 |
| Secundário | `#8b929b` | `#15181c` | 5,67:1 |
| Secundário | `#8b929b` | `#1b1f24` | 5,27:1 |
| Terciário | `#818a93` | `#0f1114` | 5,39:1 |
| Terciário | `#818a93` | `#1b1f24` | 4,72:1 |
| Acento e Atual | `#7aa2f7` | `#1b1f24` | 6,58:1 |
| Acento na barra | `#7aa2f7` | `#14161b` | 7,19:1 |
| Ícone preenchido | `#14161b` | `#7aa2f7` | 7,19:1 |
| Ok | `#5fb98a` | `#15181c` | 7,46:1 |
| Aviso | `#d6a652` | `#1b1f24` | 7,44:1 |
| Foco | `#f0c48a` | `#1b1f24` | 10,23:1 |
| Corpo da mensagem | `#cfd3d8` | `#0f1114` | 12,57:1 |

### Claro

| Uso | Frente | Fundo | Razão |
| --- | --- | --- | --- |
| Texto | `#1c1f24` | `#ffffff` | 16,52:1 |
| Texto | `#1c1f24` | `#f4f5f7` | 15,15:1 |
| Secundário | `#5c6570` | `#ffffff` | 5,91:1 |
| Secundário | `#5c6570` | `#eceef2` | 5,09:1 |
| Terciário | `#5e6772` | `#eceef2` | 4,94:1 |
| Ilha Equipes | `#1c3d66` | `#ffffff` | 11,00:1 |
| Ilha Equipes | `#1c3d66` | `#e4eaf4` | 9,10:1 |
| Secundário na ilha aberta | `#5f656e` | `#e4eaf4` | 4,86:1 |
| Ok | `#0f6b45` | `#ffffff` | 6,54:1 |
| Aviso | `#7a4e12` | `#ffffff` | 7,18:1 |
| Foco | `#8a4b12` | `#ffffff` | 6,78:1 |
| Foco na ilha aberta | `#8a4b12` | `#e4eaf4` | 5,61:1 |

As outras ilhas permanecem nos pares já medidos em `docs/design/acessibilidade-visual-checklist.md`.

## 12. Marcas

Seis arquivos por estado em `mascotes/`. São geométricas, monocromáticas, para caber num círculo de cerca de 28–32px. Não são personagens. A identidade fica à esquerda; o estado fica à direita e não depende de cor.

| Id | Nome visível | Contorno | Uso sugerido |
| --- | --- | --- | --- |
| `norte` | Norte | Círculo com haste | Coordenação |
| `grade` | Grade | Retângulo com pinos | Implementação |
| `lente` | Lente | Círculo com haste diagonal | Pesquisa |
| `traco` | Traço | Três linhas | Redação |
| `selo` | Selo | Escudo | Revisão |
| `marco` | Marco | Círculo com retângulo | Publicação |

| Estado | Arquivo | Símbolo interno | Etiqueta |
| --- | --- | --- | --- |
| Pronto | `{id}-pronto.svg` | disco | Pronto |
| Pensando | `{id}-pensando.svg` | três discos | Pensando |
| Concluído | `{id}-concluido.svg` | visto | Concluído |
| Atenção | `{id}-atencao.svg` | exclamação | Atenção |

Na interface, trabalho em curso usa o arquivo Pensando e a palavra **Trabalhando**. A folha `mascotes/folha-de-contato.html` mostra os quatro com etiqueta. `alt=""` na imagem; a etiqueta é que nomeia o estado.

Copiar os SVG para `public/mascotes/` na implementação, para o app servi-los. Não apontar o runtime para `docs/`.

## 13. Handoff para o CODER

Não editar `website/`. Não fazer deploy. Não remover Minha equipe.

### Criar

- `public/equipes.js` — vista, lista com roving tabindex, conversa, diálogo, erros.
- `public/equipes.css` — tokens `--eq-*` e layout deste documento. Carregar depois de `a11y-visual.css` só se precisar vencer regra antiga; preferir especificidade em `.equipes`.
- `public/mascotes/*.svg` — cópia de `docs/design/equipes/mascotes/` sem a folha de contato.

### Alterar

- `public/index.html` — ilha `teams` entre Trabalhar e Criar; link do CSS e do módulo.
- `public/icons.js` — caminho `teams`.
- `public/navigation.css` — grupo `teams` e, em `max-width: 720px`, `repeat(5, minmax(0, 1fr))`.
- `public/a11y-visual.css` — a mesma grade de 5 colunas, para não perder o nome da ilha.
- `public/polish.css` — `--island-teams` e `--island-teams-soft` no claro e no escuro.
- `public/app.js` — `navIslandForPage.equipes = "teams"`, breadcrumb `Equipes`, `render` chama o módulo.
- `tests/navigation.test.mjs` — incluir `teams` e manter os 14 destinos antigos mais `equipes`.
- `docs/design/acessibilidade-visual-checklist.md` — onde diz quatro ilhas, passar a cinco e citar Equipes. Não rebaixar os critérios.

Backend HTTP de Anthropic, Grok e EXO pode ficar atrás de uma função `testBackend(draft)` que devolve `{ ok: true }` ou `{ ok: false, error }` com os códigos da seção 6. A interface não espera a chave de volta.

### Critérios de aceite

1. Ilha Equipes entre Trabalhar e Criar, com ícone, descrição e itens Visão da equipe e Conversas. Item aberto mostra Atual e `aria-current="page"`. Minha equipe continua em Trabalhar.
2. Agente novo sugere o menor modelo local. EXO, API remota, Anthropic e Grok só dentro de Modelos grandes, fechado.
3. Lista com marca, nome, não lidas em número, seção opcional e a palavra Trabalhando ou Atenção quando couber. Sem depender de um ponto colorido.
4. Conversa mostra mensagem do usuário, mensagens de agentes e a linha “Entre agentes”. Rodada e tokens são texto.
5. Painel de detalhes (ou disclosure abaixo de 1100px) mostra modelo, onde roda e estado.
6. Visão da equipe lista equipes e o estado de cada uma. Vazio usa o texto `team.empty.*`.
7. Erros da tabela aparecem em `role="alert"` e na linha do agente. Chave não reaparece inteira.
8. Trabalho longo: palavra Trabalhando, duração, Parar, texto parcial no mesmo nó, saída da tela não cancela.
9. Até 720px e em 320px: cinco nomes de ilha visíveis; lista e conversa em telas separadas; **← Equipes** volta o foco; sem rolagem horizontal.
10. Teclado: um tab stop na lista, setas, Home, End, Escape no diálogo, Enter envia, Shift+Enter quebra a linha. Foco 3px `--focus`.
11. Leitor: `alt=""`, log só com mensagens completas, status só nas transições, busca sem ruído por tecla.
12. `prefers-reduced-motion: reduce` não anima marca, troca de painel nem seta.
13. Pares da seção 11 medidos de novo no claro e no escuro. Abaixo do mínimo, não aprovar.
