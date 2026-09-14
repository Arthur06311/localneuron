# API administrativa local v1 — 0.4

Um espaço e um responsável por processo. A organização nunca vem de um campo do corpo. Não há isolamento multiempresa implementado; não exponha o listener fora do loopback.

Autenticação: `Authorization: Bearer <token de session.json>` ou cookie da sessão. Chamadas no navegador também exigem origem correspondente ao serviço. O cofre deve estar desbloqueado para dados e mutações. Abertura usa o token no fragmento, troca por cookie HttpOnly e remove o fragmento do endereço.

| Método | Rota | Corpo / resultado |
|---|---|---|
| POST | `/v1/session` | Troca o token por cookie; não abre o cofre |
| GET | `/v1/status` | Configurado / bloqueado |
| POST | `/v1/setup` | `{password}` mínimo 12 caracteres |
| POST | `/v1/unlock` | `{password}`; limitação de tentativas |
| POST | `/v1/lock` | Pausa tentativas ativas e bloqueia chaves |
| GET | `/v1/workspace` | Projeção autenticada: identidades, fluxos, tarefas, orçamento e fingerprint |
| GET | `/v1/models` | Disponibilidade do endpoint local e modelos informados por ele |
| POST | `/v1/tasks` | `title, brief, requirements[], duration_seconds, workflow_id, mode, model, budget_minor` |
| POST | `/v1/tasks/:id/start` | Autoriza e inicia uma tentativa; retorna antes de acabar |
| POST | `/v1/tasks/:id/pause` | Revoga a tentativa atual e preserva versões |
| POST | `/v1/tasks/:id/cancel` | Cancela sem apagar histórico |
| POST | `/v1/tasks/:id/edit` | `{body, expected_hash}` |
| POST | `/v1/tasks/:id/restore` | `{version_id, expected_hash}`; cria nova versão |
| POST | `/v1/tasks/:id/review` | `{expected_hash, checks[]}`; assina aceite humano |
| GET | `/v1/tasks/:id/download` | Markdown da última versão |
| POST | `/v1/agents/agent/revoke` | Revogação permanente da identidade de agente |
| POST | `/v1/workflows` | `{source}` YAML fechado, nova versão imutável |
| GET | `/v1/log?from=0` | Eventos após sequência indicada |
| GET | `/v1/log/export` | Pacote sem payloads, com manifesto assinado |
| POST | `/v1/log/verify` | `{bundle, trusted_fingerprint}` |
| GET | `/v1/vault/backup` | Cofre cifrado, sem conteúdo dos documentos |

`Idempotency-Key` é obrigatória em criar, iniciar, editar, restaurar e validar. Formato: 8–100 caracteres alfanuméricos, `_` ou `-`. A chave fica vinculada à operação e ao hash do corpo; repetição idêntica não repete efeitos. Reuso com outro conteúdo retorna conflito. Ações de pausa/revogação são tratadas como mudanças de estado; não são um contrato geral de idempotência para todos os POSTs.

Respostas de erro têm `{error}`. 401 sem sessão, 403 Host/Origin rejeitado, 423 cofre bloqueado, 409 conflito de versão/idempotência, 400 validação/regra recusada. Não há endpoint público para anexar log ou elevar orçamento.

## Biblioteca de modelos (0.2)

Todas as rotas exigem sessão autenticada e cofre desbloqueado. Corpos são objetos fechados; não aceitam URL, shell ou caminho fornecido pelo cliente.

| Método / rota | Corpo / finalidade |
|---|---|
| GET /v1/model-library | Catálogo, memória, disco, biblioteca e progresso |
| POST /v1/model-library/engine | `{}` — conectar LM Studio local |
| POST /v1/model-library/download | `{ "id": "qwen3-mini" }` — catálogo fixo |
| POST /v1/model-library/cancel | `{ "id": "qwen3-mini" }` — abortar transferência |
| POST /v1/model-library/install | `{ "id": "qwen3-mini" }` — conferir hash e importar |
| POST /v1/model-library/load | `{ "key": "chave retornada pelo motor" }` |
| POST /v1/model-library/unload | `{ "instance": "instância carregada" }` |

Downloads têm deduplicação por modelo enquanto ativos ou já baixados; instâncias carregadas são reaproveitadas. O gerenciador não promete semântica de transação distribuída com LM Studio. Após falha de importação ou reinício, reconcilia a indexação ao tentar novamente. Não há resume HTTP de parciais. Carregamento, descarregamento, início de entrega e bloqueio usam uma fila local para evitar corrida; downloads têm sua própria operação cancelável.


## Chat local (0.4)

Todas as rotas exigem sessão válida e cofre desbloqueado. POST usa esquema fechado.

