"""Colmeia stream framing; independent of any desktop inference application."""
import json
import uuid


class OutputParser:
    def __init__(self, tokenizer, tools, thinking=False):
        self.tokenizer = tokenizer
        self.tools = tools
        self.mode = 'thinking' if thinking else 'content'
        self.buffer = ''
        self.tool_text = ''
        self.calls = []
        self.markers = {}
        if tokenizer.has_thinking:
            self.markers[tokenizer.think_start] = 'thinking'
            self.markers[tokenizer.think_end] = 'content'
        if tokenizer.has_tool_calling:
            self.markers[tokenizer.tool_call_start] = 'tool'
            self.markers[tokenizer.tool_call_end] = 'end_tool'

    def feed(self, text, final=False):
        self.buffer += text
        output = []
        while self.buffer:
            matches = [(self.buffer.find(m), m, mode) for m, mode in self.markers.items() if m in self.buffer]
            if matches:
                index, marker, mode = min(matches)
                self.emit(self.buffer[:index], output)
                self.buffer = self.buffer[index + len(marker):]
                if mode == 'end_tool':
                    if self.mode != 'tool':
                        raise ValueError('Fim de ferramenta sem início.')
                    parsed = self.tokenizer.tool_parser(self.tool_text.strip(), self.tools)
                    for call in parsed if isinstance(parsed, list) else [parsed]:
                        if not self.tools or call.get('name') not in {t['function']['name'] for t in self.tools}:
                            raise ValueError('O modelo solicitou uma ferramenta não habilitada.')
                        if not isinstance(call.get('arguments'), dict) or len(self.calls) >= 8:
                            raise ValueError('Chamada de ferramenta inválida.')
                        self.calls.append({'index': len(self.calls), 'id': str(uuid.uuid4()), 'type': 'function', 'function': {'name': call['name'], 'arguments': json.dumps(call['arguments'], ensure_ascii=False)}})
                    self.tool_text = ''
                    self.mode = 'content'
                else:
                    self.mode = mode
                continue
            keep = 0
            if not final:
                for marker in self.markers:
                    for n in range(1, min(len(marker), len(self.buffer) + 1)):
                        if self.buffer.endswith(marker[:n]):
                            keep = max(keep, n)
            end = len(self.buffer) - keep
            self.emit(self.buffer[:end], output)
            self.buffer = self.buffer[end:]
            break
        return output

    def emit(self, text, output):
        if not text:
            return
        if self.mode == 'tool':
            self.tool_text += text
            if len(self.tool_text) > 131072:
                raise ValueError('Argumentos da ferramenta excederam o limite.')
        else:
            output.append({'reasoning_content' if self.mode == 'thinking' else 'content': text})


def validate_request(body, alias):
    if not isinstance(body, dict) or body.get('model') != alias or body.get('stream') is not True:
        raise ValueError('Modelo ou formato de resposta inválido.')
    allowed = {'model', 'messages', 'stream', 'stream_options', 'temperature', 'top_p', 'max_tokens', 'reasoning_effort', 'chat_template_kwargs', 'tools', 'tool_choice', 'parallel_tool_calls', 'cache_prompt', 'reasoning_budget'}
    if set(body) - allowed:
        raise ValueError('Parâmetro não suportado pelo motor MLX.')
    messages = body.get('messages')
    if not isinstance(messages, list) or not messages or len(messages) > 2000:
        raise ValueError('Conversa inválida.')
    for m in messages:
        if not isinstance(m, dict) or m.get('role') not in {'system', 'user', 'assistant', 'tool'} or not isinstance(m.get('content'), str):
            raise ValueError('Mensagem inválida.')
        if set(m) - {'role', 'content', 'tool_calls', 'tool_call_id'}:
            raise ValueError('Campo de mensagem não suportado.')
    for field, low, high in [('temperature', 0, 2), ('top_p', .01, 1), ('max_tokens', 1, 32768), ('reasoning_budget', 0, 4096)]:
        value = body.get(field, {'temperature': .7, 'top_p': .95, 'max_tokens': 2048, 'reasoning_budget': 1536}[field])
        if type(value) not in {int, float} or not low <= value <= high or (field in {'max_tokens', 'reasoning_budget'} and type(value) is not int):
            raise ValueError('Valor inválido: ' + field)
    kwargs = body.get('chat_template_kwargs', {})
    if not isinstance(kwargs, dict) or set(kwargs) - {'enable_thinking'} or ('enable_thinking' in kwargs and type(kwargs['enable_thinking']) is not bool):
        raise ValueError('Ajustes de template inválidos.')
    tools = body.get('tools', [])
    if not isinstance(tools, list) or len(tools) > 16:
        raise ValueError('Ferramentas inválidas.')
    for tool in tools:
        if not isinstance(tool, dict) or tool.get('type') != 'function' or not isinstance(tool.get('function'), dict) or not isinstance(tool['function'].get('name'), str):
            raise ValueError('Definição de ferramenta inválida.')
    return body
