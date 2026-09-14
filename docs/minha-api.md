# Minha API — Colmeia 0.4

O Colmeia pode servir uma IA local a outro aplicativo ou computador. O outro computador envia mensagens; a inferência continua na máquina que hospeda o modelo. Não há provedor de nuvem envolvido.

## Usar

1. Abra **Minha API** e gere uma chave. Copie-a agora; o aplicativo guarda somente seu hash. Ao sair da página ou recarregá-la, a chave completa deixa de ser exibida.
2. Escolha uma IA instalada e onde usar: somente este computador ou um endereço da sua rede privada. Para rede privada, confirme que confia na rede ou usa uma VPN.
3. Clique em **Preparar IA e ligar API**. O aplicativo prepara o modelo e mostra o endereço.
4. No outro aplicativo, escolha um provedor **OpenAI compatível** e informe a URL base exibida, a chave copiada e o modelo **local**.

A API é HTTP. Em uma rede, a chave e os textos não são cifrados pelo Colmeia; use uma rede privada confiável ou uma VPN. O aplicativo não abre portas do roteador e não configura exposição à internet. Em redes diferentes, é necessário configurar a VPN entre os dispositivos. Endereços públicos e `0.0.0.0` não são aceitos pela interface de compartilhamento.

O computador anfitrião precisa permanecer ligado e com Colmeia desbloqueado. Bloquear ou fechar desliga o servidor e cancela requisições pendentes. O compartilhamento não reinicia automaticamente na próxima abertura. Substituir a chave revoga a anterior e desliga o servidor. Revogar acesso remove a chave ativa.

## Compatibilidade

Base: `http://ENDERECO-DESTE-PC:4320/v1`.

- `GET /models`: lista o modelo compartilhado com identificador `local`.
- `POST /chat/completions`: mensagens de texto com papéis `system`, `user` e `assistant`.
- Resposta JSON ou SSE (`stream: true`), incluindo fechamento `[DONE]` e uso de tokens quando o motor o informa.
- Parâmetros aceitos: `model`, `messages`, `stream`, `max_tokens` ou `max_completion_tokens`, `temperature`, `top_p`, `reasoning_effort` e `stream_options.include_usage`.

É compatibilidade de Chat Completions para texto, **não implementação de toda a API OpenAI**. Ferramentas, imagens, áudio, endpoints Responses e Embeddings não estão disponíveis. Clientes que exigem esses recursos precisam de outra integração. Chamadas diretas com cabeçalho Origin de navegador são recusadas; use cliente nativo ou backend. O painel administrativo, conversas e downloads não são publicados no servidor da API.

Exemplo, com uma chave fornecida pelo próprio usuário em variável de ambiente:

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="http://ENDERECO-DESTE-PC:4320/v1",
    api_key=os.environ["COLMEIA_API_KEY"],
)
response = client.chat.completions.create(
    model="local",
    messages=[{"role": "user", "content": "Explique energia solar."}],
)
print(response.choices[0].message.content)
```

A biblioteca `openai` é usada apenas como cliente de protocolo; o endereço aponta para o computador que hospeda Colmeia.

## Memória e concorrência

Chat e API compartilham o motor. Há uma geração por vez pelo Colmeia; uma chamada concorrente recebe HTTP 503 com `Retry-After: 3`. Uma chave inválida recebe 401; tentativas inválidas repetidas recebem 429. Revogação, desligamento e desconexão do cliente interrompem a geração. O servidor da API não salva o conteúdo de suas requisições no histórico do chat. O motor local pode ter seus próprios logs de diagnóstico.

A API usa a janela de contexto preparada pelo modelo, limitada também à configuração do servidor. Se o histórico não couber, as mensagens mais antigas são retiradas da janela em turnos inteiros. Isso não é memória ilimitada. Dados de uso de tokens são omitidos quando o motor não os informa.
