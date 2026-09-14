# LocalNeuron 0.20 — Mascote 2D e expressões

O mascote passa a ter ilustração 2D, contornos definidos e quatro expressões. A galeria em **Preferências → Um mascote, várias expressões** apresenta todas elas.

| Expressão | Arquivo em `public/` | Uso |
| --- | --- | --- |
| Acolhedor | `mascot.png` | Boas-vindas, chat vazio e Central Pro disponível |
| Pensando | `mascot-thinking.png` | Última resposta em processamento e tarefa Pro em execução |
| Comemorando | `mascot-success.png` | Última resposta concluída |
| Atento | `mascot-attention.png` | Aviso nas boas-vindas, erro/interrupção de resposta e fila Pro pausada |

A expressão é uma indicação visual do estado do aplicativo. Uma resposta concluída continua sujeita à revisão do usuário. O mascote fica pequeno ao lado da última resposta e não cobre os controles ou o texto. O logo original permanece no aplicativo.

Os quatro PNGs têm transparência real e são incluídos nos pacotes locais. Funcionam offline e antes do desbloqueio. A transição de boas-vindas respeita a preferência por movimento reduzido; não há animação contínua.

## Criação das artes

Foi usada a ferramenta integrada de geração de imagens, com o mascote anterior como referência. Direção dos prompts: redesenhar o mesmo robô em ilustração plana 2D, preservar a paleta marfim/grafite/dourado e o emblema de três pontos, simplificar contornos e formas, manter corpo inteiro e fundo transparente. Variações: olhos sorridentes e aceno; olhos olhando para cima com dedo no queixo; piscadela, sorriso e polegar positivo; olhos abertos, sobrancelhas erguidas e palma aberta. Uma etapa adicional removeu o fundo quadriculado gerado para entregar os arquivos com canal alfa.

## Validação

Compilação TypeScript, sintaxe dos módulos JavaScript e 107 testes existentes aprovados. Galeria conferida em temas claro e escuro e em tela de 390 × 844, sem transbordamento horizontal e com todas as imagens carregadas. Uma resposta local exibiu a expressão de pensamento durante o processamento e de comemoração ao terminar.

Pacotes macOS ARM64, Windows x64 e Linux x64 atualizados. Execução nativa de Windows e Linux continua pendente de validação nesses sistemas. Dados e licença local de teste preservados; credenciais do usuário não entram nos arquivos de distribuição.
