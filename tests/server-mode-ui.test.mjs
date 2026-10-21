import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../public/server-mode.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');

test('A tela Modo servidor pergunta o papel e fica na navegação', () => {
  assert.match(ui, /Como este computador vai participar\?/);
  assert.match(ui, /Contribuir/);
  assert.match(ui, /Gerenciar/);
  assert.match(ui, /Só usar/);
  assert.match(ui, /não rodar modelo aqui/);
  assert.match(ui, /O EXO pode eleger outro master/);
  assert.match(ui, /Escolher quais computadores/);
  assert.match(ui, /experimental/);
  assert.match(ui, /data-link-kind="/);
  assert.match(html, /data-page="server"/);
  assert.match(html, /Modo servidor/);
  assert.match(app, /createServerMode/);
  assert.match(app, /page==='server'/);
  assert.match(server, /\/v1\/server-mode/);
  assert.match(server, /serverMode\.disable\(\)/);
});
