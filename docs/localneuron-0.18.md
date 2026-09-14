# LocalNeuron 0.18 · Um Pro mais fácil de reconhecer e usar

A experiência Pro recebe uma identidade própria em grafite e dourado, com botões, indicação do plano e entrada permanente para a central. O ícone original foi preservado. As cores diferenciam o plano ativo nos temas claro e escuro; o estado visual é removido ao bloquear o aplicativo ou voltar ao Grátis.

## Começar uma entrega

Na **Central Pro → Visão geral**, escolha **Começar uma entrega**, **Trabalhar com código** ou **Planejar um vídeo**. A tela de preparação permite escolher um projeto existente ou nomear um novo. Ao confirmar, o app abre o projeto com o pedido preenchido e o modo **Com revisão** selecionado.

Confira o texto, anexe os materiais necessários, escolha a IA e só então clique em **Executar tarefa**. Preparar o projeto não executa a IA nem habilita internet automaticamente. O processamento, a revisão, as fontes e a exportação continuam usando os recursos existentes da versão 0.17.

## Entender a diferença

A comparação **A diferença na prática** tem três exemplos selecionáveis: escrita/revisão, documentos e uso em outros aplicativos. Mostra como o Grátis e o Pro atendem ao mesmo objetivo. São descrições dos recursos disponíveis, não respostas simuladas de uma IA ou promessa de ganho de velocidade.

Para quem já está no Pro, **Meu plano** prioriza quatro grupos de benefícios com acesso direto: entregas com revisão, conhecimento do projeto, Estúdio e API. Os cartões de planos ficam recolhidos numa comparação opcional. Quem está no Grátis vê os benefícios e as condições de assinatura.

Licenças assinadas de teste do proprietário são identificadas como **Pro em teste · sem cobrança**, com prazo e ausência de renovação automática. A configuração comercial continua desativada. O teste desta instalação mantém seu vencimento anterior, em 20/09/2026; a atualização não prorroga o teste.

## Validação e distribuição

- 107 testes automatizados passaram. Esta versão altera principalmente a apresentação e a preparação do pedido; não modifica pesos, motores ou as capacidades do plano gratuito.
- Navegador: projeto criado pelo início guiado, pedido e modo com revisão preenchidos, nenhum trabalho executado automaticamente. Reutilização do mesmo projeto sem criar cópia adicional.
- Comparação interativa de API e documentos conferida. Estado Pro/Grátis alternado em ambiente isolado; a identidade de assinatura desapareceu no Grátis.
- Claro/escuro, desktop 1440 px e celular 390 px conferidos sem transbordamento horizontal observado. Os fluxos finais não apresentaram erros de console.
- A ferramenta de empacotamento Mac aceita `--local-subscription-config` para preservar uma chave pública de teste somente no app instalado. O ZIP é criado e assinado antes de aplicar essa configuração local; a licença, os dados e a chave privada do usuário não entram nos pacotes distribuíveis.
- Windows e Linux são empacotados no Mac, sem nova validação de execução nativa. A qualidade das respostas continua dependendo do modelo e do hardware.

Pacotes Mac/Windows/Linux comparados com os arquivos finais de `dist`, `public` e `desktop`. ZIPs e TAR verificados, assinatura ad hoc do ZIP Mac extraído validada estritamente. Os 1.005 arquivos de dados do manifesto permaneceram iguais antes de reabrir. O app 0.18 foi reaberto e a Central Pro foi conferida na janela real; a API confirmou o teste ativo, com o vencimento original em 20/09/2026. O ZIP do Mac e os pacotes Windows/Linux mantêm a configuração comercial vazia; só o aplicativo instalado preserva a chave pública de teste.
