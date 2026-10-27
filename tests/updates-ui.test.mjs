import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ptBR from '../public/i18n/pt-BR.js';
import en from '../public/i18n/en.js';
import { t, useLocale } from '../public/i18n.js';
import { createUX } from '../public/ux.js';

const PT_ERROR = 'Não foi possível verificar atualizações. Verifique sua conexão.';
const EN_ERROR = 'Could not check for updates. Check your connection.';

function decode(value) {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function createDocument() {
  const voidTags = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR']);
  function make(tag, ownerDocument) {
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      ownerDocument,
      parentNode: null,
      childNodes: [],
      attrs: new Map(),
      className: '',
      disabled: false,
      checked: false,
      onclick: null,
      onchange: null,
      listeners: new Map(),
      open: false,
      setAttribute(name, value) {
        this.attrs.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
      },
      getAttribute(name) {
        return this.attrs.has(name) ? this.attrs.get(name) : null;
      },
      hasAttribute(name) {
        return this.attrs.has(name);
      },
      removeAttribute(name) {
        this.attrs.delete(name);
      },
      append(child) {
        child.parentNode = this;
        this.childNodes.push(child);
      },
      remove() {
        this.parentNode?.childNodes && (this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this));
        this.parentNode = null;
      },
      addEventListener(type, fn) {
        const list = this.listeners.get(type) || [];
        list.push(fn);
        this.listeners.set(type, list);
      },
      close() {
        this.open = false;
        for (const fn of this.listeners.get('close') || []) fn();
      },
      showModal() {
        this.open = true;
      },
      querySelector(selector) {
        return find(this, selector);
      },
      replaceChildren(...nodes) {
        this.childNodes = nodes;
        for (const node of nodes) node.parentNode = this;
      },
    };
    Object.defineProperty(el, 'hidden', {
      get() {
        return el.hasAttribute('hidden');
      },
      set(value) {
        if (value) el.setAttribute('hidden', '');
        else el.removeAttribute('hidden');
      },
    });
    Object.defineProperty(el, 'textContent', {
      get() {
        return el.childNodes.map(node => (node.nodeType === 3 ? node.data : node.textContent)).join('');
      },
      set(value) {
        el.replaceChildren(ownerDocument.createTextNode(value));
      },
    });
    Object.defineProperty(el, 'innerHTML', {
      set(html) {
        const nodes = parseFragment(String(html), ownerDocument);
        el.childNodes = nodes;
        for (const node of nodes) node.parentNode = el;
      },
    });
    return el;
  }
  function matches(el, selector) {
    if (selector.startsWith('#')) return el.id === selector.slice(1);
    if (selector.startsWith('.')) return el.className.split(/\s+/).includes(selector.slice(1));
    const attr = /^\[([^\]=~]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attr) return attr[2] === undefined ? el.hasAttribute(attr[1]) : el.getAttribute(attr[1]) === attr[2];
    return el.tagName === selector.toUpperCase();
  }
  function find(root, selector) {
    for (const node of root.childNodes || []) {
      if (node.nodeType !== 1) continue;
      if (matches(node, selector)) return node;
      const nested = find(node, selector);
      if (nested) return nested;
    }
    return null;
  }
  function parseFragment(html, ownerDocument) {
    const roots = [];
    const stack = [{ childNodes: roots }];
    const re = /<!--[\s\S]*?-->|<\/([A-Za-z0-9-]+)>|<([A-Za-z0-9-]+)([^>]*?)(\/?)>|([^<]+)/g;
    for (const match of html.matchAll(re)) {
      if (match[1]) {
        const name = match[1].toUpperCase();
        while (stack.length > 1 && stack.at(-1).tagName !== name) stack.pop();
        if (stack.length > 1) stack.pop();
      } else if (match[2]) {
        const el = make(match[2], ownerDocument);
        const attrs = match[3] || '';
        for (const attr of attrs.matchAll(/([^\s=\/]+)(?:\s*=\s*"([^"]*)")?/g)) {
          if (attr[1] === '/') continue;
          el.setAttribute(attr[1], decode(attr[2] ?? ''));
          if (attr[1] === 'checked') el.checked = true;
        }
        const parent = stack.at(-1);
        parent.childNodes.push(el);
        el.parentNode = parent.tagName ? parent : null;
        if (!match[4] && !voidTags.has(el.tagName)) stack.push(el);
      } else if (match[5]) {
        stack.at(-1).childNodes.push(ownerDocument.createTextNode(decode(match[5])));
      }
    }
    return roots;
  }
  const doc = {
    createElement(tag) {
      return make(tag, doc);
    },
    createTextNode(data) {
      return { nodeType: 3, data: String(data), textContent: String(data), parentNode: null };
    },
    querySelector(selector) {
      return find(doc.body, selector);
    },
  };
  doc.body = make('body', doc);
  return doc;
}

function textNodes(el) {
  return (el?.childNodes || []).filter(node => node.nodeType === 3);
}

