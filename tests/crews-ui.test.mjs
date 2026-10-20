import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crewModelChoices, isAdvancedModel, modelOptionLabel } from '../public/crew-mascots.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('a ilha Equipas fica entre Trabalhar e Criar e o limite de tokens aparece na interface', async () => {
  const html = await readFile(resolve(root, 'public/index.html'), 'utf8');
  const js = await readFile(resolve(root, 'public/app.js'), 'utf8');
  const ui = await readFile(resolve(root, 'public/crews.js'), 'utf8');
  const css = await readFile(resolve(root, 'public/navigation.css'), 'utf8');
  const a11y = await readFile(resolve(root, 'public/a11y-visual.css'), 'utf8');
  const server = await readFile(resolve(root, 'src/server.ts'), 'utf8');
  const work = html.indexOf('data-nav-island-group="work"');
  const crews = html.indexOf('data-nav-island-group="crews"');
  const create = html.indexOf('data-nav-island-group="create"');
  assert.ok(work >= 0 && work < crews && crews < create);
  assert.match(html, /data-page="crews"/);
  assert.match(html, /> Equipas</);
  assert.match(html, /\/crews\.css/);
  assert.match(js, /crews:'crews'/);
  assert.match(js, /crews:'Equipas'/);
  assert.match(ui, /Limite de tokens por conversa/);
  assert.match(ui, /data-crew-token-limit/);
  assert.match(ui, /crewModelChoices/);
  assert.match(css, /data-nav-island-group="crews"/);
  assert.match(css, /repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(a11y, /repeat\(5,minmax\(0,1fr\)\)/);
  for (const file of ['/crews.js', '/crews.css', '/crew-mascots.js']) assert.match(server, new RegExp(`'${file}'`));
});

test('um colega não pode escolher 70B ou EXO; o coordenador pode', () => {
  const catalog = [
    { id: 'qwen35-9b', name: 'Qwen 9B', parameters_b: 9, local_key: 'gguf:qwen' },
    { id: 'gpt-oss-120b', name: 'GPT 120B', parameters_b: 120, local_key: null },
  ];
  const installed = [{ key: 'gguf:qwen', display_name: 'Qwen instalado' }];
  const colleague = crewModelChoices({ catalog, installed, suggestion: catalog[0], current: 'gguf:qwen', coordinator: false });
  const large = colleague.find(model => model.key === 'gpt-oss-120b');
  assert.equal(large.disabled, true);
  assert.match(modelOptionLabel(large), /só o coordenador/);
  assert.equal(colleague.find(model => model.key === 'gguf:qwen').disabled, false);
  const coordinator = crewModelChoices({ catalog, installed, current: 'exo:cluster', coordinator: true, advancedMin: 70 });
  assert.equal(coordinator.find(model => model.key === 'exo:cluster').disabled, false);
  assert.equal(isAdvancedModel('exo:cluster', null), true);
  assert.equal(isAdvancedModel('local', 14), false);
  assert.equal(isAdvancedModel('local', 70), true);
});
