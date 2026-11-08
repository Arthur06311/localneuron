import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { t, useLocale } from '../public/i18n.js';
import { planLocalInstallArrival, localInstallEffects, USUAL_READY_TOAST } from '../public/first-model.js';

const small = { key: 'gguf:small', display_name: 'Pequeno', size_bytes: 100 };
const large = { key: 'gguf:large', display_name: 'Grande', size_bytes: 9_000_000_000 };

function arrival({ before = [], after = [small], jobs = [['mini', 'downloading']], catalog, page = 'models' } = {}) {
  return planLocalInstallArrival({
    beforeInstalled: before,
    afterInstalled: after,
    beforeJobs: new Map(jobs),
    afterCatalog: catalog || [{ id: 'mini', name: 'Pequeno', local_key: small.key, job: { state: 'downloaded' } }],
    page,
  });
}

function effects(plan) {
  const calls = [];
  localInstallEffects(plan, {
    selectModel: (key, name) => calls.push(['select', key, name]),
    openChat: (key) => calls.push(['open', key]),
    focusComposer: () => calls.push(['focus']),
    toast: (message) => calls.push(['toast', message]),
    readyMessage: () => t('chat.firstReady'),
  });
  return calls;
}

test('o primeiro modelo local seleciona, abre o Chat, foca e avisa', () => {
  useLocale('pt-BR');
  const plan = arrival();
  assert.equal(plan.kind, 'first');
  assert.equal(plan.modelKey, small.key);
  assert.equal(plan.modelName, 'Pequeno');
  assert.equal(plan.openChat, true);
  assert.equal(plan.focus, true);
  assert.deepEqual(effects(plan), [
    ['select', small.key, 'Pequeno'],
    ['open', small.key],
    ['focus'],
    ['toast', 'Pronto. Escreve algo abaixo.'],
  ]);
  useLocale('en');
  try {
    assert.equal(t('chat.firstReady'), 'Ready. Write something below.');
    assert.equal(effects(plan).at(-1)[1], 'Ready. Write something below.');
  } finally {
    useLocale('pt-BR');
  }
});

test('o primeiro modelo não troca por outro maior que já apareceu na lista', () => {
  const plan = arrival({
    after: [large, small],
    catalog: [
      { id: 'grande', name: 'Grande', local_key: large.key, job: null },
      { id: 'mini', name: 'Pequeno', local_key: small.key, job: { state: 'installed' } },
    ],
    jobs: [['mini', 'verifying'], ['grande', '']],
  });
  assert.equal(plan.modelKey, small.key);
  assert.notEqual(plan.modelKey, large.key);
  assert.equal(effects(plan)[0][1], small.key);
});

test('no Chat o primeiro modelo é selecionado sem nova navegação', () => {
  const plan = arrival({ page: 'chat' });
  assert.equal(plan.openChat, false);
  assert.equal(plan.focus, true);
  const calls = effects(plan);
  assert.equal(calls.some((call) => call[0] === 'open'), false);
  assert.deepEqual(calls.map((call) => call[0]), ['select', 'focus', 'toast']);
  assert.equal(calls.at(-1)[1], 'Pronto. Escreve algo abaixo.');
});

test('fora da biblioteca e do Chat o primeiro modelo não salta de página', () => {
  const plan = arrival({ page: 'settings' });
  assert.equal(plan.openChat, false);
  assert.equal(plan.focus, false);
  const calls = effects(plan);
  assert.deepEqual(calls.map((call) => call[0]), ['select', 'toast']);
});

test('o segundo modelo não navega e só mostra o toast habitual', () => {
  const plan = arrival({
    before: [large],
    after: [large, small],
    page: 'models',
  });
  assert.deepEqual(plan, { kind: 'toast', modelKey: small.key });
  const calls = effects(plan);
  assert.deepEqual(calls, [['toast', USUAL_READY_TOAST]]);
  assert.equal(USUAL_READY_TOAST, 'Pronto.');
  assert.equal(calls.some((call) => call[0] === 'open' || call[0] === 'focus' || call[0] === 'select'), false);
});

test('rede EXO não conta como modelo local já instalado', () => {
  const plan = arrival({ before: [{ key: 'exo:grande', display_name: 'Rede' }] });
  assert.equal(plan.kind, 'first');
  assert.equal(plan.modelKey, small.key);
});

test('download ainda em curso, falha ou dois términos juntos não escolhem modelo', () => {
  assert.equal(arrival({ catalog: [{ id: 'mini', local_key: small.key, job: { state: 'downloading' } }] }), null);
  assert.equal(arrival({ jobs: [['mini', 'downloading']], catalog: [{ id: 'mini', local_key: small.key, job: { state: 'failed' } }] }), null);
  assert.equal(arrival({ jobs: [['mini', 'downloaded']] }), null);
  const both = arrival({
    after: [small, { key: 'gguf:other', display_name: 'Outro' }],
    jobs: [['mini', 'downloading'], ['other', 'verifying']],
    catalog: [
      { id: 'mini', name: 'Pequeno', local_key: small.key, job: { state: 'downloaded' } },
      { id: 'other', name: 'Outro', local_key: 'gguf:other', job: { state: 'installed' } },
    ],
  });
  assert.equal(both, null);
  assert.deepEqual(effects(null), []);
});

test('a instalação observada liga o plano e o atalho Conversar continua explícito', () => {
  const app = readFileSync(resolve('public/app.js'), 'utf8');
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  assert.match(app, /planLocalInstallArrival\(/);
  assert.match(app, /localInstallEffects\(plan/);
  assert.match(app, /t\('chat\.firstReady'\)/);
  assert.match(app, /pinModel: true/);
  assert.match(app, /page==='models'\|\|page==='chat'/);
  assert.match(app, /if\(command==='use'\)\{navigate\('chat',value\);return;\}/);
  assert.doesNotMatch(app, /navigate\('chat',model\.local_key\)/);
  assert.match(app, /command==='talk'\)\{await api\('\/model-library\/install'/);
  assert.match(chat, /options\.pinModel && preferred/);
  assert.match(chat, /\$\("#chat-input"\)\?\.focus\(\)/);
  assert.match(chat, /focusComposer\(\)/);
  assert.match(server, /'\/first-model\.js':\['first-model\.js','application\/javascript'\]/);
  assert.doesNotMatch(t('chat.firstReady'), /\d|GB|GiB|RAM|benchmark/i);
  assert.doesNotMatch(readFileSync(resolve('public/i18n/en.js'), 'utf8').match(/'chat\.firstReady': '([^']+)'/)[1], /\d|GB|GiB|RAM|benchmark/i);
});
