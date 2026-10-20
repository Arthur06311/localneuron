# Checklist de acessibilidade visual — LocalNeuron

Use este roteiro para conferir a navegação por ilhas, o mascote e o contraste do aplicativo. Cada item diz como verificar e o que deve acontecer. Não aprove um item só porque a tela “parece certa”: execute o passo e compare com o resultado esperado.

As razões de contraste abaixo foram calculadas com a fórmula de luminância relativa do WCAG 2.1 (sRGB). Texto comum precisa de pelo menos **4,5:1**. Componentes de interface e o anel de foco precisam de pelo menos **3:1**. Nenhum texto da interface usa a folga de texto grande.

Tokens de tipografia e espaçamento, em `public/polish.css`:

| Token | Valor |
| --- | --- |
| `--text-xs` | 0,75rem (12px) |
| `--text-sm` | 0,8125rem (13px) |
| `--text-md` | 0,875rem (14px) |
| `--text-lg` | 1,125rem (18px) |
| `--text-xl` | 1,375rem (22px) |
| `--text-2xl` | 2rem (32px) |
| `--space-1` … `--space-6` | 4, 8, 12, 16, 24 e 32px |

## 1. Janelas estreitas

Reduza a janela para **390px** de largura (e, se puder, repita em 320px e 720px). O modo Claro e o modo Escuro devem passar nos mesmos pontos.

1. **Quatro ilhas continuam nomeadas.**
   - Como verificar: olhe a barra no topo. Não role a página ainda.
   - Resultado esperado: Trabalhar, Criar, Conectar e Conta aparecem na mesma faixa, cada uma com ícone, nome e seta. O nome não some e não é substituído por “•••”.

2. **O menu aberto cabe na tela.**
   - Como verificar: ative Criar e depois Conta.
   - Resultado esperado: o menu abre logo abaixo da ilha, com fundo sólido e borda na cor da ilha. Imagem, Vídeo, Música e Editor ficam inteiros, com altura de toque de pelo menos 40px. O menu de Conta abre alinhado à direita e não sai da janela. Dá para ler “Configuração guiada” e o selo GRÁTIS.

3. **O conteúdo não fica escondido debaixo da barra.**
   - Como verificar: role a área principal e abra o Chat.
   - Resultado esperado: a barra de ilhas permanece no fluxo do topo, sem cobrir o título nem o campo de mensagem. A área principal rola sozinha.

4. **Aparência no topo continua utilizável.**
   - Como verificar: olhe Claro, Escuro e Sistema. Confira também o grupo no inspetor de acessibilidade.
   - Resultado esperado: os três nomes aparecem. Se a linha quebrar, os botões continuam clicáveis e não se sobrepõem ao miolo da página. O grupo expõe `role="group"` e o nome Aparência. O botão do tema ativo expõe `aria-pressed="true"`.

5. **O indicador de RAM continua na barra estreita.**
   - Como verificar: em 390px, procure o indicador de RAM, abaixo das ilhas.
   - Resultado esperado: a memória disponível aparece. A frase “Processamento neste computador.” pode ficar oculta para a linha caber. Não há botão de bloquear nem campo de senha.

6. **Menus em 320px e com zoom de 200% no Electron.**
   - Como verificar: reduza a janela a 320px e abra Criar e Conta. No Electron, repita com o zoom do aplicativo em 200%.
   - Resultado esperado: os quatro nomes das ilhas continuam visíveis. O menu aberto permanece dentro da janela, os itens têm pelo menos 40px de altura e dá para ler Imagem, Vídeo, Música, Editor e Configuração guiada. O item da página atual mostra a palavra Atual. O indicador de RAM continua alcançável.

## 2. Contraste

Confira no modo **Claro** e no modo **Escuro** (botões no topo). Uma ferramenta de contraste, o inspetor do navegador ou a tabela abaixo servem. Se um par da tabela falhar na medição, o item não passa.

### Modo claro

