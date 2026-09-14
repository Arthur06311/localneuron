# Verificação executada

9 de setembro de 2026, macOS ARM64, Node.js 24.14.1.

## Automação

Resultado histórico da Alfa 0.1: **24 testes passaram**, nenhuma falha. A suíte inclui:

- Sessão ausente, Host forjado, origem cruzada e campo extra de organização.
- Criação/execução idempotentes e conflito por reutilização de chave.
- Ferramenta desconhecida, fluxo fora do escopo, ordem inválida e verificações obrigatórias ausentes.
- Ausência de cossinatura, revisão obrigatória e estrutura manual não aprovada como final.
- Fluxo novo sem alterar contratos anteriores.
- Edição com hash obsoleto, restauração sem apagar versões e aceite por versão.
- Verificador em processo Node separado, sem npm, executado fora da pasta do app.
- Alteração, remoção, reordenação, truncamento e raiz falsa em pacote exportado.
- Assinatura humana adulterada e UPDATE/DELETE do log recusados pelo banco.
- Senha incorreta, bloqueio, reabertura do banco e adulteração do estado persistido.
- Revogação durante execução, nenhuma nova versão confirmada.
- Duas reservas concorrentes com saldo insuficiente; liquidação repetida sem gasto duplicado; liquidação maior que reserva recusada.
- Pausa, falha de conexão simulada, retomada com nova autorização e recuperação de estado interrompido.
- Exclusão mútua entre processos sobre a mesma pasta.

O Juiz possui três capacidades reconhecidas neste recorte. A amostra acima verifica alguns casos normais e adversariais; **não se afirma cobertura completa do espaço de ações**, resistência geral a prompt injection ou equivalência a uma auditoria independente. A alteração de cossinatura no pacote também rompe o hash do evento; os testes do Juiz exercitam a ausência de assinatura em separado.

`npm audit --omit=dev`: nenhum alerta conhecido nas dependências de produção no momento da consulta, após atualização do Fastify para 5.12.3. Isso não comprova ausência de vulnerabilidades.

## Interface

Teste manual pela interface real, em serviço isolado de dados fictícios na porta 4319:

1. Criar briefing Coleção Horizonte.
2. Conferir contrato e autorizar estrutura manual.
3. Obter primeira versão com modo sem IA claramente identificado.
4. Editar roteiro e salvar segunda versão, preservando a primeira.
5. Marcar os critérios de revisão e validar a versão de teste.
6. Abrir auditoria e executar verificação: **15 eventos, cadeia íntegra**.

O espaço real permaneceu sem credenciais ou entregas de teste. Onboarding foi inspecionado visualmente. O resultado não é piloto, avaliação cega nem teste editorial com cliente.

## Geração real local

Teste com `qwen/qwen3.5-9b`, variante MLX 4-bit já instalada no computador, via LM Studio loopback. Instância `colmeia-qwen`, sem integração MCP e sem armazenamento de chat pela API nativa. O fluxo chegou a `review` em 30,18 s e produziu 3.913 caracteres com gasto externo zero. O tempo inclui configuração da fixture e execução; não é benchmark. A CLI solicitou contexto de 4.096, mas o runtime informou outra configuração posteriormente; não se afirma que esse limite foi efetivamente aplicado pelo MLX.

O rascunho e o pacote estão em `examples/`. O modelo inventou descrições como “tecidos selecionados” e “cortes modernos”; por isso não foi aprovado como entrega final. Os testes comprovaram integração, persistência e revisão obrigatória, não adequação editorial. A primeira tentativa esgotou a saída em raciocínio sem texto final; o adaptador passou a usar o controle de raciocínio da API nativa.

O validador foi ajustado após o teste para reconhecer títulos Markdown de nível 1 a 6 e desconsiderar uma linha de direção visual. O registro do exemplo preserva o resultado original, anterior a esse ajuste.

Mais cinco testes cobrem adaptadores, filtragem de modelos carregados, ausência de integrações/armazenamento, rejeição de truncamento/resposta excessiva e títulos de roteiro.

O bundle Electron abriu no macOS e exibiu a interface real. O serviço usa pasta de dados externa ao bundle, preservada nas atualizações.

## Ainda não demonstrado

Avaliação cega de qualidade e benchmark de latência de modelos, 20 tarefas reais, recuperação administrativa de chave, Mac suspenso/rede entre dispositivos, nuvem/faturamento, RLS multiempresa, DOCX/XLSX, instalador de distribuição, benchmark p95 e revisão externa. Não foram produzidas métricas comerciais ou promessa de qualidade a partir dos testes sintéticos.


## Biblioteca 0.2 — verificação de 09/09/2026

- 28 testes automatizados aprovados: inclui destino de download, SHA-256, tamanho, redirecionamentos, cancelamento, memória, chave instalada, contexto curto e recuperação de arquivos. `npm audit --omit=dev`: zero vulnerabilidades informadas.
- Navegador: catálogo com 4 cartões, descrições e métricas; confirmação, progresso e importação; seleção automática do modo/modelo; criação e autorização; revisão da saída; liberar memória e cancelar uma segunda transferência. Nenhum erro de JavaScript reportado pelo agent-browser ao final.
- Download real de Qwen3 Mini: 639.446.688 bytes conferidos pelo SHA-256 do catálogo. Importação no LM Studio, carregamento com API nativa e entrega local de 718 caracteres, estado `review`, gasto externo zero. A conferência posterior mostrou contexto efetivo de 40.960 tokens, apesar de solicitar 4.096. A Alfa agora exibe esse desvio, avisa que a estimativa de RAM pode ser superada e confere pressão/memória novamente após carregar, descarregando se perder a margem. Não se promete um teto de contexto imposto ao motor.
- A saída **não foi validada por humano**: o modelo Mini entregou uma lista de orientações, sem roteiro preenchido no formato pedido. A verificação automática sinalizou ausência de seção Roteiro; não houve aprovação automática. O teste comprova funcionamento do fluxo, não qualidade editorial.
- Um download de SmolLM2 foi iniciado e cancelado pela interface. O arquivo parcial foi removido e não ficou ativo após cancelamento.
- Correções encontradas no teste: pergunta introdutória do CLI apesar de `--yes`, atraso de indexação, opção HTML malformada do seletor de modo e recuperação de importação.
- Evidência: `examples/biblioteca-teste.json`, `biblioteca-geracao.md`, `biblioteca-auditoria.json` e `biblioteca-tela.png`. São dados fictícios de um espaço de teste, não o cofre do usuário.
- Âncora do pacote de teste: `9439b0439419c0aa72dc69d693ead863ec34f55c22cacc100ac7b50d95409f41`.

