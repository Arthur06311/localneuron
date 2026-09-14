"""Owned local MLX worker. Only a fixed, local model can be served.

Uses Apple's open-source MLX/MLX LM APIs, never LM Studio code or binaries.
Launched inside the macOS no-outbound-network sandbox by the app.
"""
import argparse
import hmac
import importlib.util
import json
import os
from pathlib import Path
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

for key in ('HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HUB_DISABLE_TELEMETRY', 'DO_NOT_TRACK'):
    os.environ[key] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
# Defense in depth: no outbound sockets, even when manually launching this worker.
def offline_audit(event, args):
    if event in {'socket.connect', 'socket.getaddrinfo'}:
        raise PermissionError('O motor MLX da Colmeia funciona sem conexões externas.')
sys.addaudithook(offline_audit)

spec = importlib.util.spec_from_file_location('colmeia_mlx_protocol', Path(__file__).with_name('mlx_protocol.py'))
protocol = importlib.util.module_from_spec(spec)
spec.loader.exec_module(protocol)
import mlx.core as mx
from mlx_lm import load, stream_generate
from mlx_lm.sample_utils import make_sampler


class ThinkingBudget:
    def __init__(self, tokenizer, budget, active):
        self.start = tuple(tokenizer.think_start_tokens or ())
        self.end = tuple(tokenizer.think_end_tokens or ())
        self.active = active
        self.remaining = budget
        self.tail = []
        self.force = []
        self.first = True

    def __call__(self, tokens, logits):
        if self.first:
            self.first = False
        else:
            self.tail.append(int(tokens[-1].item()))
            self.tail = self.tail[-max(len(self.start), len(self.end), 1):]
            if self.end and tuple(self.tail[-len(self.end):]) == self.end:
                self.active = False
            elif self.start and tuple(self.tail[-len(self.start):]) == self.start:
                self.active = True
            if self.active:
                self.remaining -= 1
        if self.active and self.remaining <= 0 and self.end and not self.force:
            self.force = list(self.end)
            self.active = False
        if self.force:
            token = self.force.pop(0)
            return mx.where(mx.arange(logits.shape[-1]) == token, 0, -float('inf'))
        return logits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--alias', required=True)
    parser.add_argument('--port', required=True, type=int)
    parser.add_argument('--context', required=True, type=int)
    parser.add_argument('--memory-limit', required=True, type=int)
    parser.add_argument('--key-file', required=True)
    args = parser.parse_args()
    path = Path(args.model).resolve(strict=True)
    if not path.is_dir() or not (path / 'config.json').is_file() or not 2048 <= args.context <= 131072:
        raise ValueError('Pasta MLX ou contexto inválido.')
    secret = Path(args.key_file).read_text().strip()
    if len(secret) != 64:
        raise ValueError('Credencial do motor inválida.')
    mx.set_memory_limit(args.memory_limit)
    mx.set_cache_limit(min(256 * 1024**2, args.memory_limit // 16))
    model, tokenizer = load(path, tokenizer_config={'trust_remote_code': False, 'local_files_only': True})
    gate = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def authorized(self):
            if self.headers.get('Host') != f'127.0.0.1:{args.port}' or self.headers.get('Origin'):
                self.error(403, 'Origem recusada.'); return False
            if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret):
                self.error(401, 'Sessão do motor inválida.'); return False
            return True

        def error(self, code, message):
            data = json.dumps({'error': message}).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.authorized(): return
            if self.path == '/health':
                value = {'status': 'ok', 'engine': 'colmeia-mlx', 'offline': True}
            elif self.path == '/props':
                value = {'default_generation_settings': {'n_ctx': args.context}, 'engine': 'colmeia-mlx', 'offline': True, 'native_tools': tokenizer.has_tool_calling, 'thinking': tokenizer.has_thinking, 'active_memory_bytes': mx.get_active_memory(), 'peak_memory_bytes': mx.get_peak_memory()}
            else:
                self.error(404, 'Rota não encontrada.'); return
            data = json.dumps(value).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

        def do_POST(self):
            if not self.authorized(): return
            if self.path != '/v1/chat/completions':
                self.error(404, 'Rota não encontrada.'); return
            if self.headers.get('Transfer-Encoding'):
                self.error(400, 'Use Content-Length.'); return
            self.connection.settimeout(30)
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 2 * 1024**2: raise ValueError('Requisição grande ou vazia.')
                raw = self.rfile.read(size)
                if len(raw) != size: raise ValueError('Requisição incompleta.')
                body = protocol.validate_request(json.loads(raw), args.alias)
            except (ValueError, TimeoutError) as e:
                self.error(400, str(e)); return
            if not gate.acquire(blocking=False):
                self.error(409, 'O motor está respondendo a outra conversa.'); return
            streaming = False
            generator = None
            try:
                tools = body.get('tools', [])
                if tools and not tokenizer.has_tool_calling:
                    raise ValueError('Este template MLX não tem ferramentas nativas. Selecione o modo JSON em Ferramentas.')
                messages = body['messages']
                # Most native templates expect structured argument objects in tool history.
                for message in messages:
                    for call in message.get('tool_calls', []):
                        if isinstance(call.get('function', {}).get('arguments'), str):
                            call['function']['arguments'] = json.loads(call['function']['arguments'])
                thinking = body.get('chat_template_kwargs', {}).get('enable_thinking', True)
                prompt = tokenizer.apply_chat_template(messages, tools=tools or None, add_generation_prompt=True, tokenize=True, enable_thinking=thinking)
                count = len(prompt)
                maximum = body.get('max_tokens', 2048)
                if count + maximum > args.context:
                    raise ValueError(f'O texto usa {count} tokens e a saída reserva {maximum}; reduza o texto ou aumente o contexto de {args.context}.')
                initial_thinking = tokenizer.has_thinking and tokenizer.rfind_think_start(prompt) > tokenizer.rfind_think_end(prompt)
                output = protocol.OutputParser(tokenizer, tools, initial_thinking)
                self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.send_header('Cache-Control', 'no-store'); self.send_header('Connection', 'close'); self.end_headers()
                streaming = True
                def event(value):
                    self.wfile.write(('data: ' + json.dumps(value, ensure_ascii=False) + '\n\n').encode()); self.wfile.flush()
                def progress(*_):
                    self.wfile.write(b': preparando\n\n'); self.wfile.flush()
                processors = [ThinkingBudget(tokenizer, body.get('reasoning_budget', 1536), initial_thinking)] if tokenizer.has_thinking else []
                generator = stream_generate(model, tokenizer, prompt, max_tokens=maximum, sampler=make_sampler(temp=body.get('temperature', .7), top_p=body.get('top_p', .95)), logits_processors=processors, prefill_step_size=256, prompt_progress_callback=progress)
                total = 0
                for result in generator:
                    total += len(result.text.encode())
                    if total > 1024**2: raise ValueError('A resposta excedeu o limite de tamanho.')
                    for delta in output.feed(result.text, final=result.finish_reason is not None):
                        event({'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]})
                    if result.finish_reason:
                        finish = result.finish_reason
                        if finish == 'stop' and output.mode == 'tool': raise ValueError('Ferramenta incompleta na resposta do modelo.')
                        if finish == 'stop' and output.calls:
                            event({'choices': [{'index': 0, 'delta': {'tool_calls': output.calls}, 'finish_reason': None}]})
                            finish = 'tool_calls'
                        event({'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish}], 'usage': {'prompt_tokens': count, 'completion_tokens': result.generation_tokens, 'total_tokens': count + result.generation_tokens}})
                self.wfile.write(b'data: [DONE]\n\n'); self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            except Exception as e:
                if not streaming:
                    self.error(400, str(e)[:600])
                else:
                    try:
                        self.wfile.write(('data: ' + json.dumps({'error': str(e)[:600]}) + '\n\n').encode()); self.wfile.flush()
                    except OSError: pass
            finally:
                if generator is not None: generator.close()
                mx.clear_cache()
                gate.release()
                self.close_connection = True

    class Server(ThreadingHTTPServer):
        daemon_threads = True
        def handle_error(self, *_): pass
    Server(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
