import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crewModelChoices, initials, isAdvancedModel, memberCaption, modelOptionLabel } from '../public/crew-mascots.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('a ilha Equipes fica entre Trabalhar e Criar, em pt-BR, com o registo e o modal do coordenador', async () => {
  const html = await readFile(resolve(root, 'public/index.html'), 'utf8');
  const js = await readFile(resolve(root, 'public/app.js'), 'utf8');
  const ui = await readFile(resolve(root, 'public/crews.js'), 'utf8');
  const page = await readFile(resolve(root, 'public/crews.css'), 'utf8');
  const css = await readFile(resolve(root, 'public/navigation.css'), 'utf8');
  const a11y = await readFile(resolve(root, 'public/a11y-visual.css'), 'utf8');
  const server = await readFile(resolve(root, 'src/server.ts'), 'utf8');
  const talk = await readFile(resolve(root, 'src/crew-talk.ts'), 'utf8');
  const work = html.indexOf('data-nav-island-group="work"');
  const crews = html.indexOf('data-nav-island-group="crews"');
  const create = html.indexOf('data-nav-island-group="create"');
  assert.ok(work >= 0 && work < crews && crews < create);
  assert.match(html, /data-page="crews"/);
  assert.match(html, /> Equipes</);
  assert.doesNotMatch(html, /> Equipas</);
  assert.match(html, /\/crews\.css/);
  assert.match(js, /crews:'crews'/);
  assert.match(js, /crews:'Equipes \/ Equipes'/);
  assert.match(ui, /Limite de tokens por conversa/);
  assert.match(ui, /data-crew-token-limit/);
  assert.match(ui, /data-crew-round/);
  assert.match(ui, /\/crews\/talk/);
  assert.match(ui, /Escreva um pedido para a equipe/);
  assert.match(ui, /Conectar bots de trabalho/);
  assert.match(ui, /Não lidas/);
  assert.match(ui, /Remover da equipe/);
  assert.match(ui, /Bot ausente/);
  assert.match(ui, /id="crew-remote"/);
  assert.match(ui, /Configurar coordenador/);
  assert.match(ui, /Nada fica público por padrão/);
  assert.match(ui, /Mostrar mascote/);
  assert.match(ui, /toLocaleString\('pt-BR'\)/);
  assert.match(ui, /crewModelChoices/);
  assert.match(page, /#0f1114/);
  assert.match(page, /#7aa2f7/);
  assert.match(page, /264px minmax\(0,1fr\) 300px/);
  assert.doesNotMatch(page, /--island-crews-soft/);
  assert.doesNotMatch(page, /--crew-/);
  assert.match(page, /\.crews-page\{\s*--bg:#f4f6f8;--panel:#fff;--panel2:#f3f4f6;--line:#e2e5e9;--ink:#1c1f24;--muted:#5c6570;--faint:#8b929b;\s*--accent:#7aa2f7;--ok:#2f8f62;--warn:#a07828;/);
  assert.match(page, /html\[data-theme=dark\] \.crews-page\{\s*--bg:#0f1114;--panel:#15181c;--panel2:#1b1f24;--line:#262b31;--ink:#e6e8eb;--muted:#8b929b;--faint:#5d646d;\s*--accent:#7aa2f7;--ok:#5fb98a;--warn:#d6a652/);
  assert.doesNotMatch(page, /:root/);
  assert.match(talk, /Você é \$\{coordinator\.name\}, coordenador da equipe\. Responda/);
  assert.doesNotMatch(talk, /És \$\{coordinator\.name\}/);
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
  assert.equal(memberCaption({ name: 'Coordenador', role: 'Coordenador', mascot: 'coordenador', coordinator: true }), '');
  assert.equal(memberCaption({ name: 'Coordenador', role: 'Estratégia', mascot: 'coordenador', coordinator: true }), 'Estratégia');
  assert.equal(memberCaption({ name: 'Release', role: 'Código', mascot: 'codigo', coordinator: false }), 'Código');
  assert.equal(initials('Quality Assurance'), 'QA');
  assert.equal(Number(3120).toLocaleString('pt-BR'), '3.120');
});