Pacotes Windows x64 e Linux x64 gerados no Mac, com executáveis PE/ELF das arquiteturas esperadas, recursos necessários e sem dados de espaço incluídos. Sem máquina Windows/Linux disponível para executar a aplicação: validação nativa permanece pendente. A matriz CI está no código e não foi executada remotamente.


## Chat e biblioteca 0.3 — verificação de 09/09/2026

- 33 testes automatizados passaram. Cinco testes novos cobrem streaming SSE com UTF-8 fragmentado, erro/truncamento e separação do raciocínio; persistência, idempotência, contexto e cancelamento; motor exclusivamente loopback e sem ferramentas; proteção HTTP do chat; catálogo de 23 arquivos únicos com versões/hashes e licenças específicas. O cancelamento preserva o trecho anterior e não confirma uma resposta tardia.
- `npm audit --omit=dev`: nenhuma vulnerabilidade reportada. A verificação não constitui auditoria externa de segurança.
- Teste real no navegador contra espaço fictício isolado na porta 4319: selecionar Qwen3 0.6B já instalado, enviar pergunta, carregar pelo aplicativo, receber resposta progressiva, enviar seguimento usando histórico, recarregar a página e reabrir as quatro mensagens persistidas.
- A resposta inicial do Mini foi imprecisa sobre o significado de IA local. O seguimento lembrou a pergunta anterior. Isso comprova integração e contexto, não qualidade de respostas. A conversa está em `examples/chat-local-teste.json`; não contém dados reais do usuário.
- Biblioteca: 23 cartões, filtro Gemma com três opções, busca E2B com um resultado. Foi corrigida a atualização da lista ociosa que substituía o campo de busca enquanto o usuário digitava. A atualização periódica agora ocorre somente durante transferências/importação.
- Interface conferida em 1280 px e largura estreita de 390 px; chat e biblioteca sem rolagem horizontal involuntária. No desktop de 1280 × 760, o botão Enviar permanece visível sem rolar a página. Nenhum erro JavaScript reportado pelo navegador.
- Catálogo consultado pela API pública do Hugging Face. Não foram baixados nem executados os 23 arquivos; compatibilidade, RAM efetiva e qualidade de cada um continuam pendentes. Download usa a mesma implementação já exercitada com bytes reais na versão 0.2.
- Pacotes 0.3 para macOS ARM64, Windows x64 e Linux x64 produzidos com o código atualizado. Mac executado; Windows/Linux inspecionados como pacotes, sem execução nativa nesses sistemas. Pacotes excluem cofre, histórico do usuário, sessão e pesos dos modelos.


## IAs, chat e compartilhamento 0.4 — 09/09/2026

- **39 testes passaram**, incluindo papéis de conversa, SSE fragmentado, contexto, fim por limite, falha/truncamento, regeneração com versões, parâmetros decimais preservados no estado canônico, API autenticada, streaming, concorrência, cancelamento ao desligar e permissões de clipboard do desktop.
- Dependências Markdown adicionadas com versões fixas; `npm audit --omit=dev` sem vulnerabilidades informadas na consulta.
- Download real pelo gerenciador: Qwen3.5 4B Q4_K_M, 2.740.937.888 bytes, SHA-256 `00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4`. Arquivo importado no LM Studio e carregado. A primeira tentativa de carga foi recusada por memória; após descarregar o Mini, a carga completou. O arquivo Mini foi preservado.
- O motor informou **262.144** de contexto, embora o aplicativo tenha solicitado 16.384 com flash attention. O chat usa janela estimada de 16.384; a memória reservada pelo motor pode exceder a estimativa. O desvio é mostrado na interface, sem promessa de teto imposto ao runtime.
- Chat real pela interface: pergunta em português sobre IA local, resposta com lista e bloco Python; status complete/stop em **40,192 s**, 90 tokens de entrada e 2.130 tokens de conclusão informados pelo motor. É evidência de integração, não benchmark ou certificação da correção da resposta. O exemplo gerado contém simplificações técnicas e não foi executado como código.
- Navegador: 29 cartões, filtro Qwen3.5 com quatro resultados; campo de busca preservado durante atualização da RAM. Requisição periódica de recursos observada com HTTP 200. Tema escuro persistiu após reload. Renomeação por diálogo HTML foi persistida no backend.
- Fixture maliciosa renderizada: zero scripts, imagens ou links javascript; marcador de execução permaneceu falso. Código foi mantido como texto copiável.
- Electron 44.3.0 real em perfil de teste, sandbox e isolamento ativos: escrita de texto de teste no clipboard confirmada e exportação Markdown por URL Blob concluída. Nenhum dado real do usuário foi exportado nesse teste.
- Minha API: geração de chave mascarada, escolha de interface privada, confirmação da rede, ativação e desligamento pela interface. Um cliente HTTP no **mesmo Mac**, conectado ao endereço privado da interface, listou modelo `local`, recebeu 401 sem chave e obteve resposta correta para 7×8 usando o Mini. **Não foi usado um segundo computador físico.** A chave de teste foi revogada e o listener desligado.
- Evidências fictícias: `examples/chat-04-teste.json`, `api-04-teste.json`, `chat-04-escuro.png` e `api-04.png`. Sem senha, chave de API integral ou conversas do usuário.
- Não foram executados todos os 29 modelos. Homologação por modelo, atualização automática assinada e execução nativa dos pacotes Windows/Linux continuam pendentes.

