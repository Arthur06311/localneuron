import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beginMessageEdit,
  editButton,
  messageEditDraft,
  messageEditOnInput,
} from '../public/chat-edit.js';
import ptBR from '../public/i18n/pt-BR.js';
import en from '../public/i18n/en.js';

const messages = [
  { id: 'user-1', role: 'user', content: 'primeira' },
  { id: 'assistant-1', role: 'assistant', content: 'resposta 1', status: 'complete' },
  { id: 'user-2', role: 'user', content: 'segunda' },
  { id: 'assistant-2', role: 'assistant', content: 'resposta 2', status: 'complete' },
];

function buttons(items, busy) {
  const lastUserId = [...items].reverse().find((item) => item.role === 'user')?.id;
  return items.map((message) =>
    editButton({
      message,
      lastUserId,
      busy,
      pressed: false,
      label: 'Editar',
      icon: '<svg class="ui-icon"></svg>',
    }),
  );
}

test('o botão Editar aparece só na última mensagem do usuário e desativa durante a geração', () => {
  const idle = buttons(messages, false);
  assert.deepEqual(
    idle.map((html) => html.includes('data-chat-edit')),
    [false, false, true, false],
  );
  assert.match(idle[2], /data-chat-edit="user-2"/);
  assert.match(idle[2], /class="quiet"/);
  assert.match(idle[2], /<svg class="ui-icon"><\/svg>Editar/);
  assert.doesNotMatch(idle[2], /disabled/);
  assert.equal(buttons([{ id: 'user-1', role: 'user', content: '' }], false)[0], '');

  const generating = buttons(
    messages.map((message, index) =>
      index === messages.length - 1 ? { ...message, status: 'pending' } : message,
    ),
    true,
  );
  assert.match(generating[2], /disabled/);
  assert.equal(generating[0], '');
  assert.equal(generating[1], '');
  assert.equal(generating[3], '');
  assert.match(
    editButton({
      message: messages[2],
      lastUserId: 'user-2',
      busy: false,
      pressed: true,
      label: 'Editar',
      icon: '',
    }),
    /aria-pressed="true"/,
  );
});

test('Esc restaura o rascunho e esvaziar o campo cancela a edição sem enviar', () => {
  const editing = beginMessageEdit('rascunho anterior', { id: 'user-2', content: 'segunda' });
  assert.equal(editing.id, 'user-2');
  assert.equal(messageEditDraft(editing), 'rascunho anterior');
  assert.equal(messageEditOnInput(editing, 'segunda, com um ajuste'), editing);
  assert.equal(messageEditOnInput(editing, '   '), null);
  assert.equal(messageEditOnInput(null, 'texto'), null);
  assert.equal(messageEditDraft(null), '');
});

test('o Chat liga o lápis, o envio da edição e o cancelamento em pt-BR e en', () => {
  const chat = readFileSync(resolve('public/chat.js'), 'utf8');
  const icons = readFileSync(resolve('public/icons.js'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const css = readFileSync(resolve('public/workspace.css'), 'utf8');
  assert.match(chat, /from "\.\/chat-edit\.js"/);
  assert.match(chat, /icon\("pencil"\)/);
  assert.match(
    chat,
    /const editingLocked = preparing \|\| messages\.some\(\(item\) => item\.status === "pending"\)/,
  );
  assert.match(chat, /busy: editingLocked/);
  assert.match(chat, /b\.dataset\.chatEdit/);
  assert.match(chat, /if \(preparing \|\| pending\(\) \|\| b\.disabled\) return/);
  assert.match(chat, /cancelMessageEdit\(true\)/);
  assert.match(chat, /messageEditOnInput\(editing, e\.target\.value\)/);
  assert.match(chat, /edit: editId/);
  assert.match(chat, /v\.question/);
  assert.match(chat, /chat\.previousQuestion/);
  assert.equal(ptBR['chat.previousQuestion'], 'Pergunta anterior');
  assert.equal(en['chat.previousQuestion'], 'Earlier question');
  assert.match(chat, /editing\?\.id !== editId/);
  assert.match(icons, /pencil:/);
  assert.match(server, /edit:z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(css, /\[data-chat-edit\]/);
  assert.equal(ptBR['chat.edit'], 'Editar');
  assert.equal(en['chat.edit'], 'Edit');
  assert.match(ptBR['chat.edit.placeholder'], /Esc cancela/);
  assert.match(en['chat.edit.placeholder'], /Esc cancels/);
  assert.equal('chat.edit' in ptBR && 'chat.edit' in en, true);
  assert.equal('chat.edit.placeholder' in ptBR && 'chat.edit.placeholder' in en, true);
});
