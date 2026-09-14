# Estúdio criativo · LocalNeuron 0.26

## Editor / DaVinci Resolve Studio

A aba Editor conecta o SDK Python local da Blackmagic. Abra um projeto no Resolve Studio, habilite **Preferences → System → General → External scripting using: Local** e importe os arquivos no Media Pool. O Python incluído no Mac Apple Silicon é usado automaticamente; Windows/Linux precisam de Python 3 disponível.

A IA de texto instalada recebe nomes, tipos e durações em frames dos primeiros 40 itens do Media Pool (o diagnóstico lista até 500). Gera até 80 trechos, validados no servidor. A interface permite revisar início, fim exclusivo e nome da timeline antes de aplicar. A ponte executa operações fixas do SDK, sem executar código produzido pelo modelo. Uma timeline nova é criada; a original não é alterada. Mudanças no projeto/Media Pool/timeline atual invalidam o plano. Falhas parciais identificam a nova timeline para revisão, sem apagar dados.

Escopo atual: montagem de cortes por metadados. Não analisa o conteúdo audiovisual, não implementa colorização automática, efeitos ou mixagem avançada. Salve o projeto no Resolve após revisar. A execução real requer Resolve Studio instalado; os testes de contrato usam um SDK simulado.

## Música / ACE-Step 1.5

O botão de instalação prepara Python 3.11, dependências fixadas pelo uv.lock e pesos em uma pasta privada `local-engines/ace-step-1.5`. O instalador precisa de internet e 25 GiB livres. macOS Apple Silicon usa Python de bootstrap incluído; outras plataformas precisam de Python 3 com pip. O motor é aberto, não precisa de assinatura de serviço de IA. A instalação do ACE-Step tem requisitos próprios de GPU/driver em Windows/Linux.

Código: ACE-Step/ACE-Step-1.5, revisão `ca1e85fe9430179831e6bc6be790c332190a3866`, ZIP SHA-256 `108e45dffc7eb62af98d781c4159aa63a2b7a241186734e3e065279da7fc198d`. Bootstrap uv `0.12.13`.

Pesos: ACE-Step/Ace-Step1.5, revisão `19671f406d603126926c1b7e2adc169acbcade22`: Turbo, Qwen3-Embedding-0.6B e VAE, aproximadamente 6,32 GB mais arquivos auxiliares e dependências. O perfil não baixa nem carrega o LM opcional. O wrapper reduz a verificação de componentes do upstream aos três componentes realmente necessários ao modo sem LM.

O motor gerenciado escuta apenas 127.0.0.1:4326, usa chave aleatória por sessão, desativa telemetria/Hugging Face online e bloqueia conexões Python para fora do loopback. Depois de instalado, não precisa de internet para gerar. Falta de pesos produz erro, não um resultado simulado. Chaves do ambiente do aplicativo não são repassadas ao motor.

Gera uma música por vez, 10–120 segundos, 8 passos Turbo, instrumental ou letra fornecida pelo usuário. A API é consultada até finalizar; somente o WAV retornado pelo mesmo servidor é aceito e salvo. Arquivos permanecem na biblioteca local. Recorte e fade são aplicados no navegador e exportam outro WAV, preservando o original.

Uma API ACE-Step local existente pode ser conectada em modo avançado. Ela deve escutar em localhost sem autenticação própria; o modo gerenciado usa autenticação interna. Parar uma conexão externa interrompe o acompanhamento, mas não garante que o outro processo interrompa sua geração. O motor gerenciado é encerrado junto com seus subprocessos.

Fontes oficiais: https://github.com/ACE-Step/ACE-Step-1.5 e docs/en/API.md na mesma revisão. As licenças do código e dos pesos acompanham o projeto original.

## Personalidade

Preferências → **Usar a personalidade LocalNeuron**. Desligado por padrão; persistido no estado assinado do espaço. Afeta respostas seguintes. Instruções, memória e permissões dos bots são preservadas. Dados técnicos do motor continuam disponíveis quando relevantes, sem transformar o nome do aplicativo na identidade da IA.

Validação adicional 0.26: pesos Turbo, Qwen3-Embedding e VAE conferidos integralmente por SHA-256. Motor ACE-Step iniciado no Mac Apple Silicon, inventário autenticado consultado, geração real de 10 segundos concluída e WAV salvo na biblioteca; processo gerenciado encerrado após o teste. Não representa validação nativa em Windows/Linux.