- Claro e Escuro conferidos; chat e biblioteca em 390 px sem rolagem horizontal involuntária. Navegador sem erros JavaScript ao término.
- Pacotes 0.4 macOS ARM64, Windows x64 e Linux x64 verificados: versão e bytes de interface, backend e invólucro iguais à fonte; dependências Markdown presentes; integridade dos arquivos compactados conferida, sem cofre, sessão, dados de usuário ou pesos. Pacotes Windows/Linux ainda não executados nativamente. Aplicativo atualizado abriu no Mac com o cofre anterior bloqueado, sem migração ou troca de senha.


## Motor integrado e assistente 0.5 — 09/09/2026

- **45 testes passaram**, incluindo ferramentas, leitura/gravação dentro da pasta, recusa de credenciais e links simbólicos, aprovação, cancelamento, arquivo alterado depois da prévia, comando real autorizado, proteção web contra rede privada/DNS misto, revisão de consultas após leitura privada, ciclo nativo de ferramentas, compatibilidade JSON e persistência assinada das atividades. Testes existentes de chat, API e armazenamento continuam passando.
- Executável oficial llama.cpp b10809 incluído, com URLs/tamanhos/SHA-256 fixados. Execução real de Qwen3.5 4B Q4_K_M no Mac ARM64 com Metal. O motor confirmou **16.384 tokens de contexto**, exatamente o valor solicitado. A integração externa anterior havia informado 262.144; a nova checagem do integrado recusa divergência em vez de presumir que o pedido foi aplicado.
- Teste direto: resposta correta para 7×8, 10 tokens de conclusão e 267 ms de geração reportados nessa chamada simples. Teste real de ferramenta computer_info e retorno ao modelo. Esses números não constituem benchmark de responsividade ou superioridade sobre outro aplicativo.
- Pesquisa real pela interface: consulta a Bing e leitura da documentação pública do Bionic. O primeiro provedor consultado retornou verificação anti-bot e não foi contornado; a implementação utiliza páginas públicas do Bing. Dependência do provedor e qualidade dos resultados continuam sendo limites.
- Arquivos pela interface: leitura de notas.md e proposta de resumo.md numa pasta fictícia. Conferido no filesystem que o arquivo não existia antes da autorização. O clique Autorizar criou o arquivo; o download autenticado retornou os mesmos 129 bytes, SHA-256 `4a6f64ca955255f135fca1893bc2b6cd1258a895b1ccbf0a4b854b8b3dfbf4a2`. O primeiro tempo observado incluía a espera pela revisão; a versão final separa execução e revisão nas estatísticas.
- Electron real, com isolamento e sandbox do renderer: o botão Escolher pasta abriu o diálogo nativo do macOS usando o preload e o handler reais. A seleção por caminho e o uso da pasta foram exercitados na versão navegador. O teste do diálogo nativo foi encerrado sem selecionar outra pasta.
- Minha API com o motor integrado: listagem autenticada, 401 sem chave, resposta correta para 9×9, streaming terminado por DONE e recusa de ferramentas no cliente remoto. A API administrativa não foi publicada. Cliente no mesmo Mac; não houve segundo computador físico. Chave fictícia revogada e listener desligado ao terminar.
- Tema claro e escuro; viewport de 390 px sem rolagem horizontal involuntária (documento e corpo com 390 px). Navegador sem erros JavaScript ao término.
- Não foram executados todos os 29 modelos do catálogo. JSON foi exercitado com modelo simulado; conformidade de cada template precisa ser verificada por modelo. Voz, visão, navegador interativo e controle visual de aplicativos não foram implementados. Não foi demonstrada equivalência completa ou superioridade geral sobre Bionic.

- Após informar o ambiente ao modelo, teste real confirmou resposta sobre execução local/llama.cpp e consulta ao macOS 26.6.2, Apple M5 Pro e 24 GiB. Uma segunda gravação de fixture confirmou 9,724 s de execução e 2,167 s separados de espera por revisão; não é benchmark. Evidências sintéticas em `examples/motor-05-teste.json` e `api-05-teste.json`.

- Pacotes finais 0.5 macOS ARM64, Windows x64 e Linux x64: versão e 27 arquivos de backend/interface/desktop conferidos byte a byte contra a fonte. Runtimes Windows/Linux conferidos contra os arquivos extraídos dos downloads oficiais verificados. Links simbólicos relativos e permissão de execução do Linux preservados. Arquivos compactados íntegros, sem cofre, sessão, pesos ou dados do usuário.
- ZIP macOS extraído em pasta temporária fora do File Provider passou `codesign --verify --deep --strict` (assinatura ad hoc, sem notarização). A cópia na pasta sincronizada recebe atributos FinderInfo do sistema e não passa a mesma checagem estrita nesse local; os bytes de código foram conferidos e o aplicativo abriu normalmente. Windows/Linux não executados nativamente.
- Aplicativo Mac reaberto com o espaço anterior inicializado e bloqueado, aguardando a senha habitual. Antes de encerrar a versão anterior, foram conferidas três conversas, 36 mensagens e nenhuma resposta pendente; não houve redefinição de senha ou substituição da pasta de dados.


## MLX independente 0.6 — 10/09/2026