test('catálogos e o resultado da consulta usam a mesma mensagem clara', () => {
  const updates = readFileSync(new URL('../src/updates.ts', import.meta.url), 'utf8');
  const ux = readFileSync(new URL('../public/ux.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/ux.css', import.meta.url), 'utf8');
  assert.equal(ptBR['settings.updatesError'], PT_ERROR);
  assert.equal(ptBR['settings.updatesRetry'], 'Tentar de novo');
  assert.equal(en['settings.updatesError'], EN_ERROR);
  assert.equal(en['settings.updatesRetry'], 'Try again');
  assert.match(updates, /Não foi possível verificar atualizações\. Verifique sua conexão\./);
  assert.match(ux, /setText\(errorBox\.querySelector\('\[data-update-error\]'\),'settings\.updatesError'\)/);
  assert.match(ux, /setText\(dialogError\.querySelector\('\[data-update-dialog-error-text\]'\),'settings\.updatesError'\)/);
  assert.match(ux, /textContent=t\('settings\.updatesRetry'\)/);
  assert.match(ux, /class="secondary"[^>]*data-update-retry/);
  assert.doesNotMatch(ux, /textContent=state\.error/);
  assert.doesNotMatch(ux, /\$\{E\(state\.error\)\}/);
  assert.match(css, /\.update-check-error\{[^}]*gap:8px 12px[^}]*padding:10px 12px[^}]*border-radius:6px[^}]*font-size:13px[^}]*line-height:1\.5/);
  assert.match(css, /\.update-check-error \.secondary\{flex:0 0 auto\}/);
});

test('falha na verificação mostra a mensagem traduzida e Tentar de novo refaz a consulta', async () => {
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...rest) => {
    const id = originalInterval(fn, ms, ...rest);
    id?.unref?.();
    return id;
  };
  const previousDocument = globalThis.document;
  const previousLocale = 'pt-BR';
  const doc = createDocument();
  globalThis.document = doc;
  const panel = doc.createElement('section');
  panel.id = 'updates-settings';
  doc.body.append(panel);
  const access = doc.createElement('section');
  access.id = 'access-settings';
  doc.body.append(access);
  const calls = [];
  const toasts = [];
  let mode = 'error';
  const api = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body });
    if (path === '/vault/legacy') return { backups: [] };
    if (path === '/updates/check' && mode === 'throw') throw new Error('Failed to fetch');
    if (path === '/updates' || path === '/updates/check') {
      const failed = mode === 'error';
      return {
        current: '0.28.1',
        automatic: false,
        checked_at: failed ? 0 : 1_735_689_600_000,
        checking: false,
        error: failed ? '<img src=x onerror=alert(1)>' : '',
        available: false,
        dismissed: false,
        offer: null,
        release: null,
      };
    }
    throw new Error(path);
  };
  try {
    useLocale('pt-BR');
    const ux = createUX({ api, escape: value => String(value), toast: message => toasts.push(message), isUnlocked: () => true });
    await ux.settings();
    const error = doc.querySelector('[data-update-error]');
    const retry = doc.querySelector('[data-update-retry]');
    const box = doc.querySelector('[data-update-error-box]');
    assert.equal(box.hidden, false);
    assert.equal(error.textContent, PT_ERROR);
    assert.equal(retry.textContent, t('settings.updatesRetry'));
    assert.equal(retry.className, 'secondary');
    assert.deepEqual(textNodes(error).map(node => node.data), [PT_ERROR]);
    assert.equal(error.querySelector?.('img') || doc.querySelector('img'), null);
    assert.equal(error.textContent.includes('<img'), false);
    assert.equal(doc.querySelector('[data-update-status]').hidden, true);

    mode = 'ok';
    await retry.onclick();
    const check = calls.filter(call => call.path === '/updates/check');
    assert.equal(check.length, 1);
    assert.deepEqual(check[0].body, { force: true });
    assert.equal(doc.querySelector('[data-update-error-box]').hidden, true);
    assert.equal(doc.querySelector('[data-update-status]').hidden, false);
    assert.match(doc.querySelector('[data-update-status]').textContent, /Última consulta:/);
    assert.equal(toasts.length, 0);

    mode = 'error';
    await ux.settings();
    await doc.querySelector('#updates-details').onclick();
    const dialog = doc.querySelector('#update-dialog');
    const dialogText = dialog.querySelector('[data-update-dialog-error-text]');
    const dialogRetry = dialog.querySelector('[data-update-dialog-retry]');
    assert.equal(dialog.querySelector('[data-update-dialog-error]').hidden, false);
    assert.equal(dialogText.textContent, PT_ERROR);
    assert.equal(dialogRetry.textContent, 'Tentar de novo');
    assert.deepEqual(textNodes(dialogText).map(node => node.data), [PT_ERROR]);
    mode = 'ok';
    await dialogRetry.onclick();
    assert.equal(doc.querySelector('#update-dialog'), null);
    assert.equal(calls.filter(call => call.path === '/updates/check').at(-1).body.force, true);

    useLocale('en');
    mode = 'error';
    await ux.settings();
    assert.equal(doc.querySelector('[data-update-error]').textContent, EN_ERROR);
    assert.equal(doc.querySelector('[data-update-retry]').textContent, 'Try again');
    await doc.querySelector('#updates-details').onclick();
    assert.equal(doc.querySelector('[data-update-dialog-error-text]').textContent, EN_ERROR);
    assert.equal(doc.querySelector('[data-update-dialog-retry]').textContent, 'Try again');

    useLocale('pt-BR');
    mode = 'ok';
    await ux.settings();
    assert.equal(doc.querySelector('[data-update-error-box]').hidden, true);
    mode = 'throw';
    toasts.length = 0;
    await doc.querySelector('#updates-check').onclick({ target: doc.querySelector('#updates-check') });
    assert.equal(doc.querySelector('[data-update-error]').textContent, PT_ERROR);
    assert.equal(doc.querySelector('[data-update-retry]').textContent, 'Tentar de novo');
    assert.deepEqual(toasts, []);
  } finally {
    useLocale(previousLocale);
    globalThis.setInterval = originalInterval;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
