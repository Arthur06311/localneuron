import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ATTACH_ACCEPT, createChatAssist } from '../public/chat-assist.js';
import { useLocale } from '../public/i18n.js';
import ptBR from '../public/i18n/pt-BR.js';
import en from '../public/i18n/en.js';

const LIMIT = 'Use até quatro anexos por mensagem.';
const TYPE = 'Use PDF, DOCX, XLSX, CSV, texto ou arquivos de código.';
const sizeMessage = (name) => `${name}: limite de 12 MiB.`;
const MAX = 12 * 1024 ** 2;

function file(name, size = 12, bytes = 'olá') {
  return { name, size, bytes };
}

function drag(types, files = []) {
  return {
    key: '',
    dataTransfer: { types, files, dropEffect: '' },
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

async function withChat(run, options = {}) {
  const state = {
    visible: options.visible !== false,
    busy: Boolean(options.busy),
    dialog: Boolean(options.dialog),
    reads: 0,
  };
  const toasts = [];
  const calls = [];
  const listeners = [];
  const nodes = [];
  const doc = {
    body: {
      append(node) {
        nodes.push(node);
      },
    },
    createElement() {
      return {
        id: '',
        className: '',
        hidden: false,
        textContent: '',
        children: [],
        setAttribute() {},
        append(child) {
          this.children.push(child);
        },
      };
    },
    addEventListener(type, fn) {
      listeners.push({ type, fn });
    },
    querySelector(selector) {
      if (selector === 'dialog[open]') return state.dialog ? { open: true } : null;
      return null;
    },
  };
  class FakeFileReader {
    readAsDataURL(item) {
      state.reads += 1;
      const raw = item.bytes ?? 'olá';
      this.result = `data:application/octet-stream;base64,${Buffer.from(raw).toString('base64')}`;
      this.onload();
    }
  }
  const previous = {
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    FileReader: Object.getOwnPropertyDescriptor(globalThis, 'FileReader'),
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, writable: true, value: FakeFileReader });
  const restore = (name, descriptor) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
  try {
    const assist = createChatAssist({
      api: async (url, opts) => {
        calls.push({ url, body: opts.body });
        return {
          id: `a-${calls.length}`,
          name: opts.body.name,
          pages: [{ location: 'Linhas 1–1', text: 'ok' }],
          truncated: false,
        };
      },
      E: (value) => String(value ?? ''),
      toast(message) {
        toasts.push(message);
      },
      isVisible: () => state.visible,
      current: () => undefined,
      getChat: () => null,
      isBusy: () => state.busy,
      ensureChat: async () => null,
      insert() {},
      onFork: async () => {},
      onProject() {},
      getAccess: () => ({ enabled: false, web: false, computer: false, files: false, terminal: false, readOnly: true }),
      setAccess() {},
      getFolder: () => '',
    });
    const fire = async (type, event) => {
      const pending = [];
      for (const item of listeners) if (item.type === type) pending.push(item.fn(event));
      await Promise.all(pending);
    };
    const overlay = () => nodes.find((node) => node.id === 'chat-drop-overlay');
    await run({
      state,
      toasts,
      calls,
      fire,
      overlay,
      assist,
      reads: () => state.reads,
    });
  } finally {
    restore('document', previous.document);
    restore('FileReader', previous.FileReader);
  }
}

test('o arrastar e soltar reusa o fluxo Anexar, a allowlist e os textos', () => {
  const assist = readFileSync(resolve('public/chat-assist.js'), 'utf8');
  const drop = readFileSync(resolve('public/chat-drop.js'), 'utf8');
  const css = readFileSync(resolve('public/chat-assist.css'), 'utf8');
  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const start = server.indexOf('const staticFiles');
  const block = server.slice(start, server.indexOf('};', start));
  assert.match(assist, /from\s+["']\.\/chat-drop\.js["']/);
  assert.match(assist, /attachmentRejection\(file, attachments\(target\)\.length\)/);
  assert.equal(assist.split(LIMIT).length - 1, 1);
  assert.equal(assist.split(': limite de 12 MiB.').length - 1, 1);
  assert.equal(assist.split(TYPE).length - 1, 1);
  assert.equal(drop.includes(LIMIT) || drop.includes(TYPE), false);
  assert.match(
    block,
    /['"]\/chat-drop\.js['"]\s*:\s*\[\s*['"]chat-drop\.js['"]\s*,\s*['"]application\/javascript['"]\s*\]/,
  );
  assert.match(css, /\.chat-drop-overlay\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.chat-drop-overlay\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.equal(ptBR['assist.drop'], 'Solte para anexar');
  assert.equal(en['assist.drop'], 'Drop to attach');
  assert.match(assist, /accept="\$\{ATTACH_ACCEPT\}"/);
});

test('soltar um arquivo aceito anexa e o contorno some', async () => {
  await withChat(async (h) => {
    const enter = drag(['Files'], [file('notas.txt', 4, 'olá')]);
    await h.fire('dragenter', enter);
    assert.equal(enter.defaultPrevented, true);
    const veil = h.overlay();
    assert.equal(veil.hidden, false);
    assert.equal(veil.className, 'chat-drop-overlay');
    assert.equal(veil.children[0].textContent, 'Solte para anexar');
    const over = drag(['Files'], [file('notas.txt', 4, 'olá')]);
    await h.fire('dragover', over);
    assert.equal(over.defaultPrevented, true);
    assert.equal(over.dataTransfer.dropEffect, 'copy');
    const dropped = drag(['Files'], [file('notas.txt', 4, 'olá')]);
    await h.fire('drop', dropped);
    assert.equal(dropped.defaultPrevented, true);
    assert.equal(veil.hidden, true);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].url, '/chats/attachments');
    assert.equal(h.calls[0].body.name, 'notas.txt');
    assert.equal(h.calls[0].body.data, Buffer.from('olá').toString('base64'));
    assert.equal(h.assist.attachments()[0].name, 'notas.txt');
    assert.deepEqual(h.toasts, []);
  });
});

test('cada tipo do botão Anexar entra e o contorno respeita o contador, Esc e dragleave', async () => {
  useLocale('en');
  try {
    await withChat(async (h) => {
      await h.fire('dragenter', drag(['Files'], [file('Notes.PDF')]));
      assert.equal(h.overlay().children[0].textContent, 'Drop to attach');
      await h.fire('drop', drag(['Files'], [file('Notes.PDF', 8, 'pdf')]));
      assert.equal(h.calls.at(-1).body.name, 'Notes.PDF');
      h.assist.clear('new');
      for (const ext of ATTACH_ACCEPT.split(',')) {
        h.toasts.length = 0;
        const name = `arquivo${ext}`;
        await h.fire('drop', drag(['Files'], [file(name, 8, ext)]));
        assert.equal(h.toasts.length, 0, name);
        assert.equal(h.calls.at(-1).body.name, name);
        assert.equal(h.calls.at(-1).body.data, Buffer.from(ext).toString('base64'));
        h.assist.clear('new');
      }
      await h.fire('dragenter', drag(['text/plain']));
      assert.equal(h.overlay().hidden, true);
      const plain = drag(['text/uri-list']);
      await h.fire('dragover', plain);
      await h.fire('drop', plain);
      assert.equal(plain.defaultPrevented, false);
      const first = drag(['Files'], [file('a.txt')]);
      const nested = drag([], [file('a.txt')]);
      await h.fire('dragenter', first);
      await h.fire('dragenter', nested);
      await h.fire('dragleave', drag([]));
      assert.equal(h.overlay().hidden, false);
      await h.fire('keydown', { key: 'Escape' });
      assert.equal(h.overlay().hidden, true);
      await h.fire('dragenter', drag(['Files'], [file('a.txt')]));
      await h.fire('dragover', drag(['Files'], [file('a.txt')]));
      assert.equal(h.overlay().hidden, true);
      const afterEsc = drag(['Files'], [file('depois.txt', 4, 'nao')]);
      const before = h.calls.length;
      await h.fire('drop', afterEsc);
      assert.equal(afterEsc.defaultPrevented, true);
      assert.equal(h.calls.length, before);
      await h.fire('dragleave', drag(['Files']));
      await h.fire('dragleave', drag(['Files']));
      await h.fire('dragleave', drag(['Files']));
      await h.fire('dragenter', drag(['Files'], [file('de-novo.txt')]));
      assert.equal(h.overlay().hidden, false);
      assert.equal(h.overlay().children[0].textContent, 'Drop to attach');
      await h.fire('dragleave', drag([]));
      assert.equal(h.overlay().hidden, true);
      await h.fire('dragend', drag(['Files']));
      assert.equal(h.overlay().hidden, true);
    });
  } finally {
    useLocale('pt-BR');
  }
});

test('passa do limite, do tamanho ou do tipo com as mesmas mensagens do Anexar', async () => {
  await withChat(async (h) => {
    const many = ['a.txt', 'b.txt', 'c.md', 'd.py', 'e.pdf'].map((name) => file(name, 20, name));
    await h.fire('drop', drag(['Files'], many));
    assert.equal(h.calls.length, 4);
    assert.deepEqual(h.calls.map((call) => call.body.name), ['a.txt', 'b.txt', 'c.md', 'd.py']);
    assert.deepEqual(h.toasts, [LIMIT]);
    assert.equal(h.reads(), 4);
    h.assist.clear('new');
    h.toasts.length = 0;
    await h.fire('drop', drag(['Files'], [file('grande.pdf', MAX + 1)]));
    assert.deepEqual(h.toasts, [sizeMessage('grande.pdf')]);
    assert.equal(h.calls.length, 4);
    assert.equal(h.reads(), 4);
    await h.fire('drop', drag(['Files'], [file('foto.png', 100)]));
    assert.deepEqual(h.toasts, [sizeMessage('grande.pdf'), TYPE]);
    assert.equal(h.reads(), 4);
    await h.fire('drop', drag(['Files'], [file('planilha.jsx', 100)]));
    assert.equal(h.toasts.at(-1), TYPE);
    const exact = drag(['Files'], [file('limite.txt', MAX, 'cheio')]);
    await h.fire('drop', exact);
    assert.equal(h.calls.at(-1).body.name, 'limite.txt');
    assert.equal(h.calls.at(-1).body.data, Buffer.from('cheio').toString('base64'));
    const input = { id: 'chat-attachment-files', files: [file('virus.exe', 30)], value: 'x' };
    await h.fire('change', { target: input });
    assert.equal(input.value, '');
    assert.equal(h.toasts.at(-1), TYPE);
    assert.equal(h.calls.at(-1).body.name, 'limite.txt');
    h.assist.clear('new');
    const before = h.calls.length;
    await h.fire('change', {
      target: {
        id: 'chat-attachment-files',
        files: [file('um.txt'), file('dois.txt'), file('tres.txt'), file('quatro.txt'), file('cinco.txt')],
        value: '',
      },
    });
    assert.equal(h.calls.length, before + 4);
    assert.equal(h.toasts.at(-1), LIMIT);
  });
});

test('geração, diálogo aberto e outra página não mostram o contorno nem anexam', async () => {
  await withChat(async (h) => {
    const enter = drag(['Files'], [file('notas.txt')]);
    await h.fire('dragenter', enter);
    assert.equal(h.overlay().hidden, false);
    h.state.busy = true;
    const over = drag(['Files'], [file('notas.txt')]);
    await h.fire('dragover', over);
    assert.equal(over.defaultPrevented, true);
    assert.equal(over.dataTransfer.dropEffect, 'none');
    assert.equal(h.overlay().hidden, true);
    const dropped = drag(['Files'], [file('notas.txt', 4, 'nao')]);
    await h.fire('drop', dropped);
    assert.equal(dropped.defaultPrevented, true);
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.toasts, []);
    h.state.busy = false;
    h.state.dialog = true;
    const again = drag(['Files'], [file('notas.txt')]);
    await h.fire('dragenter', again);
    assert.equal(again.defaultPrevented, true);
    assert.equal(h.overlay().hidden, true);
    await h.fire('drop', drag(['Files'], [file('notas.txt', 4, 'nao')]));
    assert.equal(h.calls.length, 0);
    const picker = { id: 'chat-attachment-files', files: [file('notas.txt', 4, 'nao')], value: 'z' };
    await h.fire('change', { target: picker });
    assert.equal(picker.value, 'z');
    assert.equal(h.calls.length, 0);
  }, {});

  await withChat(async (h) => {
    const enter = drag(['Files'], [file('notas.txt')]);
    await h.fire('dragenter', enter);
    await h.fire('dragover', enter);
    await h.fire('drop', enter);
    assert.equal(enter.defaultPrevented, false);
    assert.equal(h.overlay(), undefined);
    assert.equal(h.calls.length, 0);
  }, { visible: false });
});