- **48 testes Node/TypeScript e 3 testes Python passaram.** Novos casos cobrem cópia independente de MLX, exclusão de código do modelo, partes ausentes/índice fora da pasta/links, ferramentas de internet ausentes por padrão, fallback JSON automático, delimitadores fragmentados, separação de raciocínio, ferramenta desconhecida/incompleta e validação dos parâmetros do worker.
- Runtime embarcado: CPython portátil 3.12.14, MLX 0.32.2 (wheel macOS 14 ARM64), MLX LM 0.31.3 e dependências fixadas por URL/SHA-256 no manifesto. Nenhum runtime foi obtido da instalação do LM Studio. Testado no macOS 26.6.2, Apple M5 Pro, 24 GiB; macOS 14/15 não executados.
- O modelo Mini do servidor externo foi descarregado e o servidor do LM Studio na porta 8080 foi desligado. Inferência MLX direta com Qwen3.5 9B 4bit respondeu 56 para 7×8; 1,962 s na primeira chamada simples de 3 tokens. Não é benchmark comparativo de desempenho.
- Copiados 5.950.221.142 bytes de pesos para a pasta de modelos da Colmeia, preservando a origem. Duas partes .safetensors comparadas por SHA-256 após a cópia. A fixture de servidor usada no teste completo só recebeu como raiz adicional a pasta de modelos da Colmeia, sem usar a pasta de modelos do LM Studio.
- Teste real pela interface com a cópia independente: resposta correta sobre execução sem LM Studio e chamada computer_info com macOS/24 GiB. Contexto efetivo 8.192 tokens, término stop, 12,633 s e 285 tokens de conclusão para o ciclo de consulta e resposta.
- Continuação no mesmo chat: criação de resultado.txt com aprovação (arquivo ausente antes de autorizar), memória de código fictício Aurora 672 em pergunta seguinte, cancelamento de história em andamento e resposta posterior pela API. API normal devolveu 81 para 9×9; SSE terminou por DONE. Chave fictícia revogada e listener desligado. Cliente no mesmo computador; não houve segundo dispositivo físico.
- Worker MLX usa sandbox-exec com network-outbound negado. Tentativa de conexão TCP externa usando o Python embarcado e a mesma política foi recusada por PermissionError do macOS; a geração local funcionou com essa política. Hugging Face offline e trust_remote_code=false também estão ativos. Isso comprova o bloqueio do worker, não o desligamento da rede do computador ou de ferramentas web habilitadas no processo do assistente.
- Navegador: escolha do MLX, carregamento, resposta e atividades reais; botão Usar offline confirmou Internet/Terminal desmarcados. Viewport 390 px sem rolagem horizontal (documento 390 px), sem erros JavaScript. Evidência sintética em examples/mlx-06-teste.json.
- A margem inicial conservadora de RAM recusou a carga durante preparação; foi implementada estimativa específica de MLX, limite de alocação no próprio MLX, cache limitado e lotes de prompt de 256 tokens. O limite não é promessa de RAM total nem autorização para carregar modelos que não cabem.
- Não foram executados todos os modelos MLX existentes, GPT-OSS MLX 20B, modelos de visão/áudio ou comparações cegas com LM Studio/Bionic. MLX embarcado é exclusivo do Mac Apple Silicon; Windows/Linux mantêm o motor GGUF.

- Teste usando o executável Electron do pacote (Node 24.20.0 embarcado), backend compilado do bundle e Python embarcado: carregou a cópia independente, contexto 8.192, MLX reportou 5.038.041.608 bytes de memória ativa após carga (não é a RAM total do processo). Respondeu 144 para 12×12. Worker retornou 401 sem credencial, 400 para contexto excessivo e 400 para nome remoto; trocar para GGUF deixou somente a nova instância carregada.
- Pacotes finais 0.6 macOS ARM64, Windows x64 e Linux x64 gerados; código de backend/interface/desktop conferido contra a fonte. ZIP Mac íntegro, assinatura ad hoc validada após extração fora do File Provider e Python extraído importou MLX/Metal corretamente. Aplicativo Mac reaberto no espaço anterior bloqueado, aguardando a mesma senha. Windows/Linux mantêm GGUF e não foram executados nativamente.

## Alfa 0.7 — biblioteca ampliada e chat dedicado (10/09/2026)

- 229 modelos de texto (200 novos), uma quantização por modelo/fine-tune; 15 novos conjuntos multipart. Identidades, licenças declaradas, categorias, nomes de arquivo e hashes estão no catálogo. As 6 referências de imagem/vídeo são explicitamente externas ao chat de texto.
- API pública do Hugging Face consultada: **229 commits, tamanhos e SHA-256 publicados conferidos**. Comando reproduzível: `python3 scripts/verify-catalog.py`, após compilar. Isso verifica metadados e disponibilidade da versão, não executa todos os modelos.
- **50 testes Node/TypeScript + 3 testes Python passaram.** Incluem soma de partes, sequência completa, arquivos únicos, hashes divergentes, cancelamento, arquivo ausente, symlink e as regressões de chat, ferramentas, API e cofre.
- Download real do novo Lite-Mistral-150M-v2-Instruct: **99.446.816 bytes**, SHA-256 conferido e instalação no motor integrado. Envio pela interface produziu um parágrafo em inglês sobre leitura. O motor respeitou automaticamente o contexto nativo de **2.048 tokens**, embora a interface tivesse solicitado 4.096. Esse modelo minúsculo foi usado para testar o fluxo, não como recomendação de qualidade.
- GGUF real desse modelo dividido em **3 partes** com `llama-gguf-split`: inventário apresentou exatamente um modelo, somou **99.447.136 bytes**, carregou e respondeu no motor integrado. Teste sintético separado, sem alterar os pesos do usuário. Qwen 235B e DeepSeek 671B não foram baixados ou executados nesta máquina de 24 GiB.
- Browser: **1440×900**, área de mensagens com **627 px de altura**; **390×844**, área com **528 px**, sem overflow horizontal/vertical e com compositor visível. Fonte normal 16 px no desktop, botão A＋ 19 px inclusive nos parágrafos Markdown. Histórico/painel de ajustes, preservação de rascunho ao abrir ajustes, temas, filtros por propósito, busca, paginação e diálogo de download multipart verificados; sem erros no console.
- O modo imagem/vídeo mostra três referências de cada tipo, com links aos arquivos e requisitos oficiais; não exibe botões de conversar ou instalar no motor de texto. Tamanhos e requisitos visuais precisam ser consultados para a variante/motor escolhido, sem inventar uma estimativa única de RAM.

Evidências sintéticas resumidas em `examples/catalogo-07-teste.json`. Os pacotes Mac, Windows e Linux usam o mesmo frontend/catálogo. Execução nativa foi verificada no Mac; Windows/Linux precisam de validação nos respectivos sistemas.

Pacotes 0.7: os arquivos de frontend/backend foram comparados byte a byte nas três plataformas. A execução com Electron/llama.cpp do pacote Mac carregou e respondeu com o GGUF real de 3 partes. ZIPs passaram CRC, TAR preserva o executável e nenhum pacote inclui pesos de modelos, cofre ou sessão do usuário. A construção assinou/verificou o bundle Mac fora da pasta sincronizada (assinatura ad hoc).

