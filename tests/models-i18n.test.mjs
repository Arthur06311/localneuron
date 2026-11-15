import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ptBR from '../public/i18n/pt-BR.js';
import en from '../public/i18n/en.js';
import { t, useLocale } from '../public/i18n.js';
import { FAMILY_ALL, MODEL_FILTERS, emptyCatalogAction, emptyCatalogMessageKey, modelMatchesFilter } from '../public/model-filters.js';
import { starterSuggestionHtml } from '../public/starter-model.js';

const ORIGINAL_FILTERS = [
  'Todos',
  'Acesso público',
  'Motor compatível',
  'Motores embutidos',
  'Favoritos',
  'Baixados',
  'Cabe agora',
  'Conversa',
  'Código',
  'Escrita',
  'Raciocínio',
  'Imagem',
  'Vídeo',
  'Pronto para gerar',
  'Para este PC',
  'Grandes · 70B+',
];

test('os filtros da biblioteca usam ids estáveis e só traduzem o rótulo', () => {
  assert.deepEqual(MODEL_FILTERS.map(filter => filter.id), [
    'all',
    'public-access',
    'compatible-engine',
    'built-in',
    'favorites',
    'downloaded',
    'fits-now',
    'conversation',
    'code',
    'writing',
    'reasoning',
    'image',
    'video',
    'ready-to-generate',
    'this-pc',
    'large-70b',
  ]);
  assert.equal(FAMILY_ALL, 'all');
  useLocale('pt-BR');
  assert.deepEqual(MODEL_FILTERS.map(filter => t(filter.key)), ORIGINAL_FILTERS);
  useLocale('en');
  try {
    const labels = MODEL_FILTERS.map(filter => t(filter.key));
    assert.deepEqual(labels, [
      'All',
      'Public access',
      'Compatible engine',
      'Built-in engines',
      'Favorites',
      'Downloaded',
      'Fits now',
      'Chat',
      'Code',
      'Writing',
      'Reasoning',
      'Image',
      'Video',
      'Ready to generate',
      'For this PC',
      'Large · 70B+',
    ]);
    assert.equal(labels.some(label => ORIGINAL_FILTERS.includes(label)), false);
    assert.equal(t('models.title'), 'AI models');
    assert.equal(t('models.eyebrow'), 'LOCAL LIBRARY');
  } finally {
    useLocale('pt-BR');
  }
  assert.equal(t('models.title'), 'Modelos de IA');
  assert.equal(t('models.eyebrow'), 'BIBLIOTECA LOCAL');
  for (const filter of MODEL_FILTERS) {
    assert.equal(typeof ptBR[filter.key], 'string');
    assert.equal(typeof en[filter.key], 'string');
    assert.notEqual(en[filter.key], '');
  }
});

