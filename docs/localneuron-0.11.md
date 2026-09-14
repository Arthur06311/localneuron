# LocalNeuron 0.11 — estúdio de criação

O Estúdio reúne geração local e edição em um projeto: biblioteca à esquerda, prévia central, propriedades à direita e linha do tempo embaixo. É uma primeira versão de editor, com recursos de montagem; não reproduz todos os recursos do CapCut.

## Como criar um vídeo

1. Abra **Estúdio** e dê um nome ao projeto. Escolha horizontal, vertical ou quadrado.
2. Em **Gerar**, escolha um modelo instalado, descreva a cena e gere uma imagem ou um clipe. O resultado entra na biblioteca e na linha do tempo. Em **Mídias**, importe arquivos do computador.
3. Selecione uma cena para ajustar duração, trecho de origem, enquadramento, brilho, volume, aproximação e fade. Divida no cursor, duplique ou reordene as cenas.
4. Adicione textos com posição e intervalo próprios. Importe um áudio para a trilha de música e ajuste início, trecho e volume.
5. Use a prévia para conferir e **Exportar vídeo** para baixar o resultado. Também é possível salvar o quadro atual como PNG.

Desfazer/refazer guarda até 40 alterações. A geração em andamento aparece no editor, e resultados anteriores continuam disponíveis na galeria local. Os modelos são preparados na aba **Modelos** do Estúdio; a voz do chat continua em suas configurações próprias.

## Projetos e arquivos

A edição é salva automaticamente no armazenamento do aplicativo/navegador deste dispositivo, incluindo cópias das mídias importadas. **Projetos** permite abrir, criar ou excluir uma edição. **Baixar projeto** gera um arquivo `.localneuron.json` com a montagem e as mídias para importar em outro dispositivo. Faça esse backup antes de limpar dados do navegador ou trocar de instalação. A exportação do chat em Preferências não inclui estes projetos.

Cada projeto aceita até 5 minutos, 100 cenas, 60 mídias, 60 textos e 100 MiB de arquivos. Há uma sequência principal de cenas e uma trilha de música, além do áudio original dos vídeos. Textos são inseridos manualmente; não há legendagem automática, múltiplas camadas de vídeo ou animação avançada por keyframes nesta versão.

## Exportação e geração

MP4 ou WebM aparecem conforme o suporte de codec do navegador. A exportação grava a composição local em tempo real a 30 fps: 1280×720, 720×1280 ou 720×720. Mantenha a página visível até concluir; trocar de aba interrompe a exportação. O progresso e o botão Cancelar ficam disponíveis. Os arquivos importados precisam ser decodificáveis pelo navegador; WebP animado usa ImageDecoder quando disponível.

Stable Diffusion 1.5 gera imagens locais em 768×448, 448×768 ou 512×512. Wan 2.1 permanece experimental: o perfil atual produz apenas 17 quadros de 256×256. Na máquina Mac de teste, um clipe com 10 passos levou cerca de 97 segundos. Isso não é geração instantânea nem uma garantia de tempo em outros computadores. O editor não aumenta a qualidade nativa de um modelo ao exportar em resolução maior.

Os pesos precisam ser baixados antes do uso offline. A geração respeita a memória disponível e pode ser recusada quando não houver RAM suficiente. A montagem, prévia, projetos e exportação não usam serviços de nuvem. Os limites dos motores em cada sistema continuam em [Plataformas](plataformas.md).

## Verificação

63 testes automatizados passaram. Foram verificados importação e restauração de projeto, geração real de imagem e vídeo, edição com texto e música, exportações MP4/WebM reproduzíveis, cancelamento e temas claro/escuro em desktop e celular. Execução nativa validada no Mac; os pacotes Windows/Linux ainda precisam de validação nos respectivos sistemas.