## LocalNeuron 0.8 — motores, voz e descoberta (10/09/2026)

- 57 testes Node/TypeScript e 3 testes Python passaram. Novos casos incluem permissões somente de áudio, validação WAV, metadados e partes do Hugging Face, orçamento de esforço, cancelamento de processo, autenticação/bloqueio das rotas e pré-requisitos Windows.
- Interface: nome LocalNeuron com ícone preservado; Internet e Esforço sincronizados com os ajustes; temas e persistência verificados. Em 390 × 844, chat com 515 px de área de mensagens e sem rolagem horizontal. Rascunho preservado durante preparação de modelo e transcrição direcionada à conversa de origem.
- Fluxo real Hugging Face: Qwen/Qwen3-0.6B → conversão unsloth → catálogo → download verificado de 396.705.472 bytes → instalação → resposta correta para 2+2 no chat. Catálogo adicional permaneceu após reconstruir a biblioteca, com contexto publicado de 40.960. SHA-256 do GGUF: ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a. Busca de 28 organizações; isso não homologa todas as arquiteturas/modelos encontrados.
- Inferência nativa MLX Qwen3.5 9B respondeu 56 para 7×8; troca para GGUF Lite-Mistral deixou somente uma instância ativa. Os processos foram encerrados ao terminar. Não houve comparação de qualidade ou velocidade com Bionic/LM Studio.
- Whisper tiny: download de 77.691.713 bytes verificado; áudio inglês conhecido atravessou captura, reamostragem, API local e preenchimento do rascunho no Chrome de teste. Áudio português sintetizado localmente foi transcrito corretamente pela API do pacote Mac. Não foi gravado nem validado o microfone físico. A captura automatizada usa dispositivo de teste; o app de entrega mantém sandbox e permissões normais.
- Stable Diffusion 1.5: download de 4.265.146.304 bytes verificado. Geração real pela API produziu PNG 512 × 512 de uma cabana entre árvores em 26,061 s, com 10 passos; artefato autenticado exibido no Estúdio. Não é benchmark comparativo.
- Os motores usam versões e hashes fixos; Whisper Mac foi compilado da fonte oficial com Metal e bibliotecas estáticas. Difusão utiliza pesos sob demanda, mmap, atenção otimizada e VAE em blocos. O Mac de teste é Apple M5 Pro, 24 GiB, macOS 26.6.2.
- Limites de plataforma: MLX é exclusivo do Mac Apple Silicon; o binário de difusão Mac exige macOS 26+. Windows x64 requer Microsoft Visual C++ v14; Linux x64 usa binários Ubuntu 24.04 ou compatível. Pacotes Windows/Linux não foram executados nesses sistemas.

- Pacotes 0.8 Mac, Windows e Linux comparados byte a byte com backend/interface/desktop da fonte; arquivos compactados íntegros, sem pesos, sessões ou cofre. ZIP Mac extraído passou assinatura ad hoc estrita; sem notarização de distribuição. As 997 entradas de dados anteriores e o hash do cofre permaneceram iguais antes de reabrir. Whisper tiny, SD 1.5 e Wan foram copiados para a instalação local após SHA-256; não incluídos nos pacotes redistribuíveis.

- Wan 2.1: três arquivos, 4.342.944.342 bytes verificados; perfil final executou 20 passos em 119,227 s e produziu 17 quadros WebP de 256 × 256. Pico residente medido pelo sistema: 6.154.420.224 bytes, sem swap atribuída ao processo; a interface estima 6 GiB mais 1 GiB de margem. A amostra contém um barco na água, mas tem artefatos e definição limitada: o perfil está identificado como experimental. A geração nativa foi validada; o endpoint de vídeo completo foi recusado corretamente por memória disponível durante o teste com banco aberto. Imagem e entrega autenticada foram verificadas pela API.

- LocalNeuron 0.8 reaberto sem flags de teste, usando o espaço original inicializado e bloqueado. A janela exibiu o nome novo e aguardou a senha habitual; nenhuma redefinição de senha foi realizada. Evidências resumidas em `examples/localneuron-08-teste.json`.


## LocalNeuron 0.9 — voz por toque e 350 modelos adicionais (10/09/2026)

