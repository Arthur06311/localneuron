# Guia de configuração do LocalNeuron

LocalNeuron 0.27 · Alfa. Este guia explica o aplicativo instalado no seu computador. Nenhuma senha, chave ou configuração privada é enviada por esta página.

## Começar

1. Baixe o pacote do seu sistema em **Downloads**. No GitHub Releases, escolha um instalador em Assets; “Source code” é somente o código-fonte.
2. No Mac, abra o DMG e arraste o app para Aplicativos. Windows/Linux: extraia tudo e abra o executável na pasta.
3. Abra o app e configure a proteção do espaço. Se você já tinha senha, use **entrar/desbloquear**, preservando seus dados.
4. No assistente inicial, confira o computador, escolha seu perfil e revise as recomendações. Você pode voltar ao assistente depois sem recriar os mesmos bots.
5. Em **Modelos**, escolha uma IA de texto pequena marcada como compatível com o motor disponível. Confira RAM, disco, licença e tamanho antes de baixar.
6. Quando o download terminar, abra o Chat e selecione o modelo. O carregamento na RAM pode demorar na primeira vez.

**Já instalou antes?** Feche o app antes de atualizar. Preserve a pasta de dados e substitua apenas o aplicativo. Não crie outra senha sobre uma instalação existente nem apague a pasta para “corrigir” o login.

## Entrar sem digitar a senha toda vez

No login do aplicativo desktop, marque **Lembrar meu acesso neste computador**. A credencial é cifrada pelo armazenamento seguro do sistema; não é guardada no navegador. Quem usa sua sessão do computador poderá abrir o espaço. A opção é voluntária e pode ser desligada em **Preferências → Acesso neste computador**. O botão **Bloquear aplicativo** continua bloqueando a sessão atual.

O wizard salva a conclusão ao chegar ao último passo. Para refazê-lo, use **Minha equipe → Mais opções da equipe → Repetir configuração**. Isso preserva perfil, conversas e bots existentes, sem obrigar a refazer tudo na próxima abertura.

## Avisos de novas versões

A partir da 0.27, o aplicativo avisa quando encontra uma versão mais recente no manifesto público do GitHub (endereço independente do domínio do site). Consulte **Preferências → Atualizações** para verificar manualmente, ler novidades ou desativar a consulta automática. A consulta ocorre ao abrir e a cada seis horas, com cache, sem enviar conversas, arquivos ou identificadores do espaço. A hospedagem recebe a requisição de rede normal, incluindo IP. Falhas de conexão não bloqueiam o uso offline.

**Agora não** dispensa o aviso daquela versão. Uma versão posterior volta a ser avisada. O instalador é baixado pelo link; não há instalação automática. Quem usa 0.26 ou anterior precisa instalar a 0.27 uma vez para receber os avisos futuros.

## Requisitos

O tamanho do aplicativo não inclui os modelos. Download é espaço no disco; RAM é memória usada durante a execução. Contexto maior, vídeo e várias ferramentas podem aumentar bastante o consumo.

| Componente | Requisitos e disponibilidade |
|---|---|
| Aplicativo | macOS Apple Silicon, Windows x64 ou Linux x64 com ambiente gráfico. Windows/Linux ainda aguardam validação nativa. |
| Texto GGUF | Motor llama.cpp incluído. Escolha arquitetura e quantização suportadas; a estimativa da ficha não substitui um teste real. |
| MLX | Apple Silicon. Runtime exige macOS 14+; execução desta alfa verificada no macOS 26.6.2. |
| Photo / Video | Perfis visuais suportados pelo motor. O binário visual Mac exige macOS 26+. |
| Música | ACE-Step instalado separadamente, 25 GiB livres para preparar o ambiente; cerca de 6,32 GB de pesos mais dependências. RAM/GPU influenciam duração e velocidade. |
| EXO gerenciado | Mac Apple Silicon com macOS 26.2+; computadores na mesma rede confiável. |
| Editor | DaVinci Resolve Studio e SDK Python instalados. No Windows/Linux, Python 3 disponível no sistema. |
| Voz | Permissão do microfone e modelo Whisper instalado. |

No Windows, os motores podem precisar do [Microsoft Visual C++ Redistributable x64](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). No Linux, use as dependências e a configuração de sandbox exigidas pela sua distribuição.

