import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { embeddedEngine } from '../src/embedded-engine.js';
import { CATALOG } from '../src/catalog.js';

const qwen = CATALOG.find(model => model.architecture === 'qwen35');
if (!qwen) throw new Error('Catálogo sem modelo qwen35');

test('Motor embutido segue a plataforma: llama.cpp no GGUF e MLX só no Apple Silicon', () => {
  assert.deepEqual(embeddedEngine(qwen, { platform: 'linux', arch: 'x64' }), { runs: true, engine: 'llama.cpp', label: 'Motor embutido · llama.cpp' });
  assert.deepEqual(embeddedEngine(qwen, { platform: 'win32', arch: 'x64' }), { runs: true, engine: 'llama.cpp', label: 'Motor embutido · llama.cpp' });
  assert.deepEqual(embeddedEngine(qwen, { platform: 'darwin', arch: 'arm64' }), { runs: true, engine: 'llama.cpp', label: 'Motor embutido · llama.cpp' });
  assert.equal(embeddedEngine(qwen, { platform: 'linux', arch: 'arm64' }).runs, false);
  assert.equal(embeddedEngine(qwen, { platform: 'darwin', arch: 'x64' }).runs, false);
  assert.equal(embeddedEngine({ ...qwen, architecture: 'arquitetura-desconhecida' }, { platform: 'linux', arch: 'x64' }).runs, false);
  assert.equal(embeddedEngine({ ...qwen, repo: 'org/modelo-embeddings' }, { platform: 'linux', arch: 'x64' }).runs, false);
  const mlx = { ...qwen, format: 'MLX', repo: 'org/mlx-modelo', file: 'modelo' };
  assert.deepEqual(embeddedEngine(mlx, { platform: 'darwin', arch: 'arm64' }), { runs: true, engine: 'MLX', label: 'Motor embutido · MLX' });
  assert.equal(embeddedEngine(mlx, { platform: 'linux', arch: 'x64' }).runs, false);
  assert.equal(embeddedEngine(mlx, { platform: 'win32', arch: 'x64' }).engine, null);
});

test('O catálogo mostra o selo e o filtro dos motores embutidos', () => {
  const app = readFileSync('public/app.js', 'utf8');
  const library = readFileSync('src/model-library.ts', 'utf8');
  assert.match(app, /Motores embutidos/);
  assert.match(app, /m\.embedded\?\.runs/);
  assert.match(app, /embedded-seal/);
  assert.match(app, /m\.embedded\.label/);
  assert.match(library, /embedded:embeddedEngine\(/);
});
