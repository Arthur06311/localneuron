# LocalNeuron 0.12 — Pro e Estúdio

Esta alfa implementa as 20 funções selecionadas como primeiras versões utilizáveis. Todas estão liberadas no aplicativo de desenvolvimento; não existe cobrança, assinatura ou ativação comercial nesta entrega. O ícone e os dados antigos são preservados.

## Começar

Abra o aplicativo e use sua senha atual. Em **Pro**, crie um projeto, importe documentos, escolha uma tarefa e envie. A opção **Automático** seleciona uma IA de texto já instalada conforme tarefa e memória. Revise a resposta antes de aplicar ao editor. Em **Estúdio → Ferramentas Pro**, ficam as funções de criação e edição de mídia.

## Os 20 recursos

| # | Recurso | Como usar e resultado |
|---|---|---|
| 1 | Biblioteca de documentos com fontes | Pro → Documentos. Importe PDF, DOCX, XLSX, CSV, texto e código; as respostas recebem trechos com página, linha ou planilha de origem. |
| 2 | Assistentes personalizados | Pro → Assistentes. Salve instruções, modelo e temperatura e selecione o assistente na tarefa. |
| 3 | Memória por projeto | Edite a memória do projeto com fatos e preferências revisados; ela acompanha as próximas tarefas desse projeto. |
| 4 | Editor com revisões | Revise a proposta ao lado do texto, aplique quando desejar e salve. Até 40 versões anteriores ficam disponíveis. |
| 5 | Processamento em lote | Selecione documentos e execute a mesma instrução em cada um, com fila, progresso e cancelamento. |
| 6 | Chat em outro dispositivo | Minha API → crie uma chave e ative acesso na rede. Abra o endereço do chat remoto e informe a chave no outro dispositivo. |
| 7 | Automações reutilizáveis | Gere ou escreva uma instrução, salve em Automações e execute sobre os documentos do projeto. |
| 8 | Ideia para montagem de vídeo | Estúdio → Storyboard. A IA cria cenas editáveis; gere imagens ou clipes locais e monte-os na linha do tempo, com narração opcional. |
| 9 | Legendas automáticas | Estúdio → Legendas. Whisper transcreve o áudio em segmentos, posiciona textos editáveis na linha do tempo e exporta SRT. |
| 10 | Seleção automática de modelo | Nas tarefas Pro, Automático considera modelos instalados, especialidade de código, tamanho e memória disponível. |
| 11 | Pesquisa com fontes | Selecione Pesquisa e ative Internet. Use busca ou forneça até seis links; páginas legíveis são apresentadas como fontes. |
| 12 | Assistente de código | Importe arquivos ou uma pasta de código, escolha Código e revise a proposta no editor antes de exportar. |
| 13 | Documentos Office | Gere conteúdo, aplique ao editor e exporte DOCX, XLSX ou PPTX, além de Markdown. |
| 14 | Edição com camadas | Estúdio → Camadas. Adicione até seis camadas visuais e seis faixas extras de áudio, com posição, tempo, opacidade e volume. |
| 15 | Narração local | Estúdio → Voz. Instale Faber em português brasileiro e transforme texto em áudio no próprio computador. |
| 16 | Versões para redes sociais | Crie cópias em 9:16, 1:1 e 16:9, com ajuste de enquadramento; os arquivos de cada cópia são independentes. |
| 17 | Edição por máscara | Estúdio → Imagem. Pinte a região e descreva a mudança. O motor gera a alteração e o aplicativo preserva a imagem original fora da máscara. |
| 18 | Diagnóstico e perfis | Pro → Desempenho. Veja memória e processador; salve contexto, tokens e temperatura por modelo para as tarefas Pro. |
| 19 | API com controles | Minha API. Crie chaves nomeadas com cota diária e limite de tokens; acompanhe uso e revogue acessos. Requisições Pro aguardam na fila. |
| 20 | Backups cifrados | Pro → Backups. Exporte projetos Pro e projetos do Estúdio com senha; restaure após conferir o conteúdo. São mantidas dez versões locais cifradas. |

## Interface

