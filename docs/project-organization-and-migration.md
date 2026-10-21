# Organização do projeto e plano de migração

**Projeto:** LocalNeuron  
**Estado atual:** alfa 0.27.0  
**Objetivo deste documento:** deixar claro o que existe, onde cada parte mora, como o aplicativo inicia, o que pode ser migrado e o que precisa ser recriado no destino.

> Neste relatório, interpretei “migrar para o recebidor” como preparar o projeto para outro repositório, outra máquina ou um servidor de destino. O LocalNeuron foi construído primeiro como aplicativo local; uma migração para servidor central exige decisões adicionais de autenticação, banco, filas e isolamento.

## 1. Resultado da organização

A organização foi feita sem mover os arquivos de código. Isso é intencional: os imports TypeScript, os caminhos do Electron, os scripts de empacotamento e os dados das versões anteriores dependem dos diretórios atuais.

O que foi acrescentado nesta revisão:

- `docs/README.md`, um índice para encontrar a documentação por assunto.
- Este relatório, com o mapa técnico, a estratégia de migração e a lista de pendências.
- Links para o índice e o relatório no README principal.

A navegação da interface também já está organizada em cinco ilhas, implementadas em `public/index.html`, `public/navigation.css` e `public/app.js`:

| Ilha | Páginas |
|---|---|
| Trabalhar | Chat, Minha equipe, Modelos |
| Equipes | Equipes |
| Criar | Imagem, Vídeo, Música, Editor |
| Conectar | Conexões, Rede EXO, Minha API |
| Conta | Central Pro, Meu plano, Configuração guiada, Configurações |

## 2. Mapa de diretórios

| Diretório | Responsabilidade | Entra no Git? | Vai para o usuário/servidor? |
|---|---|---:|---:|
| `src/` | Serviço local TypeScript, contratos, persistência, motores, APIs e regras de produto | Sim | Compilado para `dist/` |
| `desktop/` | Processo principal Electron, preload, permissões, controle local, música e ponte do DaVinci | Sim | Sim, dentro do pacote desktop |
| `public/` | Interface do aplicativo: HTML, CSS, JavaScript, ícones e mascote | Sim | Sim |
| `runtime/` | Manifestos e protocolos dos runtimes; pesos e binários grandes ficam fora do Git | Sim, manifestos | Runtimes são baixados/preparados por plataforma |
| `scripts/` | Catálogo de release, download de runtime, verificação, empacotamento e publicação | Sim | Usado no CI e na máquina de release |
| `tests/` | Testes TypeScript, JavaScript, Python e fixtures | Sim | Não é necessário no instalador |
| `docs/` | Guias atuais, histórico de versões, operação e publicação | Sim | Publicado como referência |
| `website/` | Pasta vazia de propósito. O site público vive na branch `gh-pages` | Sim, só o README | Não. O site publicado é a branch `gh-pages` |
| `catalog/` | Catálogo de downloads e feed de atualização conferido no CI | Sim | O feed que o app lê é `gh-pages/releases.json` |
| `releases/` | Artefatos locais de release e checksums | Parcial; assets grandes não devem ser commitados | GitHub Releases |
| `licenses/` | Licenças e avisos de componentes distribuídos | Sim | Sim |
| `dist/` | Saída do TypeScript | Não; gerado por `npm run build` | Sim, no pacote de execução |
| `.data/`, `.desktop/`, `models/`, `local-engines/` | Dados do usuário, banco, cofre, arquivos e modelos baixados | Não | Copiados apenas em uma migração de dados autorizada |

O `.gitignore` já exclui segredos, bancos, modelos, logs, builds e runtimes específicos da plataforma. Isso evita enviar conversas, tokens, pesos de modelos ou chaves privadas para o repositório.

## 3. Como o aplicativo funciona

### Execução no navegador local

1. `npm run build` compila `src/**/*.ts` para `dist/`.
2. `npm start` executa `dist/src/server.js`.
3. O servidor Fastify prefere `127.0.0.1:4317`. Se a porta estiver ocupada, usa a próxima livre e grava a URL real em `session.json`.
4. `scripts/open.mjs` lê a sessão local e abre a interface autenticada.
5. `src/server.ts` serve `public/`, valida as requisições e conecta os módulos de domínio.

### Execução no Electron

