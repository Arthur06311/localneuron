import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useLocale } from '../public/i18n.js';
import {
  modelByteSize,
  noModelLoaded,
  noModelLoadedHtml,
  sortSmallLocalFirst,
} from '../public/chat-no-model.js';

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

test('sem modelo selecionado o envio não segue, e o aviso oferece escolher um modelo', () => {
  assert.equal(noModelLoaded(''), true);
  assert.equal(noModelLoaded('   '), true);
  assert.equal(noModelLoaded(null), true);
  assert.equal(noModelLoaded(undefined), true);
  assert.equal(noModelLoaded('gguf:pequeno'), false);

  useLocale('pt-BR');
  const portuguese = noModelLoadedHtml(escape, { hidden: true });
  assert.match(portuguese, /id="chat-no-model"/);
  assert.match(portuguese, /class="notice warn chat-no-model"/);
  assert.match(portuguese, /role="status"/);
  assert.match(portuguese, / hidden>/);
  assert.match(portuguese, /Nenhum modelo carregado\./);
  assert.match(portuguese, /Escolher modelo/);
  assert.match(portuguese, /data-chat-choose-model/);
  assert.match(portuguese, /type="button"/);
  assert.doesNotMatch(portuguese, /download|stripe|GiB|GB|ram_gib|COLMEIA_/i);
  const marked = noModelLoadedHtml((value) => `ESC:${escape(value)}`);
  assert.match(marked, /<p>ESC:Nenhum modelo carregado\.<\/p>/);
  assert.match(marked, />ESC:Escolher modelo</);

  useLocale('en');
  try {
    const english = noModelLoadedHtml(escape);
    assert.match(english, /No model loaded\./);
    assert.match(english, /Choose model/);
    assert.doesNotMatch(english, / hidden>/);
    assert.doesNotMatch(english, /Nenhum modelo carregado|Escolher modelo/);
  } finally {
    useLocale('pt-BR');
  }
});

test('modelos locais pequenos vêm primeiro, pelo tamanho real, sem inventar grandeza', () => {
  const catalog = [
    { id: 'card-tiny', local_key: 'gguf:tiny', bytes: 1_000_000_000 },
    { id: 'card-mid', local_key: 'gguf:mid', bytes: 4_000_000_000 },
  ];
  const installed = [
    { key: 'gguf:mid', display_name: 'Médio', size_bytes: 4_000_000_000 },
    { key: 'exo:rede', display_name: 'Rede', size_bytes: 1 },
    { key: 'gguf:tiny', display_name: 'Pequeno', size_bytes: 1_000_000_000 },
    { key: 'mlx:sem-tamanho', display_name: 'Sem tamanho' },
    { key: 'gguf:igual-b', display_name: 'Beta', size_bytes: 2_000_000_000 },
    { key: 'gguf:igual-a', display_name: 'Alfa', size_bytes: 2_000_000_000 },
  ];
  const before = installed.map((model) => model.key);
  const sorted = sortSmallLocalFirst(installed, catalog);
  assert.deepEqual(
    sorted.map((model) => model.key),
    ['gguf:tiny', 'gguf:igual-a', 'gguf:igual-b', 'gguf:mid', 'mlx:sem-tamanho', 'exo:rede'],
  );
  assert.deepEqual(installed.map((model) => model.key), before);
  assert.equal(Object.hasOwn(sorted[0], 'ram_gib'), false);
  assert.equal(sorted[0].size_bytes, 1_000_000_000);
  assert.equal(modelByteSize({ key: 'gguf:mid' }, catalog), 4_000_000_000);
  assert.equal(modelByteSize({ key: 'gguf:ausente', size_bytes: 0 }, catalog), null);
  assert.deepEqual(sortSmallLocalFirst(null), []);
  assert.deepEqual(sortSmallLocalFirst(undefined), []);

  const library = [
    { id: 'baixar-mini', name: 'Baixar mini', bytes: 500_000_000 },
    { id: 'local-grande', name: 'Local grande', bytes: 9_000_000_000, local_key: 'gguf:grande' },
    { id: 'local-pequeno', name: 'Local pequeno', bytes: 2_000_000_000, local_key: 'gguf:pequeno' },
    { id: 'remoto', name: 'Rede', bytes: 10, key: 'exo:cluster' },
    { id: 'sem-bytes', name: 'Sem ficha', external: true },
  ];
  assert.deepEqual(sortSmallLocalFirst(library).map((model) => model.id), [
    'local-pequeno',
    'local-grande',
    'baixar-mini',
    'remoto',
    'sem-bytes',
  ]);
});

test('o Chat guarda o texto, não envia, e o botão abre Modelos com locais pequenos primeiro', () => {
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const app = readFileSync(resolve('public/app.js'), 'utf8');
  const css = readFileSync(resolve('public/design-system.css'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const helper = readFileSync(resolve('public/chat-no-model.js'), 'utf8');

  const sendAt = chat.indexOf('async function send');
  const send = chat.slice(sendAt, chat.indexOf('document.addEventListener("input"', sendAt));
  const gate = send.indexOf('if (noModelLoaded(key))');
  const preparing = send.indexOf('preparing = true');
  assert.ok(gate > 0 && preparing > gate);
  const early = send.slice(gate, preparing);
  assert.match(early, /\$\("#chat-no-model"\)/);
  assert.match(early, /note\.hidden = false/);
  assert.match(early, /drafts\.set\(draftId, input\.value\)/);
  assert.match(early, /return;/);
  assert.doesNotMatch(early, /showLibrary|input\.value = ""|\/chats\/|model-library\/load|download/);

  assert.match(chat, /noModelLoadedHtml\(escape, \{ hidden: true \}\)/);
  assert.match(chat, /data-chat-choose-model/);
  assert.match(chat, /showLibrary\(\{ smallLocalFirst: true \}\)/);
  const choose = chat.slice(chat.indexOf('data-chat-choose-model'));
  const chooseBranch = choose.slice(0, choose.indexOf('data-chat-library'));
  assert.match(chooseBranch, /drafts\.set\(current \|\| "new", input\.value\)/);
  assert.doesNotMatch(chooseBranch, /download|model-library\/load|input\.value = ""/);

  assert.match(app, /showLibrary:\(options\)=>navigate\('models',undefined,options\)/);
  assert.match(app, /modelLibrary\(options\)/);
  assert.match(app, /librarySmallFirst = Boolean\(options\?\.smallLocalFirst\)/);
  assert.match(app, /const installedModels=librarySmallFirst\?sortSmallLocalFirst\(s\.installed,s\.catalog\):s\.installed/);
  assert.match(app, /if\(librarySmallFirst\)matches=sortSmallLocalFirst\(matches,s\.catalog\)/);
  assert.match(app, /catalog\.before\(heading,installed\)/);
  assert.doesNotMatch(helper, /fetch\(|XMLHttpRequest|ram_gib|GiB|COLMEIA_|model-library\/download/);

  const rule = css.slice(css.indexOf('body.chat-page .chat-no-model'));
  assert.match(rule, /body\.chat-page \.chat-no-model\[hidden\] \{\s*display: none;/);
  assert.match(server, /'\/chat-no-model\.js':\['chat-no-model\.js','application\/javascript'\]/);
});
