import test from 'node:test';
import assert from 'node:assert/strict';
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