| Uso | Frente | Fundo | Razão | Mínimo |
| --- | --- | --- | --- | --- |
| Texto principal | `#24272e` | `#f8f9fb` | 14,19:1 | 4,5:1 |
| Texto principal | `#24272e` | `#ffffff` | 14,95:1 | 4,5:1 |
| Texto principal na barra | `#24272e` | `#f1f3f6` | 13,45:1 | 4,5:1 |
| Texto secundário e placeholder | `#5f656e` | `#ffffff` | 5,88:1 | 4,5:1 |
| Texto secundário | `#5f656e` | `#f8f9fb` | 5,58:1 | 4,5:1 |
| Texto secundário na barra | `#5f656e` | `#f1f3f6` | 5,29:1 | 4,5:1 |
| Texto secundário sobre Trabalhar aberta | `#5f656e` | `#e5f2ec` | 5,11:1 | 4,5:1 |
| Texto secundário sobre Criar aberta | `#5f656e` | `#f8efe3` | 5,16:1 | 4,5:1 |
| Texto secundário sobre Conectar aberta | `#5f656e` | `#e3f2f6` | 5,12:1 | 4,5:1 |
| Texto secundário sobre Conta aberta | `#5f656e` | `#efeaf6` | 4,97:1 | 4,5:1 |
| Texto secundário no selo Pro | `#5f656e` | `#f7f3eb` | 5,31:1 | 4,5:1 |
| Ouro Pro | `#856132` | `#ffffff` | 5,60:1 | 4,5:1 |
| Ouro Pro | `#856132` | `#f7f3eb` | 5,06:1 | 4,5:1 |
| Foco | `#8a4b12` | `#f1f3f6` | 6,10:1 | 3:1 |
| Foco | `#8a4b12` | `#ffffff` | 6,78:1 | 3:1 |
| Foco | `#8a4b12` | `#f8f9fb` | 6,44:1 | 3:1 |
| Foco sobre Trabalhar aberta | `#8a4b12` | `#e5f2ec` | 5,89:1 | 3:1 |
| Foco sobre Criar aberta | `#8a4b12` | `#f8efe3` | 5,96:1 | 3:1 |
| Foco sobre Conectar aberta | `#8a4b12` | `#e3f2f6` | 5,91:1 | 3:1 |
| Foco sobre Conta aberta | `#8a4b12` | `#efeaf6` | 5,74:1 | 3:1 |
| Ilha Trabalhar | `#1b5c45` | `#ffffff` | 7,88:1 | 4,5:1 |
| Ilha Trabalhar | `#1b5c45` | `#f1f3f6` | 7,09:1 | 4,5:1 |
| Ilha Trabalhar | `#1b5c45` | `#e5f2ec` | 6,85:1 | 4,5:1 |
| Ilha Criar | `#7a4e12` | `#ffffff` | 7,18:1 | 4,5:1 |
| Ilha Criar | `#7a4e12` | `#f1f3f6` | 6,46:1 | 4,5:1 |
| Ilha Criar | `#7a4e12` | `#f8efe3` | 6,30:1 | 4,5:1 |
| Ilha Conectar | `#1a5568` | `#ffffff` | 8,26:1 | 4,5:1 |
| Ilha Conectar | `#1a5568` | `#f1f3f6` | 7,43:1 | 4,5:1 |
| Ilha Conectar | `#1a5568` | `#e3f2f6` | 7,19:1 | 4,5:1 |
| Ilha Conta | `#4a3f63` | `#ffffff` | 9,62:1 | 4,5:1 |
| Ilha Conta | `#4a3f63` | `#f1f3f6` | 8,66:1 | 4,5:1 |
| Ilha Conta | `#4a3f63` | `#efeaf6` | 8,14:1 | 4,5:1 |
| Ícone preenchido Trabalhar | `#ffffff` | `#1b5c45` | 7,88:1 | 3:1 |
| Ícone preenchido Criar | `#ffffff` | `#7a4e12` | 7,18:1 | 3:1 |
| Ícone preenchido Conectar | `#ffffff` | `#1a5568` | 8,26:1 | 3:1 |
| Ícone preenchido Conta | `#ffffff` | `#4a3f63` | 9,62:1 | 3:1 |
| Mascote Pronto | `#1b5c45` | `#e5f2ec` | 6,85:1 | 4,5:1 |
| Mascote Pensando | `#1d3f72` | `#e4eaf6` | 8,67:1 | 4,5:1 |
| Mascote Concluído | `#146338` | `#e3f5e8` | 6,44:1 | 4,5:1 |
| Mascote Atenção | `#7a4e12` | `#f8efe3` | 6,30:1 | 4,5:1 |

### Modo escuro

