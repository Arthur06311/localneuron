# Revisão de UX/UI — navegação por ilhas

## O que foi observado

A barra lateral tinha 14 destinos no mesmo nível. Chat, criação de mídia, integrações, rede EXO, API, Pro, assinatura, wizard e preferências apareciam como uma lista única. Isso aumenta o tempo para encontrar uma função e faz recursos diferentes parecerem equivalentes.

O conteúdo de cada área já tem boas páginas específicas, mas faltava uma hierarquia de entrada: a navegação dizia *o que existe*, sem dizer *como as funções se relacionam*. A mudança foi feita na navegação, preservando as páginas e seus identificadores existentes.

## O que foi alterado

- **Trabalhar:** Chat, Minha equipe e Modelos.
- **Criar:** Imagem, Vídeo, Música e Editor.
- **Conectar:** Conexões, Rede EXO e Minha API.
- **Conta:** Central Pro, Meu plano, Configuração guiada e Configurações.

Cada ilha é um botão acessível, com nome e descrição curta. O clique abre ou fecha as opções. A ilha da página atual abre automaticamente; a preferência de uma ilha aberta é preservada neste dispositivo. No modo Chat e em telas pequenas, as ilhas continuam compactas e mostram o submenu em uma superfície flutuante para não reduzir a área de leitura.

Também atualizei a descrição de Configurações para refletir que a abertura básica de Windows e Linux já foi validada. Isso não promete desempenho igual em todas as GPUs, modelos, microfones ou integrações.

## Verificação

- Build TypeScript concluído.
- 4 testes existentes do site passaram.
- 2 testes novos de navegação passaram: agrupamento em quatro ilhas e preservação dos 14 destinos.
- O roteamento continua usando os mesmos valores `data-page`; os módulos de Chat, Modelos, Estúdio, EXO, API e Pro não precisam mudar.

## O que eu melhoraria em seguida

1. **Página inicial de trabalho:** depois do wizard, mostrar um resumo com “continuar conversa”, “último projeto” e “modelos prontos”, em vez de enviar a pessoa diretamente para uma lista vazia.
2. **Busca global:** um comando rápido para procurar modelo, conversa, projeto ou conexão sem abrir cada ilha.
3. **Estado de instalação mais visível:** mostrar na ilha Trabalhar um indicador curto para downloads, indexação e RAM ocupada.
4. **Conexões com níveis claros:** separar “conectar”, “testar” e “revogar” para reduzir o risco de a pessoa interpretar uma conexão apenas configurada como pronta.
5. **Acessibilidade:** revisar foco visível e leitura por leitor de tela em todos os submenus, especialmente no modo Chat em que o submenu sai da barra lateral.
6. **Teste em máquinas reais:** repetir a navegação em um monitor pequeno e em uma instalação física do Omarchy, além dos testes automatizados.

## Limite desta revisão

Esta rodada reorganiza a entrada e a descoberta das funções. Não altera permissões, modelos, cobrança, motores de IA ou o conteúdo das páginas internas.
