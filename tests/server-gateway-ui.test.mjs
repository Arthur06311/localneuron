import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../public/server-mode.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/server-gateway.ts', import.meta.url), 'utf8');

test('O pareamento avisa a porta 52415 e não abre a internet', () => {
  assert.match(ui, /Parear um computador/);
  assert.match(ui, /expira depressa/);
  assert.match(ui, /chave própria, guardada no cofre/);
  assert.match(ui, /Nada é aberto para a internet/);
  assert.match(ui, /Registo local/);
  assert.match(ui, /id="server-exo-warning"/);
  assert.match(source, /A porta 52415 continua acessível na LAN enquanto o EXO estiver ligado/);
  assert.match(source, /global: false/);
  assert.match(source, /0\.0\.0\.0/);
});