**Distribuição Mac:** o pacote atual tem assinatura ad hoc e ainda não possui notarização Apple. Confira a origem e o checksum do arquivo. Não desative o Gatekeeper globalmente. Veja as [orientações oficiais da Apple](https://support.apple.com/102445) sobre alertas ao abrir aplicativos.

## Modelos e motores

A biblioteca reúne mais de mil entradas, incluindo variantes de quantização. Isso não significa mil arquiteturas distintas nem que todos os modelos foram testados em inferência.

- **Conversa / escrita:** responder perguntas, revisar, resumir e redigir. A categoria descreve o uso sugerido.
- **Código:** programação, explicações e análise de código.
- **Raciocínio:** problemas com mais etapas; o ajuste de esforço depende do suporte do modelo.
- **Imagem / vídeo / áudio:** usam pipelines específicos. Estar no catálogo não significa que o Chat de texto pode executar o modelo.

Use a ficha para conferir **motor integrado**, licença, origem, download e RAM estimada. Modelos marcados como referência ou download externo precisam de integração adicional. Modelos restritos no Hugging Face podem exigir aceitar sua licença e autorizar sua conta; o app não contorna essa exigência.

Para começar, prefira uma quantização Q4 de um modelo pequeno que caiba com folga na memória disponível. Se faltar RAM, libere o modelo atual, reduza o contexto e escolha uma versão menor. **Liberar memória** descarrega a IA da RAM sem apagar os pesos do disco.

Não é preciso ter LM Studio aberto para os motores integrados. Depois da instalação dos motores e pesos, desative Internet no chat para usar inferência local sem pesquisa web. Downloads, conexões MCP e consulta de sites continuam dependendo de rede quando acionados.

## Chat e bots

Converse em uma página ampla, com histórico, anexos, memória revisável e ajustes. As conversas podem ser organizadas pelo modelo ou bot. Ramificações permitem testar outra resposta preservando o contexto anterior.

Em **Minha equipe**, escolha **Ativar equipe de trabalho**, **Ativar equipe pessoal** ou **Ativar todos os bots**. A ativação prepara seis especialistas profissionais e/ou quatro auxiliares pessoais com uma IA instalada compartilhada. Você pode escolher o modelo ou deixar o app selecionar entre os recomendados que já estão no computador. Se não houver um modelo elegível, a interface indica como instalar um; não começa um download oculto.

Clique em **Dar uma tarefa**, escolha uma sugestão e acrescente seu contexto. A execução abre uma conversa daquele bot. Acompanhe o resultado, autorize ferramentas quando solicitado ou clique em Parar. A ativação dos bots não inicia ações externas nem trabalho contínuo por conta própria.

Ativar novamente não duplica os bots. Métodos originais antigos podem ser atualizados, preservando instruções personalizadas e memórias. A qualidade depende do modelo; para tarefas complexas, um modelo minúsculo pode ser insuficiente.

O assistente inicial também ajuda a montar bots pessoais e profissionais. Edite nome, especialidade, modelo, instruções e permissões. A especialidade organiza o comportamento; não confere conhecimento profissional certificado ao modelo.

A sala permite colaboração sequencial de até seis bots, até três rodadas e dez minutos, com cancelamento. Ferramentas da sala permanecem desativadas nesta alfa.

**Internet** habilita pesquisa/leitura web. **Esforço** ajusta o raciocínio quando suportado. **Parar** interrompe a geração. Em Preferências, **Usar a personalidade LocalNeuron** liga/desliga o estilo do aplicativo; começa desligado e preserva as instruções dos bots.

Ferramentas de computador, arquivos e terminal têm controles próprios. Escolha a pasta de trabalho e revise ações que alterem arquivos ou executem comandos. Controle nativo não equivale a automação visual universal de qualquer aplicativo.

## Photo e Video

Abra **Photo** para imagens e **Video** para cenas e montagem. O recomendador considera os perfis que o motor realmente integra; os demais modelos da biblioteca visual podem ser apenas downloads de pesos.

1. Rode o recomendador e confira memória e espaço.
2. Instale um perfil integrado e espere os arquivos terminarem.
3. Descreva o que quer criar e comece com resolução/duração menores.
4. Revise a mídia, organize cenas, cortes, textos e áudio.
5. Salve o projeto e exporte conforme os formatos e codecs disponíveis.

Vídeo pode consumir muita memória e levar bastante tempo. Não há promessa de geração instantânea nem de execução de qualquer modelo de vídeo do Hugging Face. Use o botão de parada quando necessário e preserve o projeto antes de operações grandes.

## Música

A aba **Música** usa o motor aberto ACE-Step 1.5, instalado em uma pasta própria. O instalador prepara Python, dependências e pesos com revisão e SHA-256 fixados.

1. Abra Música e consulte a recomendação para seu computador.
2. Clique em **Instalar motor** com internet e pelo menos 25 GiB livres.
3. Inicie o motor e aguarde aparecer pronto. Outros motores pesados podem precisar ser liberados da RAM.
4. Descreva estilo e instrumentos. Escolha instrumental ou forneça uma letra, ajuste BPM e duração.
5. Comece com **10 segundos**. A faixa gerada fica na biblioteca WAV; recorte e aplique fades para exportar uma nova cópia.

O perfil gerenciado usa Turbo, uma faixa por vez, entre 10 e 120 segundos. Depois de instalado, funciona offline, em loopback com chave interna por sessão. A integração e o armazenamento foram testados por contrato. Uma faixa real de 10 segundos foi gerada e salva no Mac Apple Silicon; outros sistemas e durações ainda precisam de validação.

Uma API ACE-Step já existente pode ser conectada em modo avançado, somente em loopback. Parar o acompanhamento dessa conexão não garante que o processo externo pare de gerar.

## Editor / DaVinci

A aba **Editor** prepara uma montagem com IA dentro do DaVinci Resolve Studio por meio do SDK local. O Resolve e seu SDK não são distribuídos com o LocalNeuron.

1. Abra um projeto no Resolve Studio e importe seus clipes no **Media Pool**.
2. Em **Preferences → System → General**, habilite **External scripting using: Local**.
3. Abra Editor no LocalNeuron, confira a conexão e selecione um modelo de texto instalado.
4. Descreva a montagem. A IA recebe nomes, tipos e durações dos primeiros 40 itens, não o conteúdo visual/sonoro dos vídeos.
5. Revise a proposta, os frames de início/fim e o nome da timeline.
6. Aplique para criar uma **nova timeline**. Revise e salve o projeto no Resolve.

O fim de cada trecho é exclusivo: início 0 e fim 24 representam 24 frames. Projetos alterados após a proposta invalidam o plano para evitar aplicar cortes no material errado. Se a aplicação falhar parcialmente, revise a timeline nova indicada no erro; a original é preservada.

Nesta versão, o Editor faz montagem por metadados, sem colorização automática, reconhecimento de cenas ou mixagem avançada. A ponte foi validada com SDK simulado; a execução em um Resolve Studio instalado ainda está pendente.

## Minha API

Use **Minha API** para outro aplicativo conversar com um modelo executado neste computador. A máquina anfitriã precisa ficar ligada e com o LocalNeuron desbloqueado.

1. Escolha uma IA e gere uma chave própria para cada cliente.
2. Selecione acesso somente local ou rede privada confiável/VPN.
3. Copie a URL base e o nome do modelo mostrados no painel. Cole a chave somente no cliente autorizado.
4. Configure o cliente para **OpenAI-compatible / Chat Completions**. Ajuste cotas e revogue chaves quando necessário.

A API compartilhada oferece texto e streaming; não expõe o painel, conversas, terminal ou arquivos e não implementa toda a API OpenAI. Ela usa um servidor separado, porta padrão 4320. Ao bloquear ou fechar o app, o compartilhamento é desligado.

O transporte é HTTP. Use uma rede privada confiável ou VPN. Não encaminhe a porta diretamente no roteador. Nunca coloque uma chave real em um issue, README ou formulário público.

## Rede EXO

EXO divide modelos de texto compatíveis entre computadores. Controlar um EXO existente é diferente de participar como nó: o controlador, sozinho, não acrescenta sua RAM à rede.

1. Em dois Macs compatíveis, abra **Rede EXO → Instalar motor EXO**.
2. Use a mesma versão e a mesma **Identificação da rede** nos dois.
3. Clique em **Iniciar neste Mac** e autorize a rede local no sistema, se solicitado.
4. Confira os nós descobertos e escolha os computadores ou a seleção automática.
5. Escolha um modelo do catálogo EXO e clique em **Preparar na rede**. Aguarde a instância ficar pronta antes de conversar.

Para apenas controlar, informe o endereço privado do EXO em **Controlar um EXO existente**. Windows pode usar esse modo; não há nó nativo Windows instalado pelo LocalNeuron. No Linux, instale o EXO conforme o projeto oficial.

A identificação da rede é um namespace, **não uma senha**. A API upstream não usa a autenticação do LocalNeuron. Use somente rede privada confiável. Mais RAM não garante mais velocidade; a interconexão entre máquinas influencia muito.

**Liberar modelo** afeta a instância compartilhada. **Desconectar** encerra apenas o processo gerenciado pelo app. Fechar um nó pode interromper a geração distribuída. A validação com duas máquinas físicas ainda está pendente.

## Conexões MCP

MCP permite que a IA use ferramentas expostas por um servidor compatível, como acesso autorizado a documentos ou serviços.

Adicione o servidor HTTP/stdio em **Conexões**, configure a autenticação exigida, teste e selecione quais bots podem usá-lo. Tokens ficam no cofre. OAuth com PKCE depende do suporte do servidor, cadastro do cliente e sua autorização no provedor.

Uma marca aparecer no catálogo não conecta automaticamente sua conta. Gmail, Drive, Supabase, Vercel e outros serviços precisam de servidor MCP compatível e credenciais/autorização válidas. Confira as permissões solicitadas e revogue conexões que não usa. Cada chamada mantém os controles de revisão aplicáveis.

## Pro

O plano Pro organiza recursos avançados de projetos, entregas, fila, revisões e API. O aplicativo valida uma licença assinada e exibe status/validade.

A **cobrança pública ainda não está ativada** nesta alfa. A instalação pública não contém a licença de teste do proprietário. Não há compra pelo GitHub Pages. O download e a execução básica dos modelos locais compatíveis não exigem uma assinatura de provedor de IA.

Pro não muda os pesos do modelo nem torna qualquer IA automaticamente mais inteligente. Os ganhos vêm das ferramentas e da organização do trabalho. A disponibilidade comercial depende da configuração e homologação do serviço de assinatura.

## Dados e backup

A senha protege os segredos do cofre, mas **as conversas não são todas cifradas por ela**. Proteja também seu usuário do sistema e disco.

Novas instalações usam as pastas de dados do sistema:

- macOS: `~/Library/Application Support/Colmeia/`
- Windows: `%APPDATA%/Colmeia/`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/Colmeia/`

Instalações antigas podem manter a pasta irmã `Colmeia-data/`. O nome legado é preservado para compatibilidade. Em desenvolvimento, o serviço usa `.data/` e o desktop `.desktop/`.

Para backup completo, feche o app e copie a pasta inteira. O backup somente do cofre não inclui conversas, projetos e modelos. Use a exportação de conversas e de projetos quando quiser compartilhar um trabalho específico. Não publique sua pasta de dados no GitHub.

## Solução de problemas

### O app só oferece criar senha

Confira se abriu a instalação correta e selecionou a pasta de dados existente. O primeiro uso de uma pasta vazia cria um novo espaço. Não apague o espaço antigo nem redefina a senha para tentar localizar seus dados.

### O modelo não baixa ou exige conta

Confira a conexão, espaço livre e licença. Alguns repositórios exigem aceitar os termos e autenticar no Hugging Face. Repositórios removidos ou alterados podem precisar de uma atualização do catálogo. Um erro de hash deve impedir o uso do arquivo; tente baixar novamente.

### Falta memória ou a geração está lenta

Libere motores ociosos, feche outros aplicativos pesados e reduza contexto, tamanho do modelo, resolução ou duração. A estimativa de RAM não é um benchmark. CPU, GPU, largura de banda e processos em segundo plano influenciam.

### EXO não encontra a outra máquina

Confira versão, identificação da rede, IPs privados, rede local e permissões do sistema. Verifique a API do EXO e se o outro nó está ativo. Não exponha a API à internet para tentar resolver descoberta local.

### O Editor não conecta

Confirme Resolve Studio aberto, projeto carregado, SDK instalado e scripting local habilitado. No Windows/Linux, confira Python 3. A versão gratuita ou configurações incompatíveis podem não oferecer a integração necessária.

### O microfone não funciona

Autorize o microfone no sistema, escolha a entrada correta e confira o modelo de transcrição. A gravação vira rascunho para revisão antes do envio.

### Preciso reportar um erro

Abra um issue com versão do app, sistema, modelo/motor, passos e mensagem de erro. Remova senhas, tokens, dados pessoais e prompts privados. Vulnerabilidades com conteúdo sensível não devem ser publicadas em issues abertos.
