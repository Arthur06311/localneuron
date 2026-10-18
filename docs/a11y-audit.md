# Auditoria de acessibilidade da interface

A suíte `tests/a11y-audit.test.mjs` abre a interface em `public/` com Chromium headless (Playwright) e `@axe-core/playwright`. Não usa microfone, câmera nem geração de mídia. O CI instala o Chromium do Playwright antes de `npm test`.

## O que a suíte cobre

Tags axe: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. A falha é automática para impacto **serious** ou **critical**, salvo entrada em `tests/a11y-known.json` (hoje vazia).

Larguras 320, 390 e 768 px, altura 800. Em cada uma: tela de senha, configuração guiada, chat, modelos, estúdio de imagem (e o diálogo de recomendação em 320 px), conexões, preferências e plano. Também chat no tema escuro a 320 px e a página remota (o servidor principal não publica `/remote`; o teste entrega os arquivos de `public/`).

Além do axe, cada superfície verifica:

- sem rolagem horizontal da página (`scrollWidth` e `clientWidth` diferem no máximo 1 px);
- controles visíveis não cortados por `overflow: hidden` ou `clip` (o link “Ir para o conteúdo” só entra nessa conta quando está focado);
- Trabalhar, Criar, Conectar, Conta, Claro, Escuro, Sistema e Bloquear visíveis e alcançáveis nas primeiras 40 paradas de Tab;
- até 720 px, o nome da ilha aparece (não “•••”) e o gatilho e o Bloquear têm pelo menos 40 px de altura;
- menu fechado não recebe Tab; Criar e Conta abertos cabem na largura e o item de exemplo entra no Tab.

## Corrigido

| Gravidade | Problema | Correção |
| --- | --- | --- |
| Séria | Passos inativos do assistente usavam `opacity: .6` e ficavam abaixo de 4,5:1 | Cor `var(--muted)` no passo inativo e `var(--ink)` no passo atual |
| Séria | Selo pausado/revisão `#99632f` sobre `#f5eada` (~4,2:1) e cancelado `#888` sobre `#eee` (~3,1:1) | Texto `#6a3d12` e `#4f4f4f` em `public/a11y.css` |
| Séria | Tabela de planos com `overflow-x: auto` e `min-width: 610px` sem foco de teclado | `tabindex="0"`, `role="region"` e nome acessível |
| Séria | A mesma regra na comparação de modelos | Mesmo padrão no diálogo de comparação |
| Séria | `#messages` do remoto tinha `aria-label` num `div` genérico | `role="log"` |
| Séria | Diálogos sem nome acessível (recomendação de modelo, tarefa, editor de bot, Pro, comparação, música, recorte, projetos, exportação, atualização, voz) | `aria-labelledby` apontando para o título já visível |
| Séria | Em até 720 px a barra escondia nomes, Bloquear e RAM, e o menu absoluto saía da tela | `public/a11y.css` empilha a barra, mostra os nomes, traz o menu para o fluxo e garante 40 px |
| Séria | Botões só de ícone (Conversas, Ajustes) e o diálogo de download sem nome | `aria-label` e `aria-labelledby` |
| Alta | `navigation.css` era referenciado e não estava no mapa estático do servidor, então as ilhas não recebiam o estilo no aplicativo real | Rotas `/navigation.css` e `/a11y.css` |
| Moderada | Placeholder com opacidade reduzida e `--muted` no limite do contraste sobre fundo claro | Opacidade 1 e `--muted: #5f656e` no tema claro |
| Moderada | Não havia atalho para o conteúdo, e no chat o link ficava cortado por `overflow: hidden` | Link “Ir para o conteúdo”, `position: fixed`, visível ao focar |

## Ainda aberto

| Gravidade | O que resta | Por que não entrou neste PR |
| --- | --- | --- |
| Moderada | No chat com largura acima de 720 px, o trilho troca o nome da ilha por “•••” (`font-size: 0` e `::after` em `navigation.css`). O texto do nome continua no botão e o Tab o alcança, mas quem enxerga vê só os pontos | O trilho do chat é estreito. Mostrar os quatro nomes ali muda o desenho e pode estourar a coluna. Até 720 px a suíte exige o nome real. O PR #9 trata esse desenho à parte |
| Moderada | A janela Electron nasce com `minWidth: 760`, então a pessoa não chega a 320 px de CSS só redimensionando | É política da janela, não um defeito do CSS de `public/`. A suíte headless define o viewport. Não alterei o mínimo do produto |
| Baixa | O cartão “Explorar meu Pro” some com altura máxima de 800 px (regra antiga) e também até 720 px | O cartão cobria a barra estreita. Pro continua em Conta e no chip do topo |
| Baixa | Claro, Escuro e Sistema ficam com cerca de 32 px de altura | O recorte WCAG 2.1 AA não exige alvo de 44 px. Ilhas, itens de menu e Bloquear ficam com pelo menos 40 px até 720 px |
| Baixa | A matriz não abre equipe, estúdio de vídeo, música, editor, EXO, API nem Central Pro em todas as larguras, nem cada diálogo (exportar, voz, recorte). O tema escuro é amostrado no chat a 320 px | Essas telas compartilham a mesma barra já verificada. Geração de áudio, vídeo e voz depende de hardware ou de um trabalho longo, fora do CI headless |

Impacto **critical** não apareceu. `tests/a11y-known.json` não esconde achado.
