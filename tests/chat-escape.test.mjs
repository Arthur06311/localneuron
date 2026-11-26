import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(new URL('./helpers/chat-vendor-hook.mjs', import.meta.url).href, import.meta.url);
const { createChatUI } = await import('../public/chat.js');

const library = {
  available: true,
  integrated_available: false,
  lms_available: false,
  mlx_available: false,
  installed: [],
  models: [],
  catalog: [],
};

function message(id, role, content, status) {
  return { id, role, content, status, at: 1 };
}

function conversation(id, pending) {
  return {
    id,
    title: id,
    at: 1,
    messages: [
      message(`${id}-user`, 'user', 'Pergunta', 'complete'),
      message(`${id}-reply`, 'assistant', pending ? '' : 'Resposta', pending ? 'pending' : 'complete'),
    ],
  };
}

test('Esc e o botão Parar usam o mesmo pedido de parada', () => {
  const chat = readFileSync(new URL('../public/chat.js', import.meta.url), 'utf8');
  const keydown = chat.slice(
    chat.indexOf('document.addEventListener("keydown"'),
    chat.indexOf('document.addEventListener("submit"'),
  );
  assert.match(keydown, /e\.key === "Escape" && e\.isComposing/);
  assert.match(keydown, /e\.target\.closest\?\.\("\.guest-start"\)/);
  assert.match(keydown, /cancelMessageEdit\(true\)/);
  assert.match(keydown, /toggleHistory\(false\)/);
  assert.match(keydown, /dialog\[open\]/);
  assert.match(keydown, /\$\("\[data-chat-stop\]"\)/);
  assert.match(keydown, /stopButton\.click\(\)/);
  assert.equal(chat.split('/stop`').length, 2);
  const stopAt = keydown.indexOf('stopButton.click()');
  assert.ok(stopAt > keydown.indexOf('toggleHistory(false)'));
  assert.ok(stopAt > keydown.lastIndexOf('cancelMessageEdit(true)'));
});