- **58 testes Node/TypeScript e 3 Python passaram**. Cobrem 579 IDs/arquivos únicos, partes completas, SHA-256, limites de memória, voz somente de áudio, idioma validado, silêncio e aviso de saturação, além das regressões de chat, API e cofre.
- **350 entradas adicionadas**, uma variante GGUF por modelo/fine-tune, total 579. Metadados de revisão, bytes e SHA-256 conferidos contra respostas públicas da API Hugging Face arquivadas na pesquisa do catálogo. Revalidação online completa das revisões nesta rodada foi limitada por HTTP 429; as consultas foram interrompidas após respeitar os intervalos de espera. Downloads continuam verificando tamanho e SHA-256 antes de instalar. Não foram executados todos os modelos nem realizado ranking de qualidade.
- Excluídos novos modelos de OCR, embeddings, rascunho especulativo e extração especializada da seleção de conversa. Licenças permissivas e comunitárias são apresentadas individualmente; não se anuncia todo peso aberto como licença irrestrita. Novas entradas ultraleves informam limites com ferramentas.
- Gemma 3 270M IT: download real de **253.115.424 bytes**, SHA-256 `b1baabd6b729e4041822220d3e648e00d99cac5df86b10dffb77bcccf0688e39`, instalação e carga em 2.048 tokens. Respondeu Paris à pergunta sobre a capital da França, com Assistente desligado. Com ferramentas ativadas a tentativa anterior não produziu texto final; o aplicativo apresentou erro. Modelo usado para testar integração, sem recomendação de qualidade para tarefas complexas.
- Whisper Small: **487.601.967 bytes**, SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`. Áudio português de 7,72 s transcrito corretamente em 615 ms na chamada local observada. Português por padrão, cinco candidatos de decodificação e rejeição de áudio quase silencioso. Não é benchmark abrangente de precisão nem de velocidade.
- Fluxo de voz no Chrome de teste com áudio português sintético: microfone, barras, cronômetro, terminar, preenchimento do rascunho e descarte por Esc. Falha HTTP 503 simulada uma vez: gravação mantida em memória, botão Tentar novamente e transcrição real bem-sucedida sem regravar. O dispositivo de teste repete a frase do arquivo; isso explica a repetição no rascunho. Não foi gravado ou homologado um microfone físico.
- Interface em 390 × 844: 510 px de área de mensagens, botão de voz 36 × 36 com ícone de 21 px, sem rolagem horizontal. Favoritos guardados localmente e comparação com duas colunas de modelos conferidos. Temas claro e escuro. A gravação é descartada ao trocar de conversa; uma transcrição já iniciada mantém o destino original do rascunho.

- Pacotes 0.9 Mac/Windows/Linux comparados byte a byte com a fonte; arquivos compactados verificados e sem dados privados. Assinatura ad hoc estrita do ZIP Mac conferida após extração. Os 997 arquivos de dados anteriores permaneceram iguais antes de reabrir; Whisper Small foi acrescentado após verificação SHA-256. Aplicativo reaberto no espaço original e desbloqueado pelo usuário: API apresentou 579 entradas e Whisper Small instalado/disponível. Windows/Linux não executados nativamente. Evidência resumida: `examples/localneuron-09-teste.json`.

## Alfa 0.10 — interface profissional (11/09/2026)

- `npm test`: 58 testes Node passaram, sem falhas. O redesenho não altera os motores Python.
- Cinco páginas verificadas em 1440×900, 900×700, 390×844 e 320×650: sem rolagem horizontal do documento nem controles fora da largura da tela.
- Inspeção visual dos temas claro e escuro, chat vazio e conversa de teste, biblioteca, comparação, Estúdio, API, Preferências e ajustes do chat.
- Internet ligada/desligada e slider de esforço atualizam os estados; histórico abre/fecha; favorito acionado pelo SVG funciona; comparação com dois modelos abre; gravação de áudio sintético pode ser iniciada e descartada, liberando Enviar. Nenhuma medição nova de precisão da transcrição.
- Mensagens do usuário alinhadas à direita; respostas mantêm a área de leitura. Ícones, CSS e tipografia não dependem de rede.
- Registro sem dados pessoais em `examples/localneuron-010-teste.json`.
- Os três pacotes são comparados com o código-fonte. A execução nativa permanece verificada somente no macOS; Windows/Linux são pacotes de distribuição, sem validação nativa nesta rodada.

## Alfa 0.11 — estúdio com linha do tempo (12/09/2026)

- 63 testes Node passaram: validação de projetos e mídias, cortes preservando intervalos da origem, limites, texto/áudio e autenticação/validação das novas rotas, além das regressões existentes.
- Chrome no Mac: importação de PNG, WAV e WebP animado; texto, divisão de cenas, música, restauração após recarregar e exportação/importação de projeto com IDs remapeados. Temas claro/escuro, desktop e 390×844 sem overflow horizontal do documento.
- MP4 real: 545.017 bytes, 1280×720, 4,048 s; áudio decodificado com 3,989 s e pico 0,03827. WebM real: 2.552.097 bytes, 1280×720, 9,07 s, reimportado com sucesso. Cancelamento libera os controles. Exportar exige página visível; ocultar a página interrompe a captura.
- SD 1.5 gerado pela interface, 10 passos, PNG 768×448 incorporado à linha do tempo. Wan 2.1 gerado pelo mesmo AuxRuntime em fixture separada: 97,29 s, 46.700 bytes, perfil experimental de 17 quadros 256×256. A admissão recusou corretamente duas tentativas anteriores com RAM insuficiente; após encerrar os processos de teste extras, a geração concluiu. Pesos existentes utilizados sem alteração.
- Projetos usam IndexedDB; exportação portátil inclui as mídias. A exportação do chat não é backup do Estúdio. Limites e restrições do editor descritos em docs/localneuron-0.11.md.
- Evidências sintéticas resumidas em examples/localneuron-011-teste.json. Exportação de mídia testada no Chrome/macOS; não foi executada nativamente em Windows/Linux.
- Pacotes 0.11 Mac/Windows/Linux comparados byte a byte com frontend/backend/desktop da fonte; arquivos compactados íntegros e sem dados privados. ZIP Mac com assinatura ad hoc estrita validada após extração. Cópias numeradas de conflito da sincronização são ignoradas somente quando o arquivo original do motor existe.
- Os 1.000 arquivos anteriores do espaço local permaneceram iguais antes de reabrir. LocalNeuron.app 0.11 reaberto normalmente, bloqueado com a senha existente; os quatro arquivos do editor servidos pelo aplicativo correspondem à fonte. Nenhuma senha foi alterada.


## LocalNeuron 0.12 — Pro

74 testes automatizados passaram, incluindo cancelamento ativo com avanço da fila, persistência após reinício, bloqueio de rotas Pro, origem externa recusada, pesquisa sem Internet recusada, revisões, memória, lote, documentos Office, backup adulterado e cotas simultâneas da API.

No Mac, os fluxos reais incluíram resposta com documento e citação, pesquisa com duas páginas, proposta de código, automação reutilizável em lote, exportações Office, backup/restauração, chat remoto em viewport de celular, voz Faber, legendas Whisper e MP4 com trilhas de vídeo e áudio. A montagem de duas cenas geradas com narração terminou pela interface. Na edição por máscara, 11.000 pixels dentro da seleção mudaram e nenhum dos 250.069 pixels conferidos fora dela mudou.

O teste do pacote encontrou a restrição de buffers externos do Electron no addon de voz. A correção inclui Node 24.14.1 próprio, com download e SHA-256 fixados por plataforma. A chamada do ProMedia a partir do Electron 44.3.0 empacotado gerou WAV de 97.386 bytes. O usuário não precisa instalar Node separadamente.

Temas claro/escuro e viewport móvel foram conferidos, sem rolagem horizontal indevida no Pro. Perfis salvos reapareceram com seus valores. Pacotes de Mac, Windows e Linux correspondem aos arquivos compilados, incluem as bibliotecas nativas corretas e não contêm dados pessoais. ZIP/TAR foram lidos integralmente; a assinatura do Mac extraído foi validada. Antes de reabrir o aplicativo, os 1.000 arquivos existentes de dados conferidos estavam inalterados. A tela real voltou bloqueada, com campo de senha vazio e a nova navegação Pro.

Execução nativa de Windows/Linux e acesso por um segundo dispositivo físico não foram testados. A geração Wan continua experimental. Este é um conjunto inicial de funções Pro, sem cobrança. Relatório estruturado (evidência interna da versão) e [guia dos 20 recursos](localneuron-0.12.md).


## LocalNeuron 0.13 — Chat e ferramentas

78 testes passaram. A cobertura nova verifica recuperação de anexos em perguntas seguintes, isolamento entre conversas, memória no contexto, indicação de contexto privado ao agente, limites de extração, ramificações idempotentes que preservam o original e bloqueio de escrita/terminal no modo de leitura. As rotas novas respeitam sessão, origem e bloqueio; a transferência para o Pro preserva o texto e a memória na criação do projeto.

No navegador, Qwen3-0.6B combinou o orçamento de 980 reais de um anexo com o nome Marina salvo na memória. A ramificação editável reutilizou o anexo e respondeu corretamente a data de 21 de novembro. O perfil de leitura executou files_read no README de uma pasta de teste, retornou npm test e manteve o arquivo intacto. PDF, DOCX e XLSX foram extraídos pelo endpoint real. Um comando pessoal continuou disponível após recarregar, a busca levou à mensagem encontrada, a resposta foi aberta no editor Pro e o Markdown exportado continha memória e fontes.

Temas claro/escuro foram conferidos. Em viewport 390 × 844, o documento tinha largura 390, a área de mensagens tinha 384,5 pixels e Enviar permaneceu visível. Não houve erro de JavaScript no navegador. Os três pacotes coincidem com os arquivos distribuídos e não incluem dados pessoais; arquivos ZIP/TAR e assinatura Mac foram verificados. Antes de reabrir, os 1.000 arquivos existentes de dados estavam inalterados. O aplicativo 0.13 voltou à tela bloqueada com a senha atual preservada.

Windows/Linux foram empacotados e inspecionados, sem execução nativa. Os testes com modelo pequeno verificam funcionalidade, não qualidade geral das IAs. Relatório (evidência interna da versão) e [guia dos recursos](localneuron-0.13.md).

## LocalNeuron 0.14 — assinatura mensal

88 testes passaram, sem falhas. Os novos testes cobrem assinatura Ed25519, prazo offline, reinício, cancelamento, relógio alterado, licença adulterada, outro dispositivo, falha de rede, recuperação de arquivo corrompido, limites de RAM, bloqueio HTTP premium e preservação de edição/exportação. A API continua atendendo com a chave básica após expirar o Pro. O adaptador Stripe de teste confirma Checkout único, assinatura mensal, portal vinculado ao cliente, renovação, fatura pendente e eventos repetidos/fora de ordem; não foram feitas cobranças reais.

No navegador, foram verificados: página Meu plano em 1440 px e 390 px, temas claro/escuro, navegação, apresentação do Pro, licença de teste ativa e retorno ao Grátis. O Qwen3-0.6B GGUF respondeu a 17 + 25 com contexto automático de 4096 tokens; o perfil foi salvo e a resposta transferida a Projetos. Após desativar a licença, o chat continuou com contexto manual de 16384 tokens e respondeu 3 + 4. Uma resposta numérica terminada em ponto agora permanece texto visível em vez de virar um item vazio de lista Markdown. Sem erros JavaScript detectados no fluxo final.

Dados estruturados: localneuron-014-teste.json (evidência interna da versão). A configuração comercial está vazia, por isso a distribuição inicia no Grátis e informa que a venda ainda não foi ativada. A execução nativa dos pacotes Windows/Linux e a homologação Stripe real continuam pendentes.

Pacotes 0.14: arquivos de `dist`, `public` e `desktop` comparados byte a byte com a fonte nas três plataformas; nenhum dado privado incluído. ZIPs conferidos por CRC e TAR lido integralmente. O ZIP do Mac foi extraído e passou em `codesign --verify --deep --strict`. Os 1.000 arquivos de dados abrangidos pelo manifesto de preservação permaneceram iguais durante a substituição; modelos e mídias não foram modificados pelo empacotamento. O aplicativo LocalNeuron 0.14 foi reaberto e conferido na página Meu plano. A cópia antiga Colmeia foi encerrada para liberar a porta compartilhada. A assinatura do Mac é ad hoc, sem notarização para distribuição pública.

## 0.15 · Biblioteca e acesso ao Hugging Face

- 661 versões GGUF (82 entradas adicionais), 660 repositórios, 987 arquivos. Auditoria pública completa de revisão, bytes, SHA-256 e HEAD de cada parte, registrada em `docs/catalog-access.json`. Redirecionamentos aceitos como acesso na origem; não é uma execução ou download completo de todos os pesos.
- Pesquisa global e 51 publicadores, repositório direto, seleção de quantização, credencial HF criptografada e independente do Pro. Seis entradas são bloqueadas como chat incompatível; motivos aparecem na ficha.
- 96 testes Node/TypeScript passaram. Retomada por Range, reinício quando Range é ignorado, hashes incorretos, conjuntos divididos, ausência de token na CDN, criptografia, bloqueio e desconexão concorrente cobertos.
- SmolLM2-135M-Instruct: 105.454.432 bytes baixados, pausa em 34.919.380 bytes, retomada, instalação, carga e resposta completa local, com internet do chat desabilitada. Modelos gigantes não executados no Mac de 24 GiB.
- Browser: catálogo, login explicado do Gemma, 27 variantes Kimi, inclusão de BF16 existente sem duplicação, pesquisa global, cinco motores, modo claro/escuro e 390 px sem overflow horizontal ou erros de console. Três descrições genéricas corrigidas na revisão final.
- Três pacotes comparados byte a byte com fonte final. ZIPs e TAR lidos integralmente, assinatura ad hoc do Mac verificada estritamente após extração. Os 1.001 arquivos de dados existentes permaneceram iguais antes de reabrir. Windows/Linux não executados nativamente. Credenciais reais para repositórios restritos não utilizadas nesta validação.


## 0.16 · Catálogo visual e ícones

- 360 entradas visuais adicionais (260 imagem, 100 vídeo); total de 1.027 entradas, incluindo versões, conversões e componentes. 366 repositórios visuais únicos, 4.445 arquivos de pesos listados. Todas as novas entradas tiveram acesso público dos arquivos listados verificado; uma referência anterior exige autorização. Auditoria em `docs/media-access.json`.
- Identidade visual para as 1.027 entradas: 915 avatares públicos armazenados offline e 112 identificações por iniciais. Fontes em `docs/model-icon-sources.json`.
- Download visual individual com tamanho, revisão fixa, SHA-256, pausa, retomada, credencial protegida e coordenação com outros downloads. Seis perfis SD 1.x adicionais integrados ao instalador e Estúdio; os outros pesos não são apresentados como pipelines já executáveis.
- 102 testes passaram. Arquivo real LTX-2.5 de 3.843.690 bytes baixado e verificado. Perfil SD 1.5 adicional selecionado corretamente no Estúdio com pesos completos de hash correspondente em área isolada; tentativa de geração bloqueada pela proteção de memória disponível. Não foi validada geração real dos seis perfis novos.
- Catálogo e Estúdio conferidos no navegador; claro/escuro, filtros de imagem/vídeo, avatares e viewport 390 px sem overflow horizontal ou erros JavaScript observados. O aviso geral agora identifica explicitamente as seis entradas de texto incompatíveis, separado das integrações visuais.

Pacotes 0.16 Mac/Windows/Linux comparados byte a byte com a fonte final, sem dados privados. ZIPs conferidos e TAR lido integralmente; assinatura ad hoc do Mac extraído verificada estritamente. Os 1.004 arquivos abrangidos pelo manifesto de preservação ficaram inalterados antes da reabertura. O aplicativo 0.16 foi reaberto na tela bloqueada e confirmou servir os quatro arquivos novos/atualizados do catálogo. Windows/Linux não foram executados nativamente.


## 0.17 · Central Pro e controle de entregas

- Central Pro com métricas dos registros locais, projetos recentes, atalhos e acesso às ferramentas. Doze atalhos iniciais e até 100 atalhos próprios, com busca e inclusão no backup Pro.
- Modos Rápido, Equilibrado e Com revisão; este último executa duas passagens pelo mesmo modelo e preserva a primeira versão. Estilo e idioma explícitos. Fila com prioridade estável, pausa persistida e histórico de duração/etapas/chamadas.
- Rascunhos de pedidos e ajustes por projeto no armazenamento local do navegador. Modo foco para o editor e atalhos de teclado. Limites das chaves Pro editáveis, pausa individual e indicação da cota UTC.
- 107 testes passaram. As novas rotas premium foram verificadas com assinatura inativa. Testes específicos cobrem revisão com contexto preservado, cancelamento durante a segunda passagem, prioridades, pausa, backup de atalhos, cotas e suspensão de chave.
- Qwen3-0.6B executou uma tarefa real pelo formulário, em duas passagens, respondendo 17 + 25 = 42. A primeira versão e a saída final ficaram registradas. Teste funcional, sem alegação de melhoria medida de inteligência.
- Navegador em 1440 px/390 px, claro/escuro, criação e pesquisa de atalho próprio, restauração de rascunho/ajustes ao trocar aba, prioridade/cancelamento e fila atualizando depois de repetir tarefa, modo foco, edição/pausa de chave e apresentação da assinatura ativa/encerrada. Nenhum erro de console observado no fluxo final; sem transbordamento horizontal na central e na API em 390 px.
- Licença de teste isolada, fora dos pacotes; cobrança real segue sem configuração. A base gratuita e o conteúdo existente continuam disponíveis após encerrar a assinatura.

Os três pacotes 0.17 foram comparados byte a byte com a fonte final. ZIPs e TAR passaram na verificação; assinatura ad hoc do Mac extraído válida. Os 1.004 arquivos do manifesto de preservação ficaram inalterados antes da reabertura. O aplicativo voltou à tela bloqueada com a navegação Central Pro, servindo os cinco arquivos atualizados da experiência premium. Nenhuma licença de teste foi instalada nos dados do usuário.


## 0.18 · Identidade Pro e início guiado

- Identidade grafite/dourado para o Pro ativo, selo de plano no aplicativo, entrada permanente para benefícios e central. O estado é retirado ao bloquear e atualizado ao retornar ao Grátis. Ícone original preservado.
- Início guiado em três caminhos: entrega, código e vídeo. Criação de projeto com nome e uso de projeto existente conferidos pelo navegador. Pedido e modo com revisão preparados, com zero tarefas disparadas automaticamente.
- Comparação interativa por objetivo (escrita, documentos e API), com descrições dos recursos reais. Página de assinante prioriza ferramentas liberadas; comparação de planos fica recolhida. Licença de teste mostra ausência de cobrança, prazo e ausência de renovação.
- 107 testes passaram. Navegador em 1440 px e 390 px, claro/escuro, comparação de documentos/API e transição Pro → Grátis conferidos sem erros de console nos fluxos finais ou transbordamento horizontal observado.
- Empacotador Mac separa configuração local de teste do ZIP distribuível. A opção local aplica somente a chave pública depois de criar o ZIP limpo, preservando a licença assinada do proprietário nos seus dados. Nenhuma chave privada nem dado do usuário acompanha os instaladores.

Pacotes Mac/Windows/Linux comparados com os arquivos finais de `dist`, `public` e `desktop`. ZIPs e TAR verificados, assinatura ad hoc do ZIP Mac extraído validada estritamente. Os 1.005 arquivos de dados do manifesto permaneceram iguais antes de reabrir. O app 0.18 foi reaberto e a Central Pro foi conferida na janela real; a API confirmou o teste ativo, com o vencimento original em 20/09/2026. O ZIP do Mac e os pacotes Windows/Linux mantêm a configuração comercial vazia; só o aplicativo instalado preserva a chave pública de teste.
