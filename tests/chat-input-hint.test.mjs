import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { t, useLocale } from '../public/i18n.js';
import {
  CHAT_INPUT_HINT_ID,
  CHAT_SENDS_KEY,
  inputHintVisible,
  readStoredSends,
  recordSentMessage,
  sentCount,
  syncChatInputHint,
} from '../public/chat-input-hint.js';

const PT = 'Enter envia · Shift+Enter quebra linha';
const EN = 'Enter sends · Shift+Enter adds a new line';

function memory(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    data,
  };
}

function hintNode() {
  const nodes = [];
  return {
    hidden: true,
    ownerDocument: {
      createTextNode(data) {
        return { nodeType: 3, data: String(data) };
      },
    },
    replaceChildren(...children) {
      nodes.splice(0, nodes.length, ...children);
    },
    get textContent() {
      return nodes.map((node) => node.data).join('');
    },
    set textContent(value) {
      nodes.splice(0, nodes.length, { nodeType: 3, data: String(value) });
    },
    nodes,
  };
}

function inputNode(describedBy = '') {
  const attrs = {};
  if (describedBy) attrs['aria-describedby'] = describedBy;
  return {
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    attrs,
  };
}

function channel(hex) {
  const value = parseInt(hex, 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground, background) {
  const lum = (hex) => {
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

test('o contador some depois de 3 envios e continua oculto ao reler o armazenamento', () => {
  assert.equal(sentCount(null), 0);
  assert.equal(sentCount(''), 0);
  assert.equal(sentCount('nope'), 0);
  assert.equal(sentCount('-2'), 0);
  assert.equal(sentCount('2'), 2);
  assert.equal(inputHintVisible({ welcome: true, sent: 0 }), false);
  assert.equal(inputHintVisible({ welcome: true, sent: 2 }), false);
  assert.equal(inputHintVisible({ welcome: false, sent: 0 }), true);
  assert.equal(inputHintVisible({ welcome: false, sent: 2 }), true);
  assert.equal(inputHintVisible({ welcome: false, sent: 3 }), false);
  assert.equal(inputHintVisible({ welcome: false, sent: 9 }), false);

  const store = memory();
  assert.equal(readStoredSends(store), 0);
  assert.equal(recordSentMessage(store), 1);
  assert.equal(recordSentMessage(store), 2);
  assert.equal(store.data[CHAT_SENDS_KEY], '2');
  assert.equal(inputHintVisible({ sent: readStoredSends(store) }), true);
  assert.equal(recordSentMessage(store), 3);
  assert.equal(recordSentMessage(store), 3);
  const reloaded = memory({ [CHAT_SENDS_KEY]: store.data[CHAT_SENDS_KEY] });
  assert.equal(readStoredSends(reloaded), 3);
  assert.equal(inputHintVisible({ welcome: false, sent: readStoredSends(reloaded) }), false);

  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readStoredSends(broken), 0);
  assert.equal(recordSentMessage(broken), 1);
  assert.equal(readStoredSends(null), 0);
  assert.equal(recordSentMessage(undefined), 1);
});

test('a dica liga aria-describedby só enquanto está visível e o texto é tradução', () => {
  useLocale('pt-BR');
  const hint = hintNode();
  const input = inputNode('effort-help');
  assert.equal(syncChatInputHint(input, hint, { welcome: true, sent: 0 }), false);
  assert.equal(hint.hidden, true);
  assert.equal(hint.textContent, '');
  assert.equal(input.attrs['aria-describedby'], 'effort-help');

  assert.equal(syncChatInputHint(input, hint, { welcome: false, sent: 1 }), true);
  assert.equal(hint.hidden, false);
  assert.equal(hint.textContent, PT);
  assert.equal(hint.nodes.length, 1);
  assert.equal(hint.nodes[0].nodeType, 3);
  assert.equal(input.attrs['aria-describedby'], `effort-help ${CHAT_INPUT_HINT_ID}`);

  assert.equal(syncChatInputHint(input, hint, { welcome: false, sent: 3 }), false);
  assert.equal(hint.hidden, true);
  assert.equal(hint.textContent, '');
  assert.equal(input.attrs['aria-describedby'], 'effort-help');

  const bare = inputNode();
  assert.equal(syncChatInputHint(bare, hint, { welcome: false, sent: 3 }), false);
  assert.equal(bare.attrs['aria-describedby'], undefined);
  assert.equal(syncChatInputHint(bare, null, { welcome: false, sent: 0 }), false);
  assert.equal(bare.attrs['aria-describedby'], undefined);

  useLocale('en');
  try {
    const english = hintNode();
    syncChatInputHint(inputNode(), english, { sent: 0 });
    assert.equal(english.textContent, EN);
    assert.equal(t('chat.input.hint'), EN);
    assert.notEqual(EN, PT);
    assert.doesNotMatch(english.textContent, /<[^>]+>/);
  } finally {
    useLocale('pt-BR');
  }
  assert.equal(t('chat.input.hint'), PT);
});

test('a dica fica sob o campo, fora do card inicial, e o contador só sobe num envio concluído', () => {
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const helper = readFileSync(resolve('public/chat-input-hint.js'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const welcomeAt = chat.indexOf('<div class="chat-welcome">');
  assert.ok(welcomeAt > 0);
  const welcome = chat.slice(welcomeAt, chat.indexOf('`;', welcomeAt));
  assert.doesNotMatch(welcome, /chat-input-hint|chat\.input\.hint/);

  const formAt = chat.indexOf('<form id="chat-form"');
  const composer = chat.slice(formAt, chat.indexOf('</form>', formAt));
  const field = composer.match(/<textarea id="chat-input"[^>]*>/);
  const hint = composer.match(/<p id="chat-input-hint"[^>]*>/);
  assert.ok(field);
  assert.ok(hint);
  assert.ok(composer.indexOf(field[0]) < composer.indexOf(hint[0]));
  assert.ok(composer.indexOf(hint[0]) < composer.indexOf('<div class="composer-bottom">'));
  assert.match(hint[0], /class="chat-input-hint"/);
  assert.match(hint[0], /data-i18n="chat\.input\.hint"/);
  assert.match(hint[0], /\shidden/);
  assert.doesNotMatch(hint[0], /aria-|role=/);
  assert.doesNotMatch(field[0], /aria-describedby/);
  assert.match(chat, /welcome: messages\.length === 0/);
  assert.match(chat, /readStoredSends\(localStorage\)/);
  assert.doesNotMatch(chat, /chat\.status\.hint/);

  const sendAt = chat.indexOf('async function send');
  const send = chat.slice(sendAt, chat.indexOf('document.addEventListener("input"', sendAt));
  const posted = send.indexOf('/send');
  const counted = send.indexOf('if (!retry) {');
  assert.ok(posted > 0 && counted > posted);
  assert.match(send.slice(counted, counted + 180), /recordSentMessage\(localStorage\)/);
  assert.equal(send.slice(0, posted).includes('recordSentMessage'), false);

  assert.match(server, /'\/chat-input-hint\.js':\['chat-input-hint\.js','application\/javascript'\]/);
  assert.match(helper, /localneuron-chat-sends/);
  assert.doesNotMatch(helper, /innerHTML|fetch\(|XMLHttpRequest|COLMEIA_|animation/);
});

test('a dica usa 12px, sem animação, e o cinza passa de 4,5:1 no claro e no escuro', () => {
  const css = readFileSync(resolve('public/design-system.css'), 'utf8');
  const start = css.indexOf('body.chat-page .chat-composer p.chat-input-hint {');
  assert.ok(start > 0);
  const rule = css.slice(start, css.indexOf('}', start) + 1);
  assert.match(rule, /margin:\s*2px 0 0/);
  assert.match(rule, /color:\s*var\(--muted\)/);
  assert.match(rule, /font-size:\s*12px/);
  assert.match(rule, /font-weight:\s*400/);
  assert.match(rule, /line-height:\s*1\.5/);
  assert.doesNotMatch(rule, /animation|transition|@keyframes|var\(--faint\)/);
  const hiddenAt = css.indexOf('body.chat-page .chat-composer p.chat-input-hint[hidden]');
  const hidden = css.slice(hiddenAt, css.indexOf('}', hiddenAt) + 1);
  assert.match(hidden, /display:\s*none/);
  const tokens = readFileSync(resolve('public/tokens.css'), 'utf8');
  for (const theme of ['light', 'dark']) {
    for (const background of ['panel', 'bg']) {
      const ratio = contrast(token(tokens, 'muted', theme), token(tokens, background, theme));
      assert.ok(ratio >= 4.5, `${theme} ${background} ${ratio.toFixed(2)}`);
    }
  }
});
