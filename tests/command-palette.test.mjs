import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE_PAGES, filterCommands, mountCommandPalette, paletteCommands, reducePalette } from '../public/command-palette.js';

test('A paleta lista ecrãs, conversas recentes e modelos em português de Portugal', () => {
  const commands = paletteCommands({
    chats: [{ id: 'c1', title: 'Roteiro da feira' }, { id: 'c2', title: '' }],
    models: [{ key: 'gguf:qwen', display_name: 'Qwen local' }],
  });
  assert.equal(commands.filter(command => command.group === 'Ecrãs').length, PALETTE_PAGES.length);
  assert.equal(commands.find(command => command.run.type === 'chat' && command.run.id === 'c1').label, 'Roteiro da feira');
  assert.equal(commands.find(command => command.run.id === 'c2').label, 'Conversa sem título');
  assert.equal(commands.find(command => command.run.type === 'model').label, 'Qwen local');
  assert.deepEqual(filterCommands(commands, 'equipa').map(command => command.run.page), ['team']);
  assert.equal(filterCommands(commands, 'nãoexiste').length, 0);
  const app = readFileSync('public/app.js', 'utf8');
  const html = readFileSync('public/index.html', 'utf8');
  assert.match(app, /mountCommandPalette/);
  assert.match(app, /selectModel/);
  assert.match(html, /id="open-command-palette"/);
  assert.match(html, /Comandos/);
});

test('Cmd-K e Ctrl-K abrem, as setas percorrem, Enter escolhe e Esc devolve o foco', async () => {
  const elements = new Map();
  let active = null;
  const listeners = [];
  function element(tag) {
    const node = {
      tag, id: '', hidden: false, tabIndex: 0, children: [], textContent: '', className: '', value: '',
      parent: null, attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name]; },
      append(...nodes) { for (const child of nodes) { child.parent = this; this.children.push(child); if (child.id) elements.set(child.id, child); } },
      replaceChildren() { this.children = []; },
      addEventListener(type, fn) { this.listeners ||= []; this.listeners.push([type, fn]); },
      focus() { active = this; },
      contains(node) { return node === this || this.children.some(child => child === node || child.contains?.(node)); },
    };
    return node;
  }
  const inputStarter = element('button');
  inputStarter.id = 'antes';
  inputStarter.focus();
  const doc = {
    body: element('body'),
    activeElement: null,
    get activeElement() { return active; },
    createElement: element,
    addEventListener(type, fn) { listeners.push([type, fn]); },
    getElementById(id) { return id === 'antes' ? inputStarter : elements.get(id) || null; },
    querySelector() { return null; },
  };
  const runs = [];
  const palette = mountCommandPalette(doc, {
    load: async () => paletteCommands({ chats: [{ id: 'c1', title: 'Roteiro' }], models: [{ key: 'm1', display_name: 'Modelo local' }] }),
    onRun: action => runs.push(action),
  });
  const key = (init) => {
    const event = { preventDefault() { event.defaultPrevented = true; }, defaultPrevented: false, altKey: false, metaKey: false, ctrlKey: false, key: '', ...init };
    for (const [type, fn] of listeners) if (type === 'keydown') fn(event);
    return event;
  };
  key({ metaKey: true, key: 'k' });
  await Promise.resolve();
  assert.equal(palette.root.hidden, false);
  assert.equal(doc.activeElement, palette.input);
  assert.equal(palette.input.getAttribute('aria-label'), 'Pesquisar ecrãs, conversas e modelos');
  key({ key: 'ArrowDown' });
  assert.equal(doc.getElementById('command-palette-active').getAttribute('aria-selected'), 'true');
  key({ key: 'Tab' });
  assert.equal(doc.activeElement, palette.input);
  key({ ctrlKey: true, key: 'k' });
  assert.equal(palette.root.hidden, true);
  assert.equal(doc.activeElement, inputStarter);
  key({ ctrlKey: true, key: 'K' });
  await Promise.resolve();
  key({ key: 'Enter' });
  assert.deepEqual(runs[0], { type: 'page', page: 'chat' });
  assert.equal(doc.activeElement, inputStarter);
  key({ metaKey: true, key: 'k' });
  await Promise.resolve();
  key({ key: 'Escape' });
  assert.equal(palette.root.hidden, true);
  assert.equal(doc.activeElement, inputStarter);
  assert.equal(reducePalette({ open: true, index: 0, commands: [{ run: { type: 'page', page: 'chat' } }] }, { key: 'Enter', metaKey: false, ctrlKey: false, altKey: false }).choose.run.page, 'chat');
});