Área Pro com navegação por projeto, tarefas e editor lado a lado em telas grandes; composição adaptada ao celular. Temas claro e escuro, ícones discretos e controles consistentes com o restante do aplicativo. As ferramentas do Estúdio mantêm abas e fechamento acessíveis enquanto o conteúdo rola.

## Motores e funcionamento offline

Texto usa os motores GGUF/llama.cpp e MLX existentes. MLX exige Apple Silicon. Whisper executa a transcrição; sherpa-onnx executa a voz Faber em um runtime Node próprio embarcado; Stable Diffusion 1.5 gera e edita imagens; Wan 2.1 gera clipes experimentais. Nenhum desses fluxos exige LM Studio aberto ou chave de um provedor.

Download inicial e pesquisa precisam de internet. Depois de instalados aplicativo, motores e pesos compatíveis, a inferência funciona offline. A qualidade e a velocidade dependem do modelo, do hardware e das configurações; adicionar ferramentas não torna um modelo pequeno equivalente a um modelo maior.

A voz usa aproximadamente 67 MB de download e 79 MB em disco. Sua ficha informa a licença do dataset e dos componentes; veja [avisos de terceiros](../THIRD_PARTY.md).

## Limites desta versão

- Documentos: 12 MiB por arquivo, PDF até 200 páginas, planilhas até 10 mil linhas e 30 MiB de texto Pro. A recuperação é lexical; não há OCR de PDF escaneado. Trechos são selecionados dentro do contexto disponível do modelo. Fontes citadas devem ser conferidas.
- Memória é explícita e revisável. Não há aprendizagem automática dos pesos nem garantia de lembrar todas as conversas antigas.
- Código fornece propostas revisáveis; não altera o repositório original nem afirma executar testes. Automações processam documentos sob comando do usuário; não são agendamentos nem controle irrestrito do computador.
- Exportação Office converte o conteúdo do editor; não reproduz qualquer layout editorial complexo automaticamente.
- Estúdio mantém os limites de cinco minutos por projeto e 100 MiB de mídia. Exportação ocorre em tempo real com a janela visível; codecs disponíveis determinam MP4/WebM.
- Stable Diffusion precisa da memória livre indicada pelo motor. Edição por máscara trabalha internamente em 512 × 512; preserva os pixels da imagem decodificada fora da máscara. Não é uma ferramenta vetorial.
- Wan é experimental: clipes curtos de 256 × 256 e 17 quadros. Montagens com imagens e áudio são mais práticas. Não há promessa de paridade com CapCut ou geração instantânea de vídeos longos.
- Reenquadramento usa uma estimativa de contraste para o foco, sem rastreamento de pessoas ou objetos; revise o corte.
- Legendas dependem do áudio e do Whisper instalado. A entrada de áudio é dividida em blocos; o usuário pode corrigir o texto e os tempos.
- A API atende texto. Chaves são mostradas apenas na criação, armazenadas como hash e mantidas somente em memória no chat remoto. A cota usa o dia UTC; a fila aceita até 20 esperas por até 30 segundos. Revogar uma chave encerra o servidor compartilhado para cancelar acessos em andamento.
- Compartilhamento usa HTTP na rede escolhida: use rede confiável ou VPN. Não há publicação automática na internet nem abertura de portas do roteador.
- Backup contém o espaço Pro e os projetos do Estúdio, sem pesos de modelos, chaves da API ou histórico do Chat antigo. A restauração substitui o espaço Pro após confirmação e importa o Estúdio como cópias. A senha do backup não é armazenada; sem ela não é possível restaurá-lo.

## Validação

A suíte automatizada valida documentos, revisões, memória, lotes, fila, cancelamento, modelos, exportações, backup adulterado/senha errada, cotas simultâneas, camadas e proteção de rotas. Testes reais no Mac verificaram resposta baseada em documento com Qwen3-0.6B, pesquisa com duas fontes, síntese Faber, transcrição Whisper, vídeo com legenda/camada/áudio, formatos sociais e edição nativa por máscara.

O chat remoto foi testado no navegador com viewport de celular, na mesma máquina. Não houve teste físico em um segundo dispositivo. Windows e Linux recebem pacotes próprios, com runtimes correspondentes; a execução nativa nessas plataformas ainda requer validação. Veja [verificação](verification.md) para os resultados da entrega.
