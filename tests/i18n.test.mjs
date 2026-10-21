import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ptBR from '../public/i18n/pt-BR.js';
import en from '../public/i18n/en.js';
import { applyDocument, format, localeFromLanguage, resolveLocale, setText, t, useLocale } from '../public/i18n.js';

test('pt vira pt-BR e qualquer outro idioma vira inglês', () => {
  assert.equal(localeFromLanguage('pt-BR'), 'pt-BR');
  assert.equal(localeFromLanguage('pt'), 'pt-BR');
  assert.equal(localeFromLanguage('pt-PT'), 'pt-BR');
  assert.equal(localeFromLanguage('en-US'), 'en');
  assert.equal(localeFromLanguage('fr'), 'en');
  assert.equal(localeFromLanguage(''), 'en');
  assert.equal(localeFromLanguage(undefined), 'en');
});

test('consulta, ambiente, escolha salva e sistema seguem essa ordem', () => {
  assert.equal(resolveLocale({ storage: 'pt-BR', system: 'en-US' }), 'pt-BR');
  assert.equal(resolveLocale({ storage: 'en', system: 'pt-BR' }), 'en');
  assert.equal(resolveLocale({ storage: 'auto', system: 'pt-BR' }), 'pt-BR');
  assert.equal(resolveLocale({ storage: 'auto', system: 'de' }), 'en');
  assert.equal(resolveLocale({ storage: '', system: '' }), 'en');
  assert.equal(resolveLocale({ storage: 'pt-BR', env: 'en', system: 'pt-BR' }), 'en');
  assert.equal(resolveLocale({ query: '?lang=en', env: 'pt-BR', storage: 'pt-BR', system: 'pt-BR' }), 'en');
  assert.equal(resolveLocale({ query: 'lang=pt', env: 'en', storage: 'en', system: 'en-US' }), 'pt-BR');
  assert.equal(resolveLocale({ query: '?lang=en-US', storage: 'pt-BR' }), 'en');
  assert.equal(resolveLocale({ query: '?lang=auto', storage: 'en', system: 'pt' }), 'en');
  assert.equal(resolveLocale({ storage: 'auto', desktopLocale: 'pt-BR', system: 'en-US' }), 'pt-BR');
  assert.equal(resolveLocale({ storage: 'en', desktopLocale: 'pt-BR', system: 'pt-BR' }), 'en');
});

test('chave ausente em inglês volta ao português e o Chat em pt-BR não muda', () => {
  useLocale('en');
  try {
    assert.equal(t('i18n.fallbackProbe'), 'texto só em português');
    assert.equal(t('missing.key'), '');
    assert.equal(t('chat.welcome.title'), 'How can I help?');
    assert.equal(t('chat.welcome.eyebrow'), 'YOUR LOCAL ASSISTANT');
    assert.equal(t('nav.work'), 'Work');
    assert.equal(t('nav.account'), 'Account');
    assert.equal(format('chat.internet.on', { unused: 'x' }), 'Internet on');
  } finally {
    useLocale('pt-BR');
  }
  assert.equal(t('chat.welcome.title'), 'Como posso ajudar?');
  assert.equal(t('chat.welcome.eyebrow'), 'SEU ASSISTENTE LOCAL');
  assert.equal(t('chat.internet.on'), 'Internet habilitada');
  assert.equal(t('chat.internet.off'), 'Internet desligada');
  assert.equal(t('nav.work'), 'Trabalhar');
  assert.equal(t('nav.account'), 'Conta');
  assert.equal(format('settings.updatesAvailable', { version: '0.28.1' }), 'Versão 0.28.1 disponível.');
});

