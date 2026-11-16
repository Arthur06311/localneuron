import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useLocale } from '../public/i18n.js';
import { createWindowTitle, displayTitle } from '../public/chat-title.js';

const APP = 'LocalNeuron';
const READY_PT = '✓ Resposta pronta — LocalNeuron';
const READY_EN = '✓ Response ready — LocalNeuron';

function named(name) {
  return `${name} — LocalNeuron`;
}

function chat(id, title, messages) {
  return { id, title, messages };
}

test('sem conversa o título é o app e com conversa entra o nome', () => {
  useLocale('pt-BR');
  assert.equal(displayTitle({}), APP);
  assert.equal(displayTitle({ conversationTitle: '   ' }), APP);
  assert.equal(displayTitle({ conversationTitle: 'Roteiro da feira' }), named('Roteiro da feira'));
  assert.equal(displayTitle({ conversationTitle: '<b>Oi</b> {name}' }), named('<b>Oi</b> {name}'));
  assert.equal(displayTitle({ conversationTitle: 'Roteiro', responseReady: true }), READY_PT);

  useLocale('en');
  try {
    assert.equal(displayTitle({}), APP);
    assert.equal(displayTitle({ conversationTitle: 'Fair script' }), named('Fair script'));
    assert.equal(displayTitle({ conversationTitle: 'Fair script', responseReady: true }), READY_EN);
  } finally {
    useLocale('pt-BR');
  }
});

test('a resposta pronta só aparece se ela termina com a janela fora de foco', () => {
  useLocale('pt-BR');
  const titles = createWindowTitle();
  const open = { id: 'c1', title: 'Roteiro da feira' };
  const pending = [chat('c1', open.title, [{ id: 'm1', role: 'assistant', status: 'pending' }])];
  const done = [chat('c1', open.title, [{ id: 'm1', role: 'assistant', status: 'complete' }])];

  assert.equal(titles.update({ chats: [], conversation: null, focused: true }).title, APP);
  assert.equal(titles.update({ chats: [], conversation: open, focused: true }).title, named(open.title));
  assert.equal(titles.update({ chats: pending, conversation: open, focused: true }).responseReady, false);
  assert.equal(
    titles.update({ chats: done, conversation: open, focused: true }).title,
    named(open.title),
  );
  assert.equal(titles.update({ chats: done, conversation: open, focused: false }).responseReady, false);

  const waiting = createWindowTitle();
  waiting.update({ chats: pending, conversation: open, focused: false });
  const ready = waiting.update({ chats: done, conversation: open, focused: false });
  assert.equal(ready.responseReady, true);
  assert.equal(ready.title, READY_PT);
  assert.equal(waiting.update({ chats: done, conversation: open, focused: false }).title, READY_PT);
  assert.equal(waiting.clearReady().title, named(open.title));
  assert.equal(waiting.update({ chats: done, conversation: open, focused: true }).title, named(open.title));

  const refocus = createWindowTitle();
  refocus.update({ chats: pending, conversation: open, focused: false });
  refocus.update({ chats: done, conversation: open, focused: false });
  assert.equal(refocus.update({ chats: done, conversation: open, focused: true }).title, named(open.title));

  const switched = createWindowTitle();
  switched.update({ chats: pending, conversation: open, focused: false });
  switched.update({ chats: done, conversation: open, focused: false });
  assert.equal(
    switched.update({ chats: done, conversation: { id: 'c9', title: 'Depois' }, focused: false }).title,
    named('Depois'),
  );
  switched.update({ chats: pending, conversation: { id: 'c9', title: 'Depois' }, focused: false });
  switched.update({ chats: done, conversation: { id: 'c9', title: 'Depois' }, focused: false });
  assert.equal(
    switched.update({ chats: done, conversation: { id: 'c9', title: 'Nome novo' }, focused: false }).title,
    named('Nome novo'),
  );
});

test('trocar ou renomear a conversa atualiza o título e uma conversa já pronta não dispara aviso', () => {
  useLocale('pt-BR');
  const titles = createWindowTitle();
  const done = [chat('c1', 'Roteiro', [{ id: 'm1', status: 'complete' }])];
  assert.equal(titles.update({ chats: done, conversation: { id: 'c1', title: 'Roteiro' }, focused: false }).title, named('Roteiro'));
  assert.equal(titles.update({ chats: done, conversation: { id: 'c1', title: 'Roteiro' }, focused: false }).responseReady, false);

  const other = [chat('c2', 'Outra conversa', [{ id: 'm2', status: 'complete' }]), ...done];
  assert.equal(
    titles.update({ chats: other, conversation: { id: 'c2', title: 'Outra conversa' }, focused: false }).title,
    named('Outra conversa'),
  );
  assert.equal(
    titles.update({ chats: other, conversation: { id: 'c2', title: 'Nome novo' }, focused: true }).title,
    named('Nome novo'),
  );
  assert.equal(titles.update({ chats: other, conversation: null, focused: true }).title, APP);

  const background = createWindowTitle();
  const both = [
    chat('c1', 'A', [{ id: 'a', status: 'pending' }]),
    chat('c2', 'B', [{ id: 'b', status: 'pending' }]),
  ];
  background.update({ chats: both, conversation: { id: 'c2', title: 'B' }, focused: false });
  const oneDone = [
    chat('c1', 'A', [{ id: 'a', status: 'complete' }]),
    chat('c2', 'B', [{ id: 'b', status: 'pending' }]),
  ];
  assert.equal(
    background.update({ chats: oneDone, conversation: { id: 'c2', title: 'B' }, focused: false }).title,
    READY_PT,
  );
});

