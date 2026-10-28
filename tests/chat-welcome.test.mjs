import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useLocale } from '../public/i18n.js';
import { writeChatOfflineLine } from '../public/chat-offline-line.js';

const PT = 'Funciona sem internet: tudo roda no seu computador';
const EN = 'Works without internet: everything runs on your computer';

function textNode(data) {
  return { nodeType: 3, data: String(data) };
}

function element() {
  const nodes = [];
  let replacements = 0;
  const el = {
    ownerDocument: { createTextNode: textNode },
    replaceChildren(...children) {
      replacements += 1;
      nodes.splice(0, nodes.length, ...children);
    },
    get textContent() {
      return nodes.map(node => node.data).join('');
    },
  };
  return {
    el,
    nodes,
    replacements: () => replacements,
  };
}

function channel(hex) {
  const value = parseInt(hex, 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground, background) {
  const lum = hex => {
    const raw = hex.slice(1);
    const r = channel(raw.slice(0, 2));
    const g = channel(raw.slice(2, 4));
    const b = channel(raw.slice(4, 6));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lighter = Math.max(lum(foreground), lum(background));
  const darker = Math.min(lum(foreground), lum(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function token(css, name, theme) {
  const darkAt = css.indexOf('html[data-theme="dark"]');
  const block = theme === 'dark' ? css.slice(darkAt) : css.slice(0, darkAt);
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `${name} (${theme})`);
  return match[1].toLowerCase();
}

test('a linha offline do chat vazio é texto traduzido, não HTML', () => {
  useLocale('pt-BR');
  const portuguese = element();
  assert.equal(writeChatOfflineLine(portuguese.el), PT);
  assert.equal(portuguese.el.textContent, PT);
  assert.equal(portuguese.nodes.length, 1);
  assert.equal(portuguese.nodes[0].nodeType, 3);
  assert.equal(portuguese.nodes[0].data, PT);
  assert.equal(writeChatOfflineLine(portuguese.el), PT);
  assert.equal(portuguese.replacements(), 1);
  assert.equal(writeChatOfflineLine(null), '');

  useLocale('en');
  try {
    const english = element();
    assert.equal(writeChatOfflineLine(english.el), EN);
    assert.equal(english.nodes[0].nodeType, 3);
    assert.equal(english.nodes[0].data, EN);
    assert.doesNotMatch(english.el.textContent, /<[^>]+>/);
  } finally {
    useLocale('pt-BR');
  }
});

test('o estado vazio reserva um nó e só então escreve a tradução', () => {
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const helper = readFileSync(resolve('public/chat-offline-line.js'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const start = chat.indexOf('<div class="chat-welcome">');
  assert.ok(start > 0);
  const welcome = chat.slice(start, chat.indexOf('`;', start));
  assert.match(welcome, /<p class="chat-offline-line" data-chat-offline><\/p>/);
  assert.equal((welcome.match(/data-chat-offline/g) || []).length, 1);
  assert.doesNotMatch(welcome, /chat\.welcome\.offline|Funciona sem internet|localneuron\.ai/);
  assert.match(chat, /querySelectorAll\("\[data-chat-offline\]"\)/);
  assert.match(chat, /writeChatOfflineLine\(node\)/);
  assert.doesNotMatch(chat, /innerHTML\s*=\s*[^;\n]*chat\.welcome\.offline/);
  assert.match(helper, /setText\(node, 'chat\.welcome\.offline'\)/);
  assert.doesNotMatch(helper, /innerHTML|fetch\(|XMLHttpRequest|WebSocket|localneuron\.ai|openExternal/);
  assert.match(server, /'\/chat-offline-line\.js':\['chat-offline-line\.js','application\/javascript'\]/);
});

test('a linha discreta usa 12px e o texto secundário passa de 4,5:1', () => {
  const css = readFileSync(resolve('public/design-system.css'), 'utf8');
  const start = css.indexOf('body.chat-page .chat-welcome p.chat-offline-line');
  assert.ok(start > 0);
  const rule = css.slice(start, css.indexOf('}', start) + 1);
  assert.match(rule, /color:\s*var\(--muted\)/);
  assert.match(rule, /font-size:\s*12px/);
  assert.match(rule, /font-weight:\s*400/);
  assert.match(rule, /line-height:\s*1\.5/);
  assert.doesNotMatch(rule, /var\(--faint\)|content:|aria-hidden/);
  const tokens = readFileSync(resolve('public/tokens.css'), 'utf8');
  for (const theme of ['light', 'dark']) {
    const ratio = contrast(token(tokens, 'muted', theme), token(tokens, 'bg', theme));
    assert.ok(ratio >= 4.5, `${theme} ${ratio.toFixed(2)}`);
  }
});