| Uso | Frente | Fundo | Razão | Mínimo |
| --- | --- | --- | --- | --- |
| Texto principal | `#e9ebef` | `#101216` | 15,71:1 | 4,5:1 |
| Texto secundário | `#a1a7b2` | `#101216` | 7,75:1 | 4,5:1 |
| Texto secundário | `#a1a7b2` | `#181b21` | 7,13:1 | 4,5:1 |
| Texto secundário na barra | `#a1a7b2` | `#14161b` | 7,49:1 | 4,5:1 |
| Foco | `#f0c48a` | `#14161b` | 11,18:1 | 3:1 |
| Foco | `#f0c48a` | `#181b21` | 10,65:1 | 3:1 |
| Foco | `#f0c48a` | `#101216` | 11,58:1 | 3:1 |
| Texto principal sobre Trabalhar aberta | `#e9ebef` | `#163028` | 11,83:1 | 4,5:1 |
| Texto principal sobre Criar aberta | `#e9ebef` | `#3a2e1c` | 11,08:1 | 4,5:1 |
| Texto principal sobre Conectar aberta | `#e9ebef` | `#152c34` | 12,20:1 | 4,5:1 |
| Texto principal sobre Conta aberta | `#e9ebef` | `#2a2436` | 12,53:1 | 4,5:1 |
| Texto secundário sobre Trabalhar aberta | `#a1a7b2` | `#163028` | 5,84:1 | 4,5:1 |
| Texto secundário sobre Criar aberta | `#a1a7b2` | `#3a2e1c` | 5,47:1 | 4,5:1 |
| Texto secundário sobre Conectar aberta | `#a1a7b2` | `#152c34` | 6,02:1 | 4,5:1 |
| Texto secundário sobre Conta aberta | `#a1a7b2` | `#2a2436` | 6,19:1 | 4,5:1 |
| Foco sobre Trabalhar aberta | `#f0c48a` | `#163028` | 8,72:1 | 3:1 |
| Foco sobre Criar aberta | `#f0c48a` | `#3a2e1c` | 8,17:1 | 3:1 |
| Foco sobre Conectar aberta | `#f0c48a` | `#152c34` | 8,99:1 | 3:1 |
| Foco sobre Conta aberta | `#f0c48a` | `#2a2436` | 9,24:1 | 3:1 |
| Ilha Trabalhar sobre o fundo aberto | `#8fceb0` | `#163028` | 7,81:1 | 4,5:1 |
| Ilha Criar sobre o fundo aberto | `#e0b56a` | `#3a2e1c` | 6,92:1 | 4,5:1 |
| Ilha Conectar sobre o fundo aberto | `#8ec8d8` | `#152c34` | 7,91:1 | 4,5:1 |
| Ilha Conta sobre o fundo aberto | `#c4b6e0` | `#2a2436` | 7,92:1 | 4,5:1 |
| Ouro Pro | `#d7bd8d` | `#181b21` | 9,49:1 | 4,5:1 |
| Ouro Pro | `#d7bd8d` | `#25231f` | 8,63:1 | 4,5:1 |
| Ilha Trabalhar | `#8fceb0` | `#14161b` | 10,02:1 | 4,5:1 |
| Ilha Criar | `#e0b56a` | `#14161b` | 9,47:1 | 4,5:1 |
| Ilha Conectar | `#8ec8d8` | `#14161b` | 9,83:1 | 4,5:1 |
| Ilha Conta | `#c4b6e0` | `#14161b` | 9,58:1 | 4,5:1 |
| Ícone preenchido sobre a cor da ilha | `#14161b` | a cor clara da ilha | 9,47:1 a 10,02:1 | 3:1 |
| Mascote Pronto | `#b7e4cf` | `#163028` | 10,09:1 | 4,5:1 |
| Mascote Pensando | `#c5d4f5` | `#1c2740` | 9,98:1 | 4,5:1 |
| Mascote Concluído | `#b7e7c4` | `#163228` | 10,02:1 | 4,5:1 |
| Mascote Atenção | `#f0d3a4` | `#3a2e1c` | 9,17:1 | 4,5:1 |

1. **Nomes das ilhas e dos destinos.**
   - Como verificar: leia Trabalhar, Criar, Conectar, Conta e um item de cada menu, no claro e no escuro.
   - Resultado esperado: o nome está em `#24272e` (claro) ou `#e9ebef` (escuro). A descrição curta usa a cor secundária da tabela, inclusive sobre o fundo da ilha aberta. O menu de Criar mostra Imagem, Vídeo e Música, sem o inglês entre parênteses.

2. **Placeholder.**
   - Como verificar: clique em um campo vazio, como a senha da tela inicial ou a busca de modelos.
   - Resultado esperado: o texto de exemplo usa a cor secundária com opacidade 1. Não fica lavado.

3. **Selo GRÁTIS e ouro do Pro.**
   - Como verificar: abra Conta e olhe “GRÁTIS”.
   - Resultado esperado: o ouro da tabela sobre o fundo do selo, com borda, não só a cor.

## 3. Foco do teclado e ordem de tabulação

Use o teclado de verdade. Clique uma vez na página e depois só Tab, Shift+Tab, Enter e Espaço. O anel precisa aparecer em `:focus-visible`.

