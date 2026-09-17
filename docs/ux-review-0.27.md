# Revisão de UX/UI — 0.27

Problemas relatados: senha em toda abertura, wizard repetido, equipe difícil de ativar, bots sem tarefa concreta e versões novas sem aviso.

## Correções verificadas

| Fluxo | Causa / mudança | Evidência |
|---|---|---|
| Wizard | O passo final aparecia antes de salvar a conclusão; patches parciais podiam sobrescrever o perfil com padrões. | Testes de persistência após reabrir o banco, perfil parcial, reconfiguração e preservação de bots. |
| Acesso | A proteção do sistema exigia clique a cada abertura e não havia adesão para quem já usava senha. | Testes de armazenamento cifrado simulado, senha errada, adesão explícita, reinício, desativação e bloqueio manual. |
| Equipe | Bots podiam existir sem modelo; fluxo exigia configuração individual. | Ativação real de dez bots no espaço fictício, sem duplicação ao repetir; regras de preservação testadas. |
| Tarefas | Especialidades tinham instruções genéricas e nenhum início direto de trabalho. | Marketing iniciou conversa e produziu um rascunho usando Qwen3 0.6B local. Não houve envio nem publicação externa. |
| Contexto | Reserva de saída excessiva recusava tarefas curtas em contexto pequeno. | Teste mantém instruções e último turno, reduzindo a reserva de saída. |
| Atualizações | Não havia descoberta de versões no app. | Cache, desativação, dispensa por versão, falha offline e validação de URLs testados; banner e dispensa conferidos com manifesto fictício. Consulta real ao manifesto público funcionou. |
| Interface | Ações principais dispersas. | Equipes separadas por área, estado da IA e sugestões de tarefa. Navegador em modos claro/escuro; largura 390 px sem rolagem horizontal. Sem erros JavaScript observados no fluxo final. |

A suíte do app passou com 136 testes. A verificação visual usou um espaço fictício, separado dos dados do usuário. O armazenamento seguro foi testado por contrato; isso não equivale a homologação em todos os provedores de credenciais de cada sistema operacional.

## Limites

Um rascunho gerado comprova o fluxo, não a qualidade de todos os modelos. As permissões e revisões de ferramentas continuam vigentes. A sala de bots permanece sequencial e sem ferramentas. Windows/Linux não foram executados nativamente neste Mac; o pacote Mac continua sem notarização Apple.
