import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('os tokens grafite e o tema claro ficam num arquivo partilhado', () => {
  const tokens = readFileSync('public/tokens.css', 'utf8');
  const html = readFileSync('public/index.html', 'utf8');
  const server = readFileSync('src/server.ts', 'utf8');
  for (const hex of ['#0f1114', '#15181c', '#1b1f24', '#262b31', '#e6e8eb', '#8b929b', '#5d646d', '#7aa2f7', '#5fb98a', '#d6a652']) {
    assert.match(tokens, new RegExp(hex));
  }
  assert.match(tokens, /--danger:/);
  assert.match(tokens, /html\[data-theme="dark"\]/);
  assert.match(tokens, /--bg:\s*#f4f6f8/);
  assert.match(tokens, /--ink:\s*#1a1d21/);
  assert.match(html, /href="\/tokens\.css"/);
  assert.match(html, /href="\/design-system\.css"/);
  assert.ok(html.indexOf('/a11y-visual.css') < html.indexOf('/tokens.css'));
  assert.ok(html.indexOf('/tokens.css') < html.indexOf('/design-system.css'));
  assert.match(server, /'\/tokens\.css'/);
  assert.match(server, /'\/design-system\.css'/);
});

test('o shell usa a barra de 232px, foco visível e o registo do chat', () => {
  const css = readFileSync('public/design-system.css', 'utf8');
  assert.match(css, /width:\s*232px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.chat-message/);
  assert.match(css, /tabular-nums/);
  assert.match(css, /#command-palette/);
});

test('a navegação visível fala português do Brasil', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const app = readFileSync('public/app.js', 'utf8');
  assert.match(html, />Equipes</);
  assert.match(html, /> Configurações</);
  assert.doesNotMatch(html, /> Equipas</);
  assert.doesNotMatch(html, /> Preferências</);
  assert.match(app, /Ajustes \/ Configurações/);
  assert.match(app, /Biblioteca \/ Modelos/);
  assert.match(app, /Conversas \/ Chat/);
  assert.match(app, /Conectar \/ Modo servidor/);
  assert.match(readFileSync('public/design-system.css', 'utf8'), /#server-mode/);
  assert.match(html, /data-page="server"/);
});