test('a lógica dos filtros ignora o idioma e o texto do rótulo', () => {
  const library = {
    available_memory_bytes: 8 * 1073741824,
    total_memory_bytes: 16 * 1073741824,
    media_downloads: { jobs: [] },
    media_profiles: [],
  };
  const favorites = new Set(['fav']);
  const chat = { id: 'chat', categories: ['Conversa'], external: false, ram_gib: 4, computer_ram_gib: 8, parameters_b: 7 };
  const huge = { id: 'huge', categories: ['Raciocínio'], external: false, ram_gib: 40, computer_ram_gib: 64, parameters_b: 70 };
  const image = { id: 'image', categories: ['Imagem'], external: true, local_profile: 'sd' };
  const favorite = { id: 'fav', categories: ['Código'], availability: { access: 'public' } };
  assert.equal(modelMatchesFilter(chat, 'conversation', library, favorites), true);
  assert.equal(modelMatchesFilter(chat, 'Chat', library, favorites), false);
  assert.equal(modelMatchesFilter(chat, 'Conversa', library, favorites), false);
  assert.equal(modelMatchesFilter(chat, 'fits-now', library, favorites), true);
  assert.equal(modelMatchesFilter(huge, 'fits-now', library, favorites), false);
  assert.equal(modelMatchesFilter(chat, 'this-pc', library, favorites), true);
  assert.equal(modelMatchesFilter(huge, 'this-pc', library, favorites), false);
  assert.equal(modelMatchesFilter(huge, 'large-70b', library, favorites), true);
  assert.equal(modelMatchesFilter(chat, 'large-70b', library, favorites), false);
  assert.equal(modelMatchesFilter(image, 'image', library, favorites), true);
  assert.equal(modelMatchesFilter(image, 'ready-to-generate', library, favorites), true);
  assert.equal(modelMatchesFilter(image, 'fits-now', library, favorites), false);
  assert.equal(modelMatchesFilter(favorite, 'favorites', library, favorites), true);
  assert.equal(modelMatchesFilter(favorite, 'public-access', library, favorites), true);
  assert.equal(modelMatchesFilter(chat, 'all', library, favorites), true);
  const app = readFileSync(resolve('public/app.js'), 'utf8');
  assert.match(app, /data-model-filter="\$\{filter\.id\}"/);
  assert.match(app, /modelMatchesFilter\(m,modelFilter,s,modelFavorites\)/);
  assert.doesNotMatch(app, /modelFilter==='Todos'|modelFilter==='Cabe agora'|modelFilter==='Para este PC'|modelFilter==='Grandes/);
  assert.equal(app.includes("'fits-now'"), false);
  assert.match(readFileSync(resolve('public/model-filters.js'), 'utf8'), /id: 'fits-now'/);
  assert.match(readFileSync(resolve('public/model-filters.js'), 'utf8'), /id: 'this-pc'/);
});

test('Cabe agora vazio explica a memória livre e leva a Para este PC', () => {
  assert.equal(emptyCatalogMessageKey('fits-now'), 'models.results.fitsNowNone');
  assert.deepEqual(emptyCatalogAction('fits-now'), { filterId: 'this-pc', labelKey: 'models.results.fitsNowAction' });
  for (const filter of MODEL_FILTERS) {
    if (filter.id === 'fits-now') continue;
    assert.equal(emptyCatalogMessageKey(filter.id), 'models.results.none');
    assert.equal(emptyCatalogAction(filter.id), null);
  }
  assert.equal(emptyCatalogMessageKey(''), 'models.results.none');
  assert.equal(emptyCatalogAction(undefined), null);

  useLocale('pt-BR');
  assert.equal(t('models.results.none'), 'Nenhum modelo encontrado. Tente outro uso, nome ou família.');
  assert.equal(
    t('models.results.fitsNowNone'),
    'Nenhum modelo cabe na memória livre agora. Feche outros apps ou veja os modelos para este PC.',
  );
  assert.equal(t('models.results.fitsNowAction'), 'Ver modelos para este PC');
  useLocale('en');
  try {
    assert.equal(t('models.results.none'), 'No model found. Try another use, name, or family.');
    assert.equal(
      t('models.results.fitsNowNone'),
      'No model fits in free memory right now. Close other apps or see the models for this PC.',
    );
    assert.equal(t('models.results.fitsNowAction'), 'See models for this PC');
  } finally {
    useLocale('pt-BR');
  }

  const app = readFileSync(resolve('public/app.js'), 'utf8');
  assert.match(app, /const query=normalize\(modelSearch\)\.trim\(\)/);
  assert.match(app, /emptyCatalogAction\(modelFilter,query,modelFamily\)/);
  assert.match(app, /t\(emptyCatalogMessageKey\(modelFilter,query,modelFamily\)\)/);
  assert.match(app, /<button type="button" class="secondary" data-model-filter="\$\{emptyAction\.filterId\}">/);
  assert.match(app, /button\.hasAttribute\('data-model-filter'\)/);
  assert.match(app, /modelFilter=button\.dataset\.modelFilter/);
  assert.equal(app.includes("'fits-now'"), false);
  assert.equal(app.includes("'this-pc'"), false);
  assert.equal(app.includes('models.results.none'), false);
});

test('busca ou família ativas no Cabe agora voltam ao aviso genérico', () => {
  const action = { filterId: 'this-pc', labelKey: 'models.results.fitsNowAction' };
  assert.equal(emptyCatalogMessageKey('fits-now', '', FAMILY_ALL), 'models.results.fitsNowNone');
  assert.deepEqual(emptyCatalogAction('fits-now', '', FAMILY_ALL), action);

  assert.equal(emptyCatalogMessageKey('fits-now', 'xyz', FAMILY_ALL), 'models.results.none');
  assert.equal(emptyCatalogAction('fits-now', 'xyz', FAMILY_ALL), null);
  assert.equal(emptyCatalogMessageKey('fits-now', 'xyz', 'Qwen'), 'models.results.none');
  assert.equal(emptyCatalogAction('fits-now', 'xyz', 'Qwen'), null);

  assert.equal(emptyCatalogMessageKey('fits-now', '', 'Qwen'), 'models.results.none');
  assert.equal(emptyCatalogAction('fits-now', '', 'Qwen'), null);
  assert.equal(emptyCatalogMessageKey('this-pc', '', 'Llama'), 'models.results.none');
  assert.equal(emptyCatalogAction('all', 'xyz', FAMILY_ALL), null);

  useLocale('pt-BR');
  assert.equal(t('models.results.none'), 'Nenhum modelo encontrado. Tente outro uso, nome ou família.');
  assert.equal(
    t('models.results.fitsNowNone'),
    'Nenhum modelo cabe na memória livre agora. Feche outros apps ou veja os modelos para este PC.',
  );
});

test('o início rápido continua igual em pt-BR e muda em inglês', () => {
  const escape = value => String(value);
  useLocale('pt-BR');
  const pt = starterSuggestionHtml({ id: 'qwen', name: 'Qwen', ram_gib: 2, computer_ram_gib: 8 }, escape);
  assert.match(pt, /Início rápido\./);
  assert.match(pt, /sugerimos um único modelo: Qwen/);
  assert.match(pt, />Baixar este modelo</);
  useLocale('en');
  try {
    const english = starterSuggestionHtml({ id: 'qwen', name: 'Qwen', ram_gib: 2, computer_ram_gib: 8 }, escape);
    assert.match(english, /Quick start\./);
    assert.match(english, /we suggest a single model: Qwen/);
    assert.match(english, />Download this model</);
    assert.equal(english.includes('Baixar'), false);
  } finally {
    useLocale('pt-BR');
  }
});