async function withChat(run) {
  const listeners = [];
  const inflight = new Set();
  const store = new Map();
  const toasts = [];
  const calls = [];
  let visible = true;
  let dialogOpen = false;
  let guestHold = false;
  let chats = [];
  let active = null;
  const track = (promise) => {
    const job = Promise.resolve(promise);
    inflight.add(job);
    job.finally(() => inflight.delete(job));
    return job;
  };
  const dispatchClick = (target) => {
    const event = {
      target,
      preventDefault() {
        event.defaultPrevented = true;
      },
      defaultPrevented: false,
    };
    const jobs = [];
    for (const [type, fn] of listeners) if (type === 'click') jobs.push(Promise.resolve(fn(event)));
    return track(Promise.all(jobs));
  };
  function makeEl(id, extra = {}) {
    const attributes = { ...(extra.attributes || {}) };
    const el = {
      id,
      hidden: extra.hidden ?? false,
      disabled: false,
      value: '',
      textContent: '',
      innerHTML: '',
      placeholder: '',
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      open: false,
      dataset: { ...(extra.dataset || {}) },
      style: {},
      classList: {
        _on: new Set(),
        toggle(name, force) {
          const on = force === undefined ? !this._on.has(name) : Boolean(force);
          if (on) this._on.add(name);
          else this._on.delete(name);
          return on;
        },
        contains(name) {
          return this._on.has(name);
        },
        add(name) {
          this._on.add(name);
        },
        remove(name) {
          this._on.delete(name);
        },
      },
      focus() {
        active = el;
      },
      click() {
        return dispatchClick(el);
      },
      closest(selector) {
        if (selector === 'button' && extra.button) return el;
        return null;
      },
      matches() {
        return false;
      },
      hasAttribute(name) {
        return Object.hasOwn(attributes, name);
      },
      getAttribute(name) {
        return Object.hasOwn(attributes, name) ? attributes[name] : null;
      },
      setAttribute(name, value) {
        attributes[name] = String(value);
      },
      removeAttribute(name) {
        delete attributes[name];
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      append() {},
      setSelectionRange() {},
    };
    return el;
  }
  const history = makeEl('chat-history', { hidden: true });
  const search = makeEl('chat-search');
  const list = makeEl('chat-list');
  list.dataset = {};
  const input = makeEl('chat-input');
  const stop = makeEl('stop', { button: true, attributes: { 'data-chat-stop': '' }, hidden: true });
  let stopClicks = 0;
  const stopClick = stop.click.bind(stop);
  stop.click = () => {
    stopClicks += 1;
    return stopClick();
  };
  const historyButton = makeEl('history-button', {
    button: true,
    attributes: { 'data-chat-history': '' },
  });
  const chatButton = makeEl('chat-button', { button: true, dataset: { chatId: 'chat-a' } });
  const editButton = makeEl('edit-button', { button: true, dataset: { chatEdit: 'chat-a-user' } });
  const elements = {
    '#content': makeEl('content'),
    '#chat-history': history,
    '#chat-search': search,
    '#chat-list': list,
    '#chat-manage': makeEl('chat-manage'),
    '#chat-messages': makeEl('chat-messages'),
    '#chat-approvals': makeEl('chat-approvals'),
    '#chat-send': makeEl('chat-send'),
    '[data-chat-voice]': makeEl('voice', { button: true }),
    '#chat-model': makeEl('chat-model'),
    '[data-chat-stop]': stop,
    '#chat-status': makeEl('chat-status'),
    '#chat-input': input,
    '#chat-input-hint': makeEl('chat-input-hint'),
    '#model-guidance': makeEl('model-guidance'),
    '.generation-settings': makeEl('generation-settings'),
    '.assistant-access': makeEl('assistant-access'),
    '.chat-main': makeEl('chat-main'),
    '[data-chat-font]': makeEl('chat-font', { button: true }),
  };
  const target = {
    id: 'chat-input',
    closest(selector) {
      if (selector === '.guest-start' && guestHold) return { className: 'guest-start' };
      return null;
    },
  };
  const doc = {
    title: '',
    visibilityState: 'visible',
    body: makeEl('body'),
    hasFocus() {
      return true;
    },
    addEventListener(type, fn) {
      listeners.push([type, fn]);
    },
    querySelector(selector) {
      if (selector === 'dialog[open]') return dialogOpen ? { open: true } : null;
      return elements[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-chat-history]') return [historyButton];
      return [];
    },
    getElementById() {
      return null;
    },
    createElement() {
      return makeEl('created');
    },
  };
  const previous = {
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    setInterval: globalThis.setInterval,
  };
  const restore = (name, descriptor) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
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
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { platform: 'Linux x86_64', userAgent: 'X11; Linux' },
  });
  globalThis.setInterval = () => 0;
  const ui = createChatUI({
    api: (path, init) => {
      const method = init?.method || 'GET';
      const call = { path, method, body: init?.body ?? null };
      calls.push(call);
      return track(
        Promise.resolve().then(() => {
          if (String(path).endsWith('/stop') && method === 'POST') {
            const id = String(path).split('/')[2];
            for (const chat of chats) {
              if (chat.id !== id) continue;
              for (const item of chat.messages) if (item.status === 'pending') item.status = 'stopped';
            }
            return {};
          }
          if (path === '/chats') return chats;
          if (path === '/model-library') return library;
          if (path === '/assistant') return { folder: null, approvals: [] };
          return {};
        }),
      );
    },
    escape: (value) => String(value ?? ''),
    toast(message) {
      toasts.push(String(message));
    },
    showLibrary() {},
    isVisible: () => visible,
    openProject() {},
  });
  async function settle() {
    for (let step = 0; step < 12; step += 1) {
      if (inflight.size === 0) break;
      await Promise.all([...inflight]);
    }
  }
  async function render() {
    const pending = ui.render();
    await pending;
    await settle();
    assert.deepEqual(toasts, [], elements['#content'].innerHTML);
  }
  async function press(init = {}) {
    const event = {
      key: 'Escape',
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      isComposing: false,
      target,
      preventDefault() {
        event.defaultPrevented = true;
      },
      defaultPrevented: false,
      ...init,
    };
    const jobs = [];
    for (const [type, fn] of listeners) if (type === 'keydown') jobs.push(Promise.resolve(fn(event)));
    await Promise.all(jobs);
    await settle();
    return event;
  }
  async function click(el) {
    await el.click();
    await settle();
  }
  try {
    await run({
      calls,
      toasts,
      store,
      render,
      press,
      click,
      stop,
      history,
      historyButton,
      chatButton,
      editButton,
      input,
      get active() {
        return active;
      },
      get stopClicks() {
        return stopClicks;
      },
      stops: () => calls.filter((call) => call.method === 'POST' && String(call.path).endsWith('/stop')),
      setChats(next) {
        chats = next;
      },
      setVisible(next) {
        visible = next;
      },
      setDialog(next) {
        dialogOpen = next;
      },
      setGuest(next) {
        guestHold = next;
      },
    });
  } finally {
    globalThis.setInterval = previous.setInterval;
    restore('document', previous.document);
    restore('window', previous.window);
    restore('localStorage', previous.localStorage);
    restore('navigator', previous.navigator);
  }
}

