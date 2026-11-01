import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useLocale } from '../public/i18n.js';
import {
  conversationStarted,
  guestStartHtml,
  guestStartNext,
  guestStartPrompt,
  guestStartState,
  modelForGuestStart,
  showGuestStart,
} from '../public/guest-start.js';

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

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

test('o card só aparece no chat vazio da primeira sessão', () => {
  assert.equal(guestStartState('dismissed'), 'dismissed');
  assert.equal(guestStartState('used'), 'used');
  assert.equal(guestStartState('outro'), '');
  assert.equal(showGuestStart(), true);
  assert.equal(showGuestStart({ state: '', messages: [], chats: [] }), true);
  assert.equal(showGuestStart({ state: 'dismissed', messages: [], chats: [] }), false);
  assert.equal(showGuestStart({ state: 'used', messages: [], chats: [] }), false);
  assert.equal(showGuestStart({ messages: [{ role: 'user', content: 'olá' }] }), false);
  const used = [{ id: 'a', messages: [{ role: 'user', content: 'já falei' }] }];
  assert.equal(conversationStarted(used), true);
  assert.equal(showGuestStart({ messages: [], chats: used }), false);
  assert.equal(showGuestStart({ messages: [], chats: [{ id: 'vazio', messages: [] }] }), true);
  assert.equal(guestStartNext('', { chats: used }), 'used');
  assert.equal(guestStartNext('', { dismiss: true }), 'dismissed');
  assert.equal(guestStartNext('used', { dismiss: true }), 'used');
  assert.equal(guestStartNext('dismissed', { chats: [] }), 'dismissed');
  assert.equal(guestStartNext('', {}), '');
});

test('os três pedidos saem em pt-BR e em inglês, sem preço nem nuvem', () => {
  useLocale('pt-BR');
  const portuguese = guestStartHtml(escape);
  assert.match(portuguese, /Comece sem conta/);
  assert.match(portuguese, /Resumir um texto/);
  assert.match(portuguese, /Escrever um e-mail/);
  assert.match(portuguese, /Explicar um conceito/);
  assert.match(portuguese, /data-guest-start="summarize"/);
  assert.match(portuguese, /data-guest-start="email"/);
  assert.match(portuguese, /data-guest-start="explain"/);
  assert.match(portuguese, /data-guest-start-close/);
  assert.match(portuguese, /aria-labelledby="guest-start-title"/);
  assert.match(portuguese, /aria-label="Fechar sugestões"/);
  assert.match(portuguese, /role="region"/);
  assert.equal(guestStartPrompt('summarize').includes('Comece pedindo o texto'), true);
  assert.equal(guestStartPrompt('email').includes('e-mail'), true);
  assert.equal(guestStartPrompt('explain').includes('conceito'), true);
  assert.equal(guestStartPrompt('outro'), '');
  assert.doesNotMatch(portuguese, /stripe|preço|telemetria|licença|notariz|Minha API|EXO|exo:/i);
  const marked = guestStartHtml((value) => `ESC:${escape(value)}`);
  assert.match(marked, /ESC:Comece sem conta/);
  assert.match(marked, /aria-label="ESC:Fechar sugestões"/);
  assert.doesNotMatch(marked, /<(?!\/?(?:section|div|span|h3|p|button|strong|small)\b)[^>]*>/);

  useLocale('en');
  try {
    const english = guestStartHtml(escape);
    assert.match(english, /Start without an account/);
    assert.match(english, /Summarize a text/);
    assert.match(english, /Write an email/);
    assert.match(english, /Explain a concept/);
    assert.match(english, /aria-label="Close suggestions"/);
    assert.equal(guestStartPrompt('summarize').includes('asking me for the text'), true);
    assert.doesNotMatch(english, /Comece sem conta|Resumir um texto/);
  } finally {
    useLocale('pt-BR');
  }
});