1. `npm run desktop` inicia `desktop/main.cjs`.
2. O processo principal cria uma pasta de dados do desktop e inicia o backend como processo filho.
3. O backend recebe `LOCALNEURON_DATA_DIR` e `LOCALNEURON_PORT`. `COLMEIA_DATA_DIR` e `COLMEIA_PORT` continuam aceitos. O desktop lê a porta real em `session.json` e usa essa origem na janela, no IPC e nas permissões.
4. `desktop/preload.cjs` expõe somente pontes permitidas ao renderer.
5. O renderer carrega a mesma interface de `public/` usada no modo navegador local.

### Núcleo e persistência

- `src/core.ts` controla estado, versões e eventos.
- `src/store.ts` usa PGlite/PostgreSQL embarcado para o espaço local.
- `src/vault.ts` protege chaves e segredos com cofre cifrado.
- `src/lock.ts` impede dois processos usando a mesma pasta.
- `src/types.ts` define os contratos de estado, tarefas, chats, eventos e identidades.
- `src/policy.ts` e `src/agent-tools.ts` limitam ferramentas, permissões e aprovações.

### Inferência e motores

- `src/runtime.ts`: processo de texto integrado, llama.cpp e MLX.
- `src/inference.ts`: opções, contexto, streaming e formato de geração.
- `src/model-library.ts`, `src/catalog.ts` e `src/catalog-access.ts`: catálogo, memória, acesso, downloads, hashes e importação.
- `src/mlx-models.ts`: inspeção e preparação de pastas MLX.
- `src/aux-runtime.ts`, `src/aux-catalog.ts` e `src/media-catalog.ts`: imagem, vídeo e transcrição.
- `src/music.ts` e `desktop/music-server.py`: ACE-Step em ambiente separado.
- `src/pro-media.ts`: voz e recursos de mídia Pro.
- `src/exo.ts` e `src/exo-install.ts`: descoberta, configuração e preparação de rede EXO.

### Chat, bots e ferramentas

- `src/chat.ts` e `src/chat-context.ts`: conversas, anexos, histórico e contexto.
- `src/agent.ts`: ciclo do assistente e personalidade opcional.
- `src/experience.ts`, `src/experience-jobs.ts` e `src/bot-playbooks.ts`: wizard, perfis, bots pessoais/profissionais e salas de colaboração.
- `src/crews.ts`: ilha Equipes. Reusa os bots de Minha equipe (nome, papel, instruções, memória e modelo). As tabelas novas guardam só o vínculo, o mascote, as não lidas, os limites e os provedores.
- `src/web-tools.ts`: pesquisa e leitura web com validação de destino.
- `src/connections.ts`: servidores MCP por HTTP/stdio, OAuth e revogação.
- `src/computer-control.ts` e `desktop/computer.cjs`: controle de computador no desktop, quando habilitado.
- `src/gateway.ts`: Minha API, desligada por padrão e destinada a rede privada.

### Criação, Pro e cobrança

- `src/editor.ts` e `desktop/resolve-bridge.py`: plano de edição e ponte para o DaVinci Resolve Studio.
- `src/pro.ts` e `src/pro-documents.ts`: projetos, tarefas, templates, exportações, backups e diagnósticos Pro.
- `src/subscription.ts`: licença, recursos premium e verificação local.
- `src/billing-service.ts`: serviço separado para Stripe, preços mensal e anual validados em BRL, teste de 7 dias e emissão de licença assinada.
- `subscription-config.json`: configuração pública; não contém chave privada.

### Interface

- `public/index.html`: shell da aplicação e páginas navegáveis.
- `public/app.js`: estado, roteamento, sessão e carregamento dos módulos.
- `public/chat.js`, `public/studio.js`, `public/photo.js`, `public/voice.js`, `public/exo.js`, `public/pro.js` e demais módulos: comportamento de cada área.
- `public/*.css`: estilos base, tema, experiência, estúdio, Pro, acessibilidade e navegação.
- `public/model-identities.js` e `public/model-icons.js`: identificação editorial e ícones dos modelos.
- `public/mascot*.png`, `public/mascot.js` e `public/mascot.css`: mascote 2D e estados visuais.
- `public/navigation.css`: ilhas de navegação responsivas criadas na última revisão.

## 4. O que já foi implementado

As entregas acumuladas no histórico público do GitHub foram agrupadas abaixo para facilitar a transferência de contexto:

### Produto e experiência

- Onboarding com abertura direta, wizard repetível, perfil e recomendações.
- Chat local com streaming, Markdown, anexos, histórico, ramificações, memória revisável, esforço e internet opcional.
- Bots pessoais e de trabalho, templates por especialidade, tarefas e colaboração entre bots.
- Catálogo amplo com busca Hugging Face, finalidade, licença, RAM estimada, tamanho, revisão e hashes.
- Studio para Photo, Video, Música, voz, transcrição e Editor.
- Mascote 2D com diferentes estados.
- Pro com projetos, fila, modelos, templates, documentos, exportação, backups e diagnóstico.
- Navegação atual por cinco ilhas clicáveis. Equipes reusa os bots de Minha equipe.