test('um valor interpolado com HTML é desenhado como texto', () => {
  const nodes = [];
  const el = {
    ownerDocument: {
      createTextNode(data) {
        return { nodeType: 3, data: String(data) };
      },
    },
    replaceChildren(...children) {
      nodes.splice(0, nodes.length, ...children);
    },
    get textContent() {
      return nodes.map(node => node.data).join('');
    },
  };
  const payload = '<img src=x onerror=alert(1)><b>1</b>';
  setText(el, 'settings.updatesAvailable', { version: payload });
  assert.equal(el.textContent, `Versão ${payload} disponível.`);
  assert.deepEqual(
    nodes.map(node => node.data),
    ['Versão ', payload, ' disponível.'],
  );
  assert.equal(nodes.every(node => node.nodeType === 3), true);
});

test('o documento recebe lang e o HTML não fixa pt-BR', () => {
  const html = readFileSync(resolve('public/index.html'), 'utf8');
  assert.doesNotMatch(html.split('<head>', 1)[0], /\slang=/);
  const strong = { textContent: 'Trabalhar' };
  const chat = { getAttribute: () => 'nav.chat', textContent: ' Chat' };
  const doc = {
    documentElement: {},
    querySelector: () => null,
    querySelectorAll(selector) {
      if (selector === '[data-i18n-strong]') return [{ getAttribute: () => 'nav.work', querySelector: () => strong }];
      if (selector === '[data-i18n]') return [chat];
      return [];
    },
  };
  useLocale('en');
  try {
    applyDocument(doc);
  } finally {
    useLocale('pt-BR');
  }
  assert.equal(doc.documentElement.lang, 'en');
  assert.equal(strong.textContent, 'Work');
  assert.equal(chat.textContent, 'Chat');
});

test('as chaves usadas existem e o inglês cobre o português, salvo a prova de fallback', () => {
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== 'i18n' && name !== 'vendor') walk(path);
      } else if (name.endsWith('.js') || name.endsWith('.html')) files.push(path);
    }
  };
  walk(resolve('public'));
  const used = new Set();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\b(?:t|format|setText)\(\s*(?:[^)'"]*,\s*)?['"]([a-zA-Z0-9_.]+)['"]/g)) used.add(match[1]);
    for (const match of source.matchAll(/data-i18n(?:-aria|-title|-placeholder|-strong)?="([a-zA-Z0-9_.]+)"/g)) used.add(match[1]);
  }
  const missingPt = [...used].filter(key => !(key in ptBR)).sort();
  assert.deepEqual(missingPt, []);
  const onlyPt = Object.keys(ptBR).filter(key => !(key in en) && key !== 'i18n.fallbackProbe').sort();
  const onlyEn = Object.keys(en).filter(key => !(key in ptBR)).sort();
  assert.deepEqual(onlyPt, []);
  assert.deepEqual(onlyEn, []);
  assert.equal(en['i18n.fallbackProbe'], undefined);
  const markup = [...Object.values(ptBR), ...Object.values(en)].filter(value => /[<>]/.test(value));
  assert.deepEqual(markup, []);
});

test('o caminho Trabalhar / Conta sai dos nomes da ilha e esses nomes traduzem', () => {
  const app = readFileSync(resolve('public/app.js'), 'utf8');
  const html = readFileSync(resolve('public/index.html'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  assert.match(app, /function breadcrumbLabel/);
  assert.match(app, /nav-island-trigger strong/);
  assert.match(app, /querySelector\('\[data-i18n\]'\)/);
  assert.doesNotMatch(app, /Conversas \/ Chat|Biblioteca \/ Modelos|Ajustes \/ Configurações|Equipes \/ Equipes/);
  assert.match(html, /<strong>Trabalhar<\/strong>/);
  assert.match(html, /<strong>Conta<\/strong>/);
  assert.match(html, /data-i18n-strong="nav\.work"/);
  assert.match(html, /data-i18n-strong="nav\.account"/);
  assert.match(server, /staticFiles\[request\.url\.split\('\?'\)\[0\]\]/);
  assert.match(server, /'\/i18n\.js'/);
  assert.match(server, /'\/i18n\/pt-BR\.js'/);
  assert.match(server, /'\/i18n\/en\.js'/);
});
