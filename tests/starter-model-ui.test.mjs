import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starterSuggestionHtml } from '../public/starter-model.js';

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

test('O aviso de início rápido fica em pt-PT e oferece um descarregamento', () => {
  assert.equal(starterSuggestionHtml(null, escape), '');
  assert.equal(starterSuggestionHtml({ id: '', name: 'Vazio' }, escape), '');
  const html = starterSuggestionHtml({ id: 'qwen3-mini', name: 'Qwen3 · Mini', ram_gib: 2, computer_ram_gib: 8 }, escape);
  assert.match(html, /Início rápido\./);
  assert.match(html, /sugerimos um único modelo: Qwen3 · Mini/);
  assert.match(html, /2 GiB de RAM estimados para o usar/);
  assert.match(html, /computador a partir de 8 GiB/);
  assert.match(html, /data-model-command="download"/);
  assert.match(html, /data-model-value="qwen3-mini"/);
  assert.match(html, />Descarregar este modelo</);
  assert.equal(html.includes('Baixar'), false);
  const quoted = starterSuggestionHtml({ id: 'a"b', name: 'A & B', ram_gib: 2, computer_ram_gib: 8 }, escape);
  assert.match(quoted, /data-model-value="a&quot;b"/);
  assert.match(quoted, /A &amp; B/);
});

test('A primeira utilização e a biblioteca sem modelos mostram a sugestão', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const wizard = readFileSync(new URL('../public/experience.js', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(app, /starterSuggestionHtml\(s\.starter, escape\)/);
  assert.match(wizard, /starterSuggestionHtml\(result\.starter,E\)/);
  assert.match(server, /\/starter-model\.js/);
});