### Motores e integrações

- llama.cpp para GGUF e MLX independente para Apple Silicon.
- whisper.cpp para transcrição e a voz do sistema para narração. A voz neural com sherpa-onnx fica para a 2.0.0 sem eSpeak NG ([k2-fsa/sherpa-onnx#3731](https://github.com/k2-fsa/sherpa-onnx/issues/3731)). stable-diffusion.cpp cobre os perfis de mídia e ACE-Step é opcional para música.
- EXO para conectar máquinas compatíveis e preparar execução distribuída.
- Minha API compatível com Chat Completions em rede privada.
- MCP por HTTP/stdio com OAuth quando suportado.
- Controle de computador no desktop com permissões explícitas.
- Ponte de edição para DaVinci Resolve Studio.

### Distribuição e operação

- Site público e guia de configuração no GitHub Pages.
- Domínio `localneuron.ai` preparado por CNAME/DNS.
- Download por plataforma e releases com SHA-256.
- Instalador Linux com preparação, verificação, abertura automática e cancelamento.
- Pacotes nativos Linux DEB e Arch em preparação/publicação conforme a release.
- Fluxo de atualização com manifesto e aviso no app.
- Diagnóstico para o problema do Linux em que o Electron era aberto antes da extração terminar.

## 5. O que deve ser migrado

### Para outro repositório Git

Migrar o histórico e o código-fonte, mantendo:

- `src/`, `desktop/`, `public/`, `runtime/`, `scripts/`, `tests/`, `docs/`, `website/`, `catalog/`, `licenses/`;
- `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `subscription-config.json`;
- workflows e arquivos de release que estiverem no repositório de origem;
- o histórico Git, para preservar decisões, versões e auditoria técnica.

Não migrar pelo Git:

- `.data/`, `.desktop/`, `Colmeia-data/`, `models/`, `local-engines/`, `runtime/*` baixados;
- `.env`, certificados, chaves Stripe, chaves de assinatura e tokens Hugging Face;
- conversas, backups pessoais ou arquivos privados.

### Para outra máquina mantendo o espaço do usuário

1. Feche o aplicativo e confirme que não há servidor ou motor rodando.
2. Faça uma cópia completa da pasta de dados, incluindo banco, cofre, workspace e artefatos.
3. Instale Node.js 24+ apenas se for executar o modo de desenvolvimento; instaladores prontos não precisam dele.
4. Reinstale o pacote para a plataforma correta.
5. Restaure a pasta de dados em um local novo e defina `LOCALNEURON_DESKTOP_DATA_DIR` ou `LOCALNEURON_DATA_DIR` quando necessário. `COLMEIA_DESKTOP_DATA_DIR` e `COLMEIA_DATA_DIR` continuam aceitos.
6. Abra o aplicativo; não copie somente `vault.enc.json` sem o banco correspondente. Instalações antigas com senha pedem essa senha uma única vez.
7. Refaça os downloads de runtime específicos da plataforma e valide os hashes.

### Para um servidor de produção

O código atual não é um serviço multiusuário pronto para ficar exposto diretamente. Antes de migrar para um servidor, é necessário:

- autenticação por usuário e organização, em vez de uma sessão local;
- banco PostgreSQL gerenciado e migrações versionadas;
- armazenamento de objetos para arquivos e modelos;
- fila de jobs e limites por usuário;
- proxy HTTPS, rate limiting, observabilidade e rotação de segredos;
- isolamento de cada execução de modelo e de cada ferramenta MCP;
- política de retenção e exclusão de dados;
- processo de assinatura/notarização e atualização segura dos clientes.

O serviço de cobrança Stripe (`src/billing-service.ts`) deve ficar separado do app local. As variáveis necessárias são `LOCALNEURON_BILLING_DB`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_YEARLY_PRICE_ID`, `LOCALNEURON_LICENSE_PRIVATE_KEY_FILE`, `LOCALNEURON_BILLING_PUBLIC_URL` e `LOCALNEURON_BILLING_TRIAL_HMAC_KEY`. Elas nunca devem entrar no Git ou no bundle do desktop. A chave de HMAC não revela cartão nem e-mail: o banco guarda só o HMAC. A hospedagem prevista é o Fly.io, em `billing.localneuron.ai`; o passo a passo está em [billing-deploy.md](billing-deploy.md).

## 6. Configuração e variáveis importantes

| Variável | Uso | Obrigatória |
|---|---|---:|
| `LOCALNEURON_DATA_DIR` | Dados do servidor local em modo navegador. `COLMEIA_DATA_DIR` continua aceito. | Não; padrão `.data/` |
| `LOCALNEURON_DESKTOP_DATA_DIR` | Dados do Electron. `COLMEIA_DESKTOP_DATA_DIR` continua aceito. | Não; padrão por plataforma |
| `LOCALNEURON_PORT` | Porta preferida do servidor local. Se estiver ocupada, a próxima livre é usada. `COLMEIA_PORT` continua aceito. | Não; padrão `4317` |
| `LOCALNEURON_LMSTUDIO_PORT` | Porta em que o LM Studio é iniciado. A detecção também tenta 1234. Prevalece sobre o nome antigo. | Não; padrão `8080` |
| `COLMEIA_LMSTUDIO_PORT` | Nome antigo da porta do LM Studio. Sozinha, emite um aviso sem mostrar o valor. | Não |
| `LOCALNEURON_TEST_PORT` | Porta do backend do desktop, usada em testes e diagnósticos | Não; padrão `4318` |
| `LOCALNEURON_LICENSE_PUBLIC_KEY` | Chave pública para validar licença | Não; pode vir da configuração pública |
| `LOCALNEURON_BILLING_URL` | URL do serviço de licença | Não no modo local |
| `LOCALNEURON_BILLING_DB` | Banco do serviço de cobrança | Somente billing |
| `STRIPE_SECRET_KEY` | Chave secreta Stripe | Somente billing |
| `STRIPE_WEBHOOK_SECRET` | Assinatura de webhook | Somente billing |
| `STRIPE_MONTHLY_PRICE_ID` | Preço mensal do Pro (BRL 2000) | Somente billing |
| `STRIPE_YEARLY_PRICE_ID` | Preço anual do Pro (BRL 15000) | Somente billing |
| `LOCALNEURON_LICENSE_PRIVATE_KEY_FILE` | Caminho do arquivo PEM da chave privada de licença | Somente billing |
| `LOCALNEURON_BILLING_PUBLIC_URL` | URL pública HTTPS do serviço de cobrança | Somente billing |
| `LOCALNEURON_BILLING_TRIAL_HMAC_KEY` | Segredo do HMAC de cartão e e-mail do teste. Mínimo de 32 caracteres. Não é o valor em claro. | Somente billing |
| `LOCALNEURON_BILLING_HOST` | Endereço de escuta do serviço de cobrança | Não; padrão `127.0.0.1`. No Fly, `0.0.0.0` |
| `LOCALNEURON_BILLING_PORT` | Porta local do serviço de cobrança | Não; padrão `4330` |
| `LOCALNEURON_BILLING_TRUST_PROXY` | `fly` para usar o IP do cabeçalho `Fly-Client-IP` | Não; fora do Fly o padrão é loopback |
| `HF_HOME` / `HF_HUB_CACHE` | Cache Hugging Face | Hoje ignoradas: o motor de música define esses caminhos dentro da própria pasta |

O arquivo [`.env.example`](../.env.example) lista essas variáveis com valores de exemplo. O app não lê `.env` automaticamente: exporte as variáveis no shell, no gerenciador de serviços ou no cofre de segredos do servidor.

Os nomes `COLMEIA_*` são compatibilidade histórica e continuam aceitos. Para cada um existe o alias `LOCALNEURON_*`, que prevalece se os dois estiverem definidos. Quando só o nome antigo está definido, o processo emite um aviso por variável e não mostra o valor. As pastas de dados não mudam de lugar.

## 7. Comandos de desenvolvimento e release

```sh
npm ci                         # instala dependências fixadas
npm run build                  # compila TypeScript
npm test                       # build + testes TypeScript/JavaScript
python3 tests/resolve_bridge_test.py
node scripts/verify.mjs        # verifica artefatos e configuração
npm start                      # servidor local em 127.0.0.1:4317
node scripts/open.mjs          # abre uma sessão local autenticada
npm run desktop                # app Electron
npm run package                # build e pacote desktop
# O site público muda por pull request contra a branch gh-pages.
# website/ em main só tem o README. O catálogo fica em catalog/.
```

Os pesos de modelos, runtimes e caches não devem ser incluídos no clone. Use os scripts `fetch-runtime.py`, `fetch-mlx.py` e `fetch-tools.py` com o alvo da plataforma. A narração não tem runtime próprio: usa a voz do sistema.

## 8. Estado de validação e riscos

Revalidação em 18/10/2026, sobre o commit `e5694ac` de `main` (a revisão da navegação é o commit anterior, `be40fb1`), com Node.js 24.22.0 em Linux x64:

- `npm run build` passou.
- `npm test` executa **153 testes** na main anterior a esta junção: 131 da suíte TypeScript compilada (`dist/tests/*.test.js`) e 22 testes JavaScript (`tests/*.test.mjs`: estúdio 6, site 5, navegação 2, ícones de modelos 2, acesso local 2, alias de ambiente 4 e arquivos estáticos 1). A revalidação de 18/10/2026 contou 143; o quinto teste do site confere a versão visível com `package.json`.
- A suíte compilada do backend passou com **127 de 127** testes.
- A narração pela voz do sistema acrescenta 8 testes em `tests/system-tts.test.ts`. Juntando essa narração à main `a34917e` (0.28.0), `npm test` reúne **182 testes**: 148 TypeScript e 34 JavaScript.
- Os cinco scripts Python de `tests/` (`resolve_bridge_test.py`, `mlx_protocol_test.py`, `linux_installer_test.py`, `linux_gui_installer_test.py` e `linux_native_package_test.py`) passaram. Eles não fazem parte do `npm test`.
- A correção do PR #6 (commit `708cede`, já em `main`) faz o mock de `tests/local-access.test.mjs` implementar `safeStorage.getSelectedStorageBackend()`. Antes disso, os 2 testes falhavam no Linux, porque `desktop/local-access.cjs` só chama esse método quando `process.platform === 'linux'`.
- O teste “Gerenciador só carrega chaves instaladas, contexto curto e descarrega instâncias conhecidas” (`tests/library.test.ts`) depende da memória livre da máquina. Ele falhou em 1 de 2 execuções com “Memória disponível insuficiente”.
- O workflow ativo `.github/workflows/ci.yml` roda `npm test` em macOS, Windows e Linux, além de `npm ci`, `npm run build`, os testes Python e `node scripts/verify.mjs`. `desktop-diagnosis.yml` continua em `.github/workflows/`. Os arquivos `ci.yml`, `desktop.yml` e `pages.yml` em `.github/workflow-templates/` seguem como modelos e não são os workflows em execução.

Ainda precisam de validação em máquinas físicas antes de chamar o produto de pronto para consumo geral:

1. execução nativa completa em Windows e Linux, incluindo motores e GPU;
2. duas máquinas físicas no EXO — roteiro manual em [docs/testes/exo-2-macs.md](testes/exo-2-macs.md);
3. notarização e atualização assinada no macOS;
4. instalação real e edição no DaVinci Resolve Studio;
5. cobrança Stripe em ambiente de produção com webhook real;
6. recuperação de backup real e migração de uma instalação existente;
7. revisão visual em monitores pequenos e acessibilidade com leitor de tela.

O principal risco de uma migração para servidor é tratar um aplicativo local com dados e motores locais como se fosse um backend multiusuário. A separação correta é: o repositório guarda código e manifestos; o desktop guarda dados e motores; o site público guarda apenas informação; o billing guarda licenças e pagamentos; e um futuro servidor precisa de isolamento próprio.

## 9. Checklist de transferência

- [ ] Confirmar o destino: outro Git remoto, outra máquina ou servidor multiusuário.
- [ ] Fazer backup do repositório e preservar o histórico Git.
- [ ] Configurar Node.js 24+, Python 3 e dependências de sistema no destino.
- [ ] Copiar apenas dados autorizados e manter segredos fora do Git.
- [ ] Recriar `.env` a partir de um cofre de segredos, nunca de um commit.
- [ ] Executar `npm ci`, `npm run build`, `npm test` e os testes Python.
- [ ] Preparar runtimes para a plataforma do destino.
- [ ] Validar o modo de inicialização escolhido: navegador, Electron ou serviço.
- [ ] Verificar portas, firewall, HTTPS e rede privada antes de habilitar Minha API/EXO.
- [ ] Publicar releases com hashes e confirmar os downloads no site.
- [ ] Registrar a nova versão, limitações e evidências no relatório de release.

## 10. Próxima melhoria recomendada

Antes de uma migração para servidor, eu priorizaria três entregas: um sistema de migrações de dados versionado, a manutenção do `.env.example` junto com o código e uma pipeline CI que rode build, testes e verificação de artefatos em cada pull request. Isso reduz o risco de levar uma versão incompleta, um banco incompatível ou uma configuração secreta para o destino.
