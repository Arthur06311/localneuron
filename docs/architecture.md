# Atualização 0.5: execução e ferramentas

`runtime.ts` gerencia processo llama.cpp incluído, inventário GGUF, contexto, memória e encerramento. `agent.ts` conduz rodadas de inferência/ferramenta, usando `inference.ts` para streaming e papéis. `agent-tools.ts` impõe acesso, pasta, revisão e execução; `web-tools.ts` busca e lê páginas públicas com validação DNS e conexão fixada. O renderer exibe as atividades e propostas. O preload Electron expõe somente o seletor de pasta, com validação de origem/frame no processo principal.

O Gateway injeta o backend de inferência correto e continua sem ferramentas. O motor próprio tem porta efêmera e chave de processo independente; nem uma nem outra são fornecidas ao modelo. A integração LM Studio anterior continua disponível. Guias completos em `motor-e-assistente.md`.

# Arquitetura da Alfa 0.5

A navegação atual contém Chat, Modelos, Minha API e Preferências. `model-library.ts` gerencia download verificado, importação e memória. `chat.ts` persiste conversas e delega inferência a `inference.ts`, que envia mensagens com papéis ao LM Studio em loopback. `gateway.ts` oferece somente inferência em listener separado, sob chave própria e host privado escolhido. A API inicia desligada e é encerrada ao bloquear, fechar ou revogar. Uma operação de geração por vez evita disputa entre chat e API.

O renderer sanitiza Markdown e nunca executa código recebido. O Electron permite escrita no clipboard somente à origem local principal; leitura, mídia e outras permissões continuam negadas. Downloads de exportações Blob da própria origem são permitidos.

O estado assinado usa números inteiros canônicos. Parâmetros com decimais são persistidos em `options_json`, validados antes da geração. Estatísticas são inteiros; chaves completas de compartilhamento não são persistidas, apenas SHA-256 e prefixo. O gateway não grava mensagens dos clientes no histórico.

A estrutura editorial abaixo permanece no backend para compatibilidade com os dados anteriores, sem aparecer na navegação atual.


```
Interface local / Electron
        │ sessão local autenticada, sem segredo no modelo
Fastify + contratos Zod
        │
Core ─── Juiz determinístico ─── autorização humana Ed25519
 │                 │
 │          Modelo local :8080 / estrutura manual
 │                 │ texto não confiável, sem tool calling
 │          validação e commit transacional
 │
PGlite (PostgreSQL embarcado)
 ├─ workspace_state: JSONB com contratos, versões, aprovações e orçamento
 └─ event_log: append-only, ordenado por seq
        │
Exportação → verificador independente + fingerprint confiável
```

O estado e a cadeia são confirmados na mesma transação. Uma fila de promessas serializa transações; uma trava por PID impede dois servidores na mesma pasta. O banco local contém uma projeção JSONB de espaço único. É uma escolha provisória de Alfa, não o esquema relacional multiempresa final da seção 8. O custo de leitura e assinatura cresce com o tamanho do estado/log; não há alegação de escalabilidade ou p95 de produção.

## Fronteiras

O modelo nunca recebe senha, chave privada, token de sessão, acesso a API administrativa ou shell. Briefing entra como dado em uma mensagem separada. Mesmo uma resposta que peça uma chamada de ferramenta não é executada: o controlador conhece apenas a sequência validada no YAML.

Antes de iniciar uma tentativa, o humano autoriza três ações cujos hashes incluem contrato, ferramenta e geração. A aprovação inclui humano, agente, espaço, tarefa, época, validade e assinatura. As ações de agente no log carregam essa cossinatura. Antes do commit, o Juiz reavalia a autorização e a revogação. Uma tentativa antiga não pode confirmar resultado em uma nova geração.

O controlador confiável assina em nome do humano após sua ação autenticada. As chaves de humano, agente e organização compartilham o processo desbloqueado. Isso **não equivale** a uma assinatura humana isolada por hardware ou à proteção contra comprometimento do processo controlador. Um invasor com chaves desbloqueadas pode forjar autoria. A revisão externa e a custódia separada previstas no plano continuam necessárias.

## Persistência e privacidade

As chaves ficam em `vault.enc.json`, AES-256-GCM com chave derivada por scrypt e salt aleatório. O arquivo tem modo 0600 e a pasta é criada em 0700. O cofre fica bloqueado após reinício. Senha não aparece em logs nem na exportação. Não há recuperação administrativa nem integração safeStorage/Keychain implementada.

Briefings, versões e saídas ficam no PostgreSQL local sem criptografia de aplicação. Para proteção em repouso do dispositivo, a Alfa depende da proteção do sistema/volume. Isso é exibido no onboarding. A exclusão de conversa remove a projeção ativa, sem prometer apagamento físico de backups ou WAL; a política jurídica de retenção ainda deve ser definida.

O log guarda hashes/referências, não conteúdo. A projeção e a cadeia têm também um selo assinado da organização, validado antes de mutações e leituras desbloqueadas. Assim adulteração direta de estado não é transformada silenciosamente em uma nova exportação confiável.

## Dinheiro

Todas as rotas de produto custam zero externamente. Há reserva antes da geração e liquidação depois. As funções de orçamento usam inteiros, idempotência, transação serial e limites de tarefa/fluxo/agente. São testadas com valores não nulos em fixtures; não há endpoint de cobrança ou de alteração de teto pelo agente. Falha local libera reservas. Para provedores externos, liberação automática após resposta incerta precisa ser substituída por conciliação; essa rota ainda não existe.

## Referências técnicas consultadas

- [Node.js — Crypto](https://nodejs.org/api/crypto.html): primitivas Ed25519, assinatura/verificação e criptografia do cofre.
- [Fastify — Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/): contratos HTTP; a validação fechada do corpo aqui usa Zod nos handlers.
- [PGlite — documentação](https://pglite.dev/docs/): PostgreSQL embarcado para o recorte local.
- [Electron — Security](https://www.electronjs.org/docs/latest/tutorial/security): renderer isolado, sandbox, permissões negadas e navegação restrita.
- [llama.cpp — servidor](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md): interface local de modelos e geração.

As referências competitivas do planejamento não foram tratadas como biblioteca homologada. Não foi copiado código de Buzz/Bionic.


## MLX independente (0.6)

LocalRuntime gerencia um único processo integrado por vez (llama.cpp ou MLX). MLX usa Python portátil e MLX LM oficial, com servidor HTTP próprio em runtime/mlx_server.py. O processo recebe caminho local, chave em arquivo e limites; não aceita novos caminhos por requisição. O sandbox do macOS bloqueia conexões de saída. Parser nativo do tokenizer separa raciocínio, texto e ferramentas; ausência de parser escolhe JSON na camada de agente. O gerenciador copia modelos via mlx-models.ts sem executar código remoto. O empacotamento contém dependências fixadas no manifesto; dados e pesos ficam fora do bundle.