test('o clique usa o menor modelo local e não a rede', () => {
  const catalog = [
    { local_key: 'gguf:tiny', parameters_b: 1.5, name: 'Pequeno' },
    { local_key: 'gguf:mid', parameters_b: 14, name: 'Médio' },
    { local_key: 'gguf:huge', parameters_b: 70, name: 'Grande' },
  ];
  const installed = [
    { key: 'gguf:mid', display_name: 'Médio', size_bytes: 8e9 },
    { key: 'gguf:huge', display_name: 'Grande', size_bytes: 40e9 },
    { key: 'gguf:tiny', display_name: 'Pequeno', size_bytes: 1e9 },
    { key: 'exo:cluster', display_name: 'Rede', size_bytes: 1 },
  ];
  assert.equal(modelForGuestStart({ installed, catalog }), 'gguf:tiny');
  assert.equal(modelForGuestStart({ installed: [{ key: 'exo:cluster', size_bytes: 1 }], catalog: [] }), '');
  assert.equal(
    modelForGuestStart({
      installed: [
        { key: 'exo:cluster', size_bytes: 1 },
        { key: 'gguf:huge', display_name: 'Grande', size_bytes: 40e9 },
      ],
      catalog: [{ local_key: 'gguf:huge', parameters_b: 70 }],
    }),
    'gguf:huge',
  );
  assert.equal(
    modelForGuestStart({
      installed: [
        { key: 'gguf:a', display_name: 'A', size_bytes: 3e9 },
        { key: 'gguf:b', display_name: 'B', size_bytes: 1e9 },
      ],
      catalog: [],
    }),
    'gguf:b',
  );
});

test('o chat vazio monta o card, envia no clique e esconde depois', () => {
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const welcomeAt = chat.indexOf('<div class="chat-welcome">');
  const welcome = chat.slice(welcomeAt, chat.indexOf('`;', welcomeAt));
  assert.ok(welcomeAt > 0);
  assert.match(welcome, /showGuestStart\(\{ state: guestState, messages, chats \}\)/);
  assert.match(welcome, /guestStartHtml\(escape\)/);
  assert.ok(welcome.indexOf('guestStartHtml(escape)') < welcome.indexOf('mascotHTML'));
  assert.equal(chat.split('guestStartHtml(escape)').length, 2);
  assert.match(chat, /localStorage\.setItem\(GUEST_START_KEY, state\)/);
  assert.match(chat, /guestStartNext\(state, \{ chats \}\)/);
  assert.match(chat, /data-guest-start-close/);
  assert.match(chat, /dismissGuestStart\(\)/);
  assert.match(chat, /e\.target\.closest\?\.\("\.guest-start"\)/);
  const handler = chat.slice(chat.indexOf('b.dataset.guestStart'), chat.indexOf('b.dataset.chatExample'));
  assert.match(handler, /guestStartPrompt\(b\.dataset\.guestStart\)/);
  assert.match(handler, /modelForGuestStart\(/);
  assert.match(handler, /await send\(\)/);
  assert.match(chat, /querySelector\("\.guest-start"\)\) target\.scrollTop = 0/);
  assert.match(handler, /input\.focus\(\)/);
  assert.doesNotMatch(handler, /stripe|telemetry|checkout/i);
  assert.match(server, /'\/guest-start\.js':\['guest-start\.js','application\/javascript'\]/);
});

test('o card usa painel, foco visível e contraste AA', () => {
  const css = readFileSync(resolve('public/design-system.css'), 'utf8');
  const tokens = readFileSync(resolve('public/tokens.css'), 'utf8');
  const start = css.indexOf('body.chat-page .chat-welcome:has(.guest-start)');
  assert.ok(start > 0);
  const block = css.slice(start);
  assert.match(block, /\.guest-start-close:focus-visible,\s*\.guest-start-prompt:focus-visible \{\s*outline: 3px solid var\(--focus\)/);
  assert.match(block, /min-height: 44px/);
  assert.match(block, /color: var\(--ink\)/);
  assert.match(block, /color: var\(--muted\)/);
  assert.match(block, /background: var\(--panel2\)/);
  assert.match(block, /justify-content: flex-start/);
  assert.match(block, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(block, /grid-template-columns: 1fr/);
  assert.match(block, /prefers-reduced-motion: reduce/);
  for (const theme of ['light', 'dark']) {
    const panel = token(tokens, 'panel', theme);
    const panel2 = token(tokens, 'panel2', theme);
    const ink = token(tokens, 'ink', theme);
    const muted = token(tokens, 'muted', theme);
    for (const [name, ratio] of [
      ['ink/panel', contrast(ink, panel)],
      ['muted/panel', contrast(muted, panel)],
      ['ink/panel2', contrast(ink, panel2)],
      ['muted/panel2', contrast(muted, panel2)],
    ]) {
      assert.ok(ratio >= 4.5, `${theme} ${name} ${ratio.toFixed(2)}`);
    }
  }
});
