# LocalNeuron 0.19 — Mascote

Mascote original criado para o aplicativo: robô em porcelana, grafite e metal champanhe, com gesto de boas-vindas. Arte gerada com IA e incorporada como PNG com transparência em `public/mascot.png` (1.254 × 1.254 pixels, aproximadamente 941 KiB).

## Onde aparece

- Boas-vindas e desbloqueio: acompanha a apresentação sem deslocar o formulário.
- Chat vazio: substitui o símbolo de conversa; deixa de aparecer quando há mensagens.
- Central Pro: acompanha o painel de processamento local em telas grandes.

O mascote faz parte da identidade do aplicativo, incluindo o plano Grátis. O ícone original do LocalNeuron continua no cabeçalho. A arte é servida pelo próprio aplicativo e funciona offline, inclusive antes de desbloquear o cofre. Não possui telemetria, áudio ou interação própria.

## Apresentação e acessibilidade

Tamanhos adaptados para desktop e celular, texto alternativo e uma única transição suave de entrada no chat. A preferência do sistema por movimento reduzido desliga essa transição. Não há movimento contínuo nem elementos flutuantes sobre as mensagens.

## Validação

- Compilação TypeScript e 107 testes existentes aprovados.
- Sintaxe JavaScript conferida nos três módulos alterados.
- Navegador: chat em tema claro e escuro, Central Pro e boas-vindas; versão compacta em 390 × 844, sem transbordamento horizontal. Arte carregada e sem erros de JavaScript observados.
- Pacotes macOS ARM64, Windows x64 e Linux x64 atualizados. A execução nativa no Windows e Linux continua pendente de validação nesses sistemas.
- Licença de teste do proprietário preservada somente na instalação local; pacotes de distribuição não incluem dados ou credenciais do usuário.
