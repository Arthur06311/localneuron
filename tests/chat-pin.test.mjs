import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { t, useLocale } from '../public/i18n.js';
import { conversationGroups } from '../public/chat-list.js';

function readSource(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function chat(id, title, at, extra = {}) {
  return { id, title, at, messages: extra.messages || [], ...extra };
}

test('leitura de arquivo aceita finais de linha CRLF', () => {
  const dir = mkdtempSync(join(tmpdir(), 'colmeia-pin-crlf-'));
  const file = join(dir, 'fonte.js');
  try {
    writeFileSync(file, 'export const pin = "Fixar";\r\nexport const unpin = "Desafixar";\r\n');
    const text = readSource(file);
    assert.equal(text.includes('\r'), false);
    assert.equal(text, 'export const pin = "Fixar";\nexport const unpin = "Desafixar";\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('conversas fixadas formam o grupo do topo e saem dele ao desafixar', () => {
  const chats = [
    chat('old', 'Antiga', 10, { pinned: true, preferred_model: 'modelo-a' }),
    chat('new', 'Recente', 30, {
      preferred_model: 'modelo-b',
      messages: [{ model: 'modelo-b' }],
    }),
    chat('mid', 'Meio', 20, { pinned: true, preferred_model: 'modelo-b' }),
    chat('plain', 'Solta', 5),
  ];
  const groups = conversationGroups(chats, '', 'Sem modelo');
  assert.equal(groups[0].pinned, true);
  assert.equal(groups[0].id, 'pinned');
  assert.deepEqual(
    groups[0].items.map((item) => item.id),
    ['mid', 'old'],
  );
  assert.deepEqual(
    groups.slice(1).map((group) => group.id),
    ['modelo-b', 'Sem modelo'],
  );
  assert.deepEqual(
    groups[1].items.map((item) => item.id),
    ['new'],
  );
  assert.equal(
    groups.slice(1).some((group) => group.items.some((item) => item.pinned)),
    false,
  );

  const unpinned = chats.map((item) =>
    item.id === 'old' ? { ...item, pinned: false } : item,
  );
  const after = conversationGroups(unpinned, '', 'Sem modelo');
  assert.deepEqual(
    after[0].items.map((item) => item.id),
    ['mid'],
  );
  assert.equal(
    after.slice(1).some((group) => group.items.some((item) => item.id === 'old')),
    true,
  );
  assert.equal(
    after.find((group) => group.items.some((item) => item.id === 'old')).pinned,
    false,
  );

  const pinnedAgain = unpinned.map((item) =>
    item.id === 'old' ? { ...item, pinned: true } : item,
  );
  assert.deepEqual(
    conversationGroups(pinnedAgain, '', 'Sem modelo')[0].items.map((item) => item.id),
    ['mid', 'old'],
  );

  const bySearch = conversationGroups(chats, 'rec', 'Sem modelo');
  assert.equal(bySearch.some((group) => group.pinned), false);
  assert.deepEqual(
    bySearch[0].items.map((item) => item.id),
    ['new'],
  );
  const pinnedSearch = conversationGroups(chats, 'ant', 'Sem modelo');
  assert.equal(pinnedSearch.length, 1);
  assert.equal(pinnedSearch[0].pinned, true);
  assert.equal(pinnedSearch[0].items[0].id, 'old');
  assert.equal(conversationGroups([], '', 'Sem modelo').length, 0);
});

test('o menu e a lista usam Fixar/Desafixar, o grupo e o ícone de alfinete', () => {
  execFileSync(process.execPath, ['--check', resolve('public/chat.js')], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', resolve('public/chat-list.js')], { stdio: 'pipe' });
  const chat = readSource(resolve('public/chat.js'));
  const list = readSource(resolve('public/chat-list.js'));
  const icons = readSource(resolve('public/icons.js'));
  const css = readSource(resolve('public/workspace.css'));
  const server = readSource(resolve('src/server.ts'));
  const model = readSource(resolve('src/chat.ts'));
  const types = readSource(resolve('src/types.ts'));
  const pt = readSource(resolve('public/i18n/pt-BR.js'));
  const en = readSource(resolve('public/i18n/en.js'));

  assert.equal(chat.includes('from "./chat-list.js"'), true);
  assert.equal(
    chat.includes('conversationGroups(chats, $("#chat-search").value, t("chat.noModel"))'),
    true,
  );
  assert.equal(chat.includes('chat-pin-group'), true);
  assert.equal(chat.includes('icon("pin")'), true);
  assert.equal(chat.includes('📌'), false);
  assert.equal(chat.includes('📍'), false);
  const listAt = chat.indexOf('const listHTML');
  const manageAt = chat.indexOf('const manageHTML');
  const listHtml = chat.slice(listAt, manageAt);
  assert.equal(listHtml.includes('t("chat.pinned")'), true);
  assert.equal(listHtml.includes('chat-pin-group'), true);
  assert.equal(listHtml.includes('icon("pin")'), true);
  const manage = chat.slice(manageAt, chat.indexOf('const messages', manageAt));
  assert.ok(manage.indexOf('data-chat-pin') < manage.indexOf('data-chat-rename'));
  assert.ok(manage.indexOf('data-chat-rename') < manage.indexOf('data-chat-export'));
  assert.equal(manage.includes('aria-pressed='), true);
  assert.equal(manage.includes('t("chat.unpin")'), true);
  assert.equal(manage.includes('t("chat.pin")'), true);
  const handlerAt = chat.indexOf('b.hasAttribute("data-chat-pin")');
  const handler = chat.slice(handlerAt, chat.indexOf('b.hasAttribute("data-chat-rename")', handlerAt));
  assert.equal(handler.includes('/chats/${current}/pin'), true);
  assert.equal(handler.includes('pinned: !chat.pinned'), true);

  assert.match(list, /filter\(\(chat\) => chat\.pinned\)/);
  assert.match(icons, /pin: '<path d="M12 17v5"/);
  assert.match(css, /#chat-list \.chat-pin-group/);
  assert.match(css, /#chat-manage \[data-chat-pin\]\[aria-pressed=true\]/);
  assert.match(css, /\.ui-icon/);
  assert.doesNotMatch(css, /📌/);
  assert.match(server, /\/v1\/chats\/:id\/pin/);
  assert.match(server, /chats\.pin\(id\(request\),pinned\)/);
  assert.match(server, /'\/chat-list\.js':\['chat-list\.js','application\/javascript'\]/);
  assert.match(model, /async pin\(id: string, pinned: boolean\)/);
  assert.match(model, /chat\.pinned = true/);
  assert.match(model, /delete chat\.pinned/);
  assert.match(types, /pinned\?: boolean/);
  assert.match(pt, /'chat\.pin': 'Fixar'/);
  assert.match(pt, /'chat\.unpin': 'Desafixar'/);
  assert.match(pt, /'chat\.pinned': 'Fixadas'/);
  assert.match(en, /'chat\.pin': 'Pin'/);
  assert.match(en, /'chat\.unpin': 'Unpin'/);
  assert.match(en, /'chat\.pinned': 'Pinned'/);

  useLocale('pt-BR');
  assert.equal(t('chat.pin'), 'Fixar');
  assert.equal(t('chat.unpin'), 'Desafixar');
  assert.equal(t('chat.pinned'), 'Fixadas');
  useLocale('en');
  try {
    assert.equal(t('chat.pin'), 'Pin');
    assert.equal(t('chat.unpin'), 'Unpin');
    assert.equal(t('chat.pinned'), 'Pinned');
  } finally {
    useLocale('pt-BR');
  }
});