test('Esc para a geração pelo mesmo caminho do botão Parar', async () => {
  await withChat(async (ui) => {
    ui.setChats([
      conversation('chat-a', true),
      conversation('chat-b', true),
      conversation('chat-done', false),
    ]);
    await ui.render();
    assert.equal(ui.stop.hidden, false);
    const event = await ui.press();
    assert.equal(event.defaultPrevented, true);
    assert.equal(ui.stopClicks, 1);
    assert.deepEqual(
      ui.stops().map((call) => call.path),
      ['/chats/chat-a/stop', '/chats/chat-b/stop'],
    );
    assert.deepEqual(ui.stops().map((call) => call.body), [{}, {}]);
    assert.equal(ui.stop.hidden, true);
    const again = await ui.press();
    assert.equal(again.defaultPrevented, false);
    assert.equal(ui.stopClicks, 1);
    assert.equal(ui.stops().length, 2);
  });
});

test('Esc fecha histórico, edição, início rápido e diálogo antes de parar', async () => {
  await withChat(async (ui) => {
    ui.setChats([conversation('chat-a', false)]);
    await ui.render();
    await ui.click(ui.chatButton);
    ui.input.value = 'rascunho';
    await ui.click(ui.editButton);
    assert.equal(ui.input.value, 'Pergunta');
    ui.setChats([conversation('chat-a', true)]);
    await ui.render();
    assert.equal(ui.stop.hidden, false);
    const edited = await ui.press();
    assert.equal(edited.defaultPrevented, true);
    assert.equal(ui.input.value, 'rascunho');
    assert.equal(ui.active, ui.input);
    assert.equal(ui.stopClicks, 0);
    assert.equal(ui.stops().length, 0);

    ui.history.hidden = false;
    const history = await ui.press({
      target: { id: 'chat-messages', closest() { return null; } },
    });
    assert.equal(history.defaultPrevented, false);
    assert.equal(ui.history.hidden, true);
    assert.equal(ui.stopClicks, 0);

    ui.history.hidden = true;
    ui.setDialog(true);
    const dialog = await ui.press();
    assert.equal(dialog.defaultPrevented, false);
    assert.equal(ui.stopClicks, 0);
    ui.setDialog(false);

    ui.setGuest(true);
    const guest = await ui.press();
    assert.equal(guest.defaultPrevented, true);
    assert.equal(ui.store.get('localneuron-guest-start'), 'dismissed');
    assert.equal(ui.stopClicks, 0);
    assert.equal(ui.stops().length, 0);
    ui.setGuest(false);

    const stopped = await ui.press();
    assert.equal(stopped.defaultPrevented, true);
    assert.equal(ui.stopClicks, 1);
    assert.deepEqual(ui.stops().map((call) => call.path), ['/chats/chat-a/stop']);
  });
});

test('Esc sem geração e fora do Chat não faz nada', async () => {
  await withChat(async (ui) => {
    ui.setChats([conversation('chat-a', false)]);
    await ui.render();
    assert.equal(ui.stop.hidden, true);
    const idle = await ui.press();
    assert.equal(idle.defaultPrevented, false);
    assert.equal(ui.stopClicks, 0);
    assert.equal(ui.stops().length, 0);
    assert.equal(ui.history.hidden, true);
    assert.equal(ui.input.value, '');

    ui.setChats([conversation('chat-a', true)]);
    await ui.render();
    assert.equal(ui.stop.hidden, false);
    ui.stop.disabled = true;
    const preparing = await ui.press();
    assert.equal(preparing.defaultPrevented, false);
    assert.equal(ui.stopClicks, 0);

    ui.stop.disabled = false;
    ui.setVisible(false);
    const away = await ui.press();
    assert.equal(away.defaultPrevented, false);
    assert.equal(ui.stopClicks, 0);
    assert.equal(ui.stops().length, 0);
  });
});

test('Esc durante a composição do IME é ignorado', async () => {
  await withChat(async (ui) => {
    ui.setChats([conversation('chat-a', true)]);
    await ui.render();
    ui.history.hidden = false;
    const event = await ui.press({ isComposing: true });
    assert.equal(event.defaultPrevented, false);
    assert.equal(ui.history.hidden, false);
    assert.equal(ui.stopClicks, 0);
    assert.equal(ui.stops().length, 0);
    ui.history.hidden = true;
    const clear = await ui.press({ isComposing: true });
    assert.equal(clear.defaultPrevented, false);
    assert.equal(ui.stopClicks, 0);
    const stopped = await ui.press({ isComposing: false });
    assert.equal(stopped.defaultPrevented, true);
    assert.equal(ui.stops().length, 1);
  });
});