1. **O foco é visível.**
   - Como verificar: tabule até Criar, até um item do menu e até Claro.
   - Resultado esperado: contorno de 3px. No claro, `#8a4b12`. No escuro, `#f0c48a`. O contorno não fica cortado pela barra. Não depende só de uma mudança de fundo.

2. **A ordem segue o visual.**
   - Como verificar: a partir do topo, anote cada parada. Repita com a janela em 390px.
   - Resultado esperado, janela larga, com Trabalhar aberta e as outras fechadas: marca LocalNeuron, gatilho Trabalhar, Chat, Minha equipe, Modelos, gatilho Criar, gatilho Conectar, gatilho Conta, em seguida o atalho Pro visível na barra e só então Claro, Escuro e Sistema. Menus fechados não recebem foco.
   - Resultado esperado, janela até 720px: a marca fica oculta pela regra antiga da barra, então a ordem começa no gatilho Trabalhar. Seguem os itens do menu aberto, os outros gatilhos, o atalho “Explorar meu Pro” quando o cartão estiver visível (ele some se a altura da janela for menor que 800px) e, no topo, o chip PRO, Claro, Escuro e Sistema. Menus fechados não recebem foco.

3. **Enter ou Espaço abre e fecha a ilha.**
   - Como verificar: foque Criar e pressione Enter. Tabule. Pressione Enter de novo.
   - Resultado esperado: o menu entra na ordem de tabulação só enquanto `aria-expanded` é `true`. Ao fechar, o foco não cai em um item invisível.

4. **A página atual não depende só da cor.**
   - Como verificar: abra Chat e depois Imagem. Olhe o item correspondente e a ilha.
   - Resultado esperado: o item mostra a palavra **Atual**, peso maior, barra na esquerda e `aria-current="page"`. O leitor de tela anuncia a página atual por `aria-current`; a palavra visual não entra de novo no nome acessível. A ilha da página tem a faixa colorida na esquerda e o ícone preenchido. Dá para perceber a seleção em uma captura em preto e branco.

## 4. Movimento reduzido

Ative “reduzir movimento” no sistema, ou no DevTools: `prefers-reduced-motion: reduce`. Recarregue a página.

1. **O mascote Pensando não pulsa.**
   - Como verificar: provoque uma resposta pendente no Chat ou inspecione a figura Pensando em Preferências.
   - Resultado esperado: o anel fica estático. Não há pulso, salto nem opacidade animada. O estado continua reconhecível pelo rosto, pelas reticências e pela palavra Pensando.

2. **A tela de boas-vindas não desliza.**
   - Como verificar: abra uma conversa nova com a preferência de movimento reduzido já ativa.
   - Resultado esperado: o mascote Pronto aparece no lugar, sem subir nem surgir em fade.

3. **A seta da ilha não anima.**
   - Como verificar: abra e feche uma ilha.
   - Resultado esperado: a seta troca de posição na hora, sem rotação animada. `aria-expanded` muda entre `true` e `false`.

## 5. Estados do mascote

Abra Preferências e role até “Um mascote, várias expressões”. Repita no modo Escuro. Os quatro estados precisam ser distinguíveis sem depender só da cor: expressão do desenho, símbolo e nome.

| Estado | Onde aparece | Expressão | Símbolo | Nome visível |
| --- | --- | --- | --- | --- |
| Pronto | Boas-vindas, conversa nova, Central Pro ociosa | Sorriso, olhos curvados | ● | Pronto |
| Pensando | Resposta ou tarefa em andamento | Mão no queixo, olhar de lado | … | Pensando |
| Concluído | Resposta terminada | Braços abertos | ✓ | Concluído |
| Atenção | Aviso, erro, interrupção ou fila pausada | Sobrancelha levantada | ! | Atenção |

1. **Os quatro cartões.**
   - Como verificar: leia cada cartão da galeria, no claro e no escuro.
   - Resultado esperado: cada um mostra o desenho, o símbolo, o nome e uma frase. As frases citam repouso, trabalho, concluído e atenção. O anel e a etiqueta usam os pares da tabela de contraste.

2. **No fluxo real.**
   - Como verificar: tela inicial com erro de entrada (Atenção), conversa vazia (Pronto), resposta pendente (Pensando) e resposta concluída (Concluído).
   - Resultado esperado: a imagem não repete o estado no texto alternativo. A etiqueta visível traz o símbolo e o nome. No fim de uma resposta, o quadro acompanha a largura da etiqueta e o nome Concluído cabe por inteiro.

3. **Preto e branco.**
   - Como verificar: fotografe a galeria e remova a cor, ou cubra a tela com um filtro cinza.
   - Resultado esperado: ●, …, ✓ e ! continuam diferentes, e os nomes continuam legíveis.
