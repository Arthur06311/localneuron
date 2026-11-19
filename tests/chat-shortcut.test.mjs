import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { useLocale } from '../public/i18n.js';
import {
  isNewConversationShortcut,
  newConversationShortcutLabel,
  newConversationShortcutTitle,
  runNewConversationShortcut,
} from '../public/chat-shortcut.js';

register(new URL('./helpers/chat-vendor-hook.mjs', import.meta.url).href, import.meta.url);
const { createChatUI } = await import('../public/chat.js');

const mac = { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };
const windows = { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

test('o tooltip da nova conversa mostra ⌘N no Mac e Ctrl+N nos outros', () => {
  useLocale('pt-BR');
  try {
    assert.equal(newConversationShortcutLabel(mac), '⌘N');
    assert.equal(newConversationShortcutLabel(windows), 'Ctrl+N');
    assert.equal(newConversationShortcutTitle(mac), 'Nova conversa (⌘N)');
    assert.equal(newConversationShortcutTitle(windows), 'Nova conversa (Ctrl+N)');
    useLocale('en');
    assert.equal(newConversationShortcutTitle(mac), 'New conversation (⌘N)');
    assert.equal(newConversationShortcutTitle({ platform: 'Linux x86_64', userAgent: 'X11; Linux' }), 'New conversation (Ctrl+N)');
  } finally {
    useLocale('pt-BR');
  }
  const chat = readFileSync(new URL('../public/chat.js', import.meta.url), 'utf8');
  const markup = chat.slice(chat.indexOf('id="chat-history"'), chat.indexOf('id="chat-settings"'));
  const buttons = [...markup.matchAll(/<button class="secondary" data-chat-new\b[^>]*>/g)];
  assert.equal(buttons.length, 2);
  for (const button of buttons) assert.match(button[0], /title="\$\{newConversationShortcutTitle\(\)\}"/);
  assert.match(chat, /if \(runNewConversationShortcut\(e\)\) return;/);
});

test('Ctrl/Cmd+N cria uma conversa nova e foca o campo; dialog e paleta impedem', async () => {
  const listeners = [];
  let active = null;
  let dialogOpen = false;
  const palette = { id: 'command-palette', hidden: true };
  const input = {
    id: 'chat-input',
    value: '',
    focus() {
      active = this;
    },
  };
  const history = { id: 'chat-history', hidden: true };
  const messages = { id: 'chat-messages', scrollTop: 0, scrollHeight: 0 };
  const newChat = {
    tag: 'button',
    attributes: { 'data-chat-new': '' },
    dataset: {},
    hasAttribute(name) {
      return Object.hasOwn(this.attributes, name);
    },
    closest(selector) {
      return selector === 'button' ? this : null;
    },
    click() {
      const event = { target: this, preventDefault() {} };
      for (const [type, fn] of [...listeners]) if (type === 'click') fn(event);
    },
  };
  const savedChat = {
    tag: 'button',
    attributes: { 'data-chat-id': 'c1' },
    dataset: { chatId: 'c1' },
    hasAttribute(name) {
      return Object.hasOwn(this.attributes, name);
    },
    closest(selector) {
      return selector === 'button' ? this : null;
    },
    click() {
      const event = { target: this, preventDefault() {} };
      for (const [type, fn] of [...listeners]) if (type === 'click') fn(event);
    },
  };
  const elsewhere = {
    id: 'elsewhere',
    focus() {
      active = this;
    },
  };
  const nav = { platform: 'Win32', userAgent: windows.userAgent };
  const doc = {
    title: '',
    visibilityState: 'visible',
    hasFocus() {
      return true;
    },
    addEventListener(type, fn) {
      listeners.push([type, fn]);
    },
    querySelector(selector) {
      if (selector === 'dialog[open]') return dialogOpen ? { open: true } : null;
      if (selector === '[data-chat-new]') return newChat;
      if (selector === '#chat-input') return input;
      if (selector === '#chat-history') return history;
      if (selector === '#chat-messages') return messages;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      return id === 'command-palette' ? palette : null;
    },
  };
  const store = new Map();
  const previous = {
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    setInterval: globalThis.setInterval,
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, enumerable: true, writable: true, value: doc });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { addEventListener() {} },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, enumerable: true, writable: true, value: nav });
  globalThis.setInterval = () => 0;
  const restore = (name, descriptor) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
  try {
    createChatUI({
      api: async () => {
        throw new Error('api');
      },
      escape: (value) => String(value ?? ''),
      toast() {},
      showLibrary() {},
      isVisible: () => false,
      openProject() {},
    });
    const type = (value) => {
      input.value = value;
      for (const [eventType, fn] of [...listeners]) if (eventType === 'input') fn({ target: input });
    };
    const key = async (init) => {
      const event = {
        altKey: false,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        key: '',
        target: { id: 'chat-input', closest() { return null; } },
        preventDefault() {
          event.defaultPrevented = true;
        },
        defaultPrevented: false,
        ...init,
      };
      for (const [eventType, fn] of [...listeners]) if (eventType === 'keydown') fn(event);
      for (let step = 0; step < 6; step += 1) await Promise.resolve();
      return event;
    };
    const openSaved = async () => {
      savedChat.click();
      for (let step = 0; step < 6; step += 1) await Promise.resolve();
    };

    type('rascunho novo');
    await openSaved();
    type('texto da conversa');
    elsewhere.focus();
    const created = await key({ ctrlKey: true, key: 'n' });
    assert.equal(created.defaultPrevented, true);
    assert.equal(input.value, 'rascunho novo');
    assert.equal(active, input);

    await openSaved();
    type('continua aberta');
    elsewhere.focus();
    dialogOpen = true;
    const blockedDialog = await key({ ctrlKey: true, key: 'N' });
    assert.equal(blockedDialog.defaultPrevented, false);
    assert.equal(input.value, 'continua aberta');
    assert.equal(active, elsewhere);

    dialogOpen = false;
    palette.hidden = false;
    elsewhere.focus();
    const blockedPalette = await key({ ctrlKey: true, key: 'n' });
    assert.equal(blockedPalette.defaultPrevented, false);
    assert.equal(input.value, 'continua aberta');
    assert.equal(active, elsewhere);

    palette.hidden = true;
    nav.platform = 'MacIntel';
    nav.userAgent = mac.userAgent;
    const macCtrl = await key({ ctrlKey: true, key: 'n' });
    assert.equal(macCtrl.defaultPrevented, false);
    assert.equal(input.value, 'continua aberta');
    const macCmd = await key({ metaKey: true, key: 'n' });
    assert.equal(macCmd.defaultPrevented, true);
    assert.equal(input.value, 'rascunho novo');
    assert.equal(active, input);

    assert.equal(isNewConversationShortcut({ key: 'n', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false }, windows), false);
    assert.equal(isNewConversationShortcut({ key: 'n', ctrlKey: true, altKey: true, shiftKey: false }, windows), false);
    assert.equal(runNewConversationShortcut({ key: 'n', ctrlKey: true, preventDefault() {} }, { querySelector() { return null; }, getElementById() { return null; } }, windows), false);
  } finally {
    globalThis.setInterval = previous.setInterval;
    restore('document', previous.document);
    restore('window', previous.window);
    restore('localStorage', previous.localStorage);
    restore('navigator', previous.navigator);
  }
});