- `GET /v1/chats`: conversas e mensagens; inclui trechos em andamento da memória do serviço.
- `POST /v1/chats`, corpo `{}` e Idempotency-Key: cria conversa vazia.
- `POST /v1/chats/:id/send`, corpo `{model, content, options?, retry?}` e Idempotency-Key: agenda resposta da instância local. Conteúdo de 1 a 131.072 caracteres, conversa de até 8 MiB serializados e 2.000 mensagens. A janela enviada à IA é limitada separadamente pelo contexto. Um job por vez. Retorna id da conversa e da resposta.
- `POST /v1/chats/:id/stop`, corpo `{}`: cancela e aguarda o job.

Mensagens têm papel user/assistant e status pending/complete/stopped/error. Falhas preservam a pergunta e eventual trecho parcial. Reenvio da mesma chave não cria outra mensagem ou inferência. Mensagens completas anteriores são contexto; trechos interrompidos não são reutilizados como respostas concluídas. O renderer mostra Markdown sanitizado por DOMPurify, com blocos de código copiáveis e sem execução de HTML recebido. Bloquear e fechar aguardam cancelamento dos jobs. O envio não concede ferramentas ao modelo e não usa o fluxo editorial avançado.


A interface não oferece mais tarefas ou fluxos. As rotas legadas acima preservam compatibilidade com dados antigos.

- `POST /v1/chats/:id/rename`: `{title}`, até 100 caracteres.
- `DELETE /v1/chats/:id`: exclui a conversa da projeção; não é apagamento físico de backups/WAL.
- `GET /v1/resources`: memória disponível/total, pressão e estado de geração, consultado pela UI a cada 3 segundos.
- `GET /v1/sharing`: estado, endereços privados disponíveis, prefixo de chave e contadores. Nunca devolve a chave completa persistida.
- `POST /v1/sharing/key`: `{}`; gera/substitui chave, retornada integralmente só nessa resposta.
- `POST /v1/sharing/start`: `{key, host, trusted_network?, options?}`. `key` aqui é a chave do modelo instalado, não o token de acesso. Host privado requer `trusted_network: true`.
- `POST /v1/sharing/stop` e `/v1/sharing/revoke`: `{}`; desliga, ou também revoga a chave.

Opções do chat: contexto 2.048–131.072 (padrão 16.384), max_tokens 1–32.768 (padrão 8.192 e no máximo metade do contexto efetivo), temperature 0–2, top_p 0,01–1, reasoning auto/off/low/medium/high, system até 16.000 caracteres. A memória de contexto é estimada; turnos antigos completos são omitidos quando necessário, com contador na resposta. `retry: true` regenera a última resposta, mantendo até 20 versões e sem duplicar a pergunta. Estatísticas incluem duração, tokens quando informados pelo motor, contexto e motivo de término.

O carregamento aceita `{key, context?}`. A configuração efetiva devolvida pelo LM Studio pode ser maior que a solicitada.

A API para outro aplicativo é um listener **separado**, com chave própria, por padrão na porta 4320. Não fornece rotas administrativas. Consulte [Minha API](minha-api.md) para endpoints compatíveis, autenticação, cancelamento e limites.


## Assistente 0.5

`POST /v1/chats/:id/send` aceita `access`: `{enabled,web,computer,files,terminal,format}`; padrão habilita assistente, web e computador, com arquivos/terminal desligados e formato native. Alternativa de formato: json. Esses valores são capturados por mensagem, sem conceder acesso à API compartilhada.

- `GET /v1/assistant`: pasta escolhida e revisões pendentes.
- `POST /v1/assistant/folder`: `{folder:string|null}`, recusado enquanto há geração. O modelo não pode escolher essa pasta.
- `POST /v1/assistant/approve`: `{id:uuid,allow:boolean}` para uma proposta concreta pendente, com expiração e cancelamento.
- `GET /v1/assistant/artifacts/:id`: download de cópia de texto criada/preservada pela ferramenta, com hash conferido.

Atividades das ferramentas ficam na mensagem assinada e incluem estado, descrição e referências dos arquivos exportados. O conteúdo bruto de raciocínio não é exposto. IDs de modelos integrados começam com `gguf:`; a biblioteca carrega esses arquivos no runtime próprio. Todas essas rotas administrativas mantêm autenticação local, cofre, Host e Origin.


### MLX (0.6)

`GET /v1/model-library` informa mlx_available e modelos com chave mlx:. `POST /v1/model-library/import-mlx` recebe `{"folder":"/caminho/absoluto"}` e copia os arquivos necessários para a pasta de modelos da Colmeia. Requer sessão local, cofre aberto e ausência de operação concorrente. Carga/descarga e Minha API aceitam chaves mlx: pelo mesmo contrato dos modelos integrados. Esse endpoint não fica disponível na API compartilhada.