test('erro ou interrupção não marcam o título como resposta pronta', () => {
  useLocale('pt-BR');
  const open = { id: 'c1', title: 'Roteiro da feira' };
  for (const status of ['error', 'stopped']) {
    const titles = createWindowTitle();
    titles.update({
      chats: [chat('c1', open.title, [{ id: 'm1', status: 'pending' }])],
      conversation: open,
      focused: false,
    });
    const ended = titles.update({
      chats: [chat('c1', open.title, [{ id: 'm1', status }])],
      conversation: open,
      focused: false,
    });
    assert.equal(ended.responseReady, false, status);
    assert.equal(ended.title, named(open.title), status);
  }
  const gone = createWindowTitle();
  gone.update({
    chats: [chat('c1', open.title, [{ id: 'm1', status: 'pending' }])],
    conversation: open,
    focused: false,
  });
  const removed = gone.update({ chats: [chat('c1', open.title, [])], conversation: open, focused: false });
  assert.equal(removed.responseReady, false);
  assert.equal(removed.title, named(open.title));
});

test('fora do chat o título volta a ser LocalNeuron', () => {
  useLocale('pt-BR');
  const titles = createWindowTitle();
  const open = { id: 'c1', title: 'Roteiro da feira' };
  const pending = [chat('c1', open.title, [{ id: 'm1', status: 'pending' }])];
  const done = [chat('c1', open.title, [{ id: 'm1', status: 'complete' }])];
  assert.equal(
    titles.update({ chats: pending, conversation: open, focused: true, visible: true }).title,
    named(open.title),
  );
  assert.equal(
    titles.update({ chats: pending, conversation: open, focused: false, visible: false }).title,
    APP,
  );
  const back = titles.update({ chats: done, conversation: open, focused: true, visible: true });
  assert.equal(back.responseReady, false);
  assert.equal(back.title, named(open.title));

  const away = createWindowTitle();
  away.update({ chats: pending, conversation: open, focused: false, visible: true });
  const hiddenDone = away.update({ chats: done, conversation: open, focused: false, visible: false });
  assert.equal(hiddenDone.title, APP);
  assert.equal(hiddenDone.responseReady, false);
  const returned = away.update({ chats: done, conversation: open, focused: false, visible: true });
  assert.equal(returned.responseReady, false);
  assert.equal(returned.title, named(open.title));

  const app = readFileSync(resolve('public/app.js'), 'utf8');
  const chatSource = readFileSync(resolve('public/chat.js'), 'utf8');
  assert.match(app, /page==='chat'&&next!=='chat'\)\{chatUI\.stopVoice\(\);chatUI\.showAppTitle\(\);\}/);
  const hidden = chatSource.match(/if \(!isVisible\(\)\) \{\r?\n\s*showAppTitle\(\);/g) || [];
  assert.ok(hidden.length >= 2);
});

test('o chat publica o título e o Electron não bloqueia o título da página', () => {
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const policy = readFileSync(resolve('desktop/window-policy.cjs'), 'utf8');
  const main = readFileSync(resolve('desktop/main.cjs'), 'utf8');
  assert.match(chat, /createWindowTitle\(/);
  assert.match(chat, /document\.title/);
  assert.match(chat, /addEventListener\(\s*"blur"/);
  assert.match(chat, /addEventListener\(\s*"focus"/);
  assert.match(chat, /addEventListener\(\s*"visibilitychange"/);
  assert.match(chat, /visibilityState === "hidden"/);
  assert.match(chat, /restoreWindowTitle\(\)/);
  assert.match(chat, /hasFocus\(\)/);
  assert.match(server, /'\/chat-title\.js':\['chat-title\.js','application\/javascript'\]/);
  assert.match(policy, /title:\s*'LocalNeuron'/);
  assert.doesNotMatch(policy, /page-title-updated/);
  assert.doesNotMatch(main, /page-title-updated/);
  assert.doesNotMatch(readFileSync(resolve('desktop/computer.cjs'), 'utf8'), /page-title-updated/);
});
