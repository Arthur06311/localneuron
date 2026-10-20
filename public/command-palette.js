export const PALETTE_PAGES = [
  ['chat', 'Ir para o Chat'],
  ['team', 'Ir para a minha equipe'],
  ['models', 'Ir para os modelos'],
  ['photo', 'Ir para a imagem'],
  ['studio', 'Ir para o vídeo'],
  ['music', 'Ir para a música'],
  ['editor', 'Ir para o editor'],
  ['connections', 'Ir para as conexões'],
  ['exo', 'Ir para a rede EXO'],
  ['sharing', 'Ir para a minha API'],
  ['pro', 'Ir para a Central Pro'],
  ['subscription', 'Ir para o meu plano'],
  ['wizard', 'Ir para a configuração guiada'],
  ['settings', 'Ir para as configurações'],
];

export function paletteCommands({ chats = [], models = [] } = {}) {
  return [
    ...PALETTE_PAGES.map(([page, label]) => ({ id: `page:${page}`, group: 'Telas', label, run: { type: 'page', page } })),
    ...chats.slice(0, 8).map(chat => ({ id: `chat:${chat.id}`, group: 'Conversas recentes', label: chat.title || 'Conversa sem título', run: { type: 'chat', id: chat.id } })),
    ...models.slice(0, 12).map(model => ({ id: `model:${model.key}`, group: 'Mudar de modelo', label: model.display_name || model.key, run: { type: 'model', key: model.key } })),
  ];
}

export function filterCommands(commands, query) {
  const text = query.trim().toLocaleLowerCase('pt-BR');
  if (!text) return commands;
  return commands.filter(command => `${command.group} ${command.label}`.toLocaleLowerCase('pt-BR').includes(text));
}

export function reducePalette(state, event) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
    return { ...state, open: !state.open, toggle: true };
  }
  if (!state.open) return state;
  if (event.key === 'Escape') return { ...state, open: false, escape: true };
  if (event.key === 'ArrowDown') return { ...state, index: Math.min(state.index + 1, Math.max(0, state.commands.length - 1)), moved: true };
  if (event.key === 'ArrowUp') return { ...state, index: Math.max(state.index - 1, 0), moved: true };
  if (event.key === 'Enter') return { ...state, open: false, choose: state.commands[state.index] || null };
  if (event.key === 'Tab') return { ...state, trap: true };
  return state;
}

export function mountCommandPalette(doc, { load, onRun }) {
  let previous = null;
  let open = false;
  let query = '';
  let index = 0;
  let commands = [];
  const root = doc.createElement('div');
  root.id = 'command-palette';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Paleta de comandos');
  const input = doc.createElement('input');
  input.id = 'command-palette-input';
  input.type = 'text';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'command-palette-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-label', 'Pesquisar telas, conversas e modelos');
  input.placeholder = 'Pesquisar telas, conversas e modelos';
  const list = doc.createElement('div');
  list.id = 'command-palette-list';
  list.setAttribute('role', 'listbox');
  const empty = doc.createElement('p');
  empty.id = 'command-palette-empty';
  empty.hidden = true;
  empty.textContent = 'Nenhum comando corresponde.';
  const hint = doc.createElement('p');
  hint.className = 'command-palette-hint';
  hint.textContent = 'Setas para percorrer · Enter para abrir · Esc para fechar';
  root.append(input, list, empty, hint);
  doc.body.append(root);

  function shown() { return filterCommands(commands, query); }
  function draw() {
    const items = shown();
    if (index >= items.length) index = Math.max(0, items.length - 1);
    list.replaceChildren();
    items.forEach((item, position) => {
      const option = doc.createElement('button');
      option.type = 'button';
      option.className = 'command-palette-option';
      option.setAttribute('role', 'option');
      option.tabIndex = -1;
      option.id = position === index ? 'command-palette-active' : '';
      option.setAttribute('aria-selected', String(position === index));
      option.textContent = `${item.group} · ${item.label}`;
      option.addEventListener('click', () => choose(item));
      list.append(option);
    });
    empty.hidden = items.length > 0;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', items.length ? 'command-palette-active' : '');
  }
  async function show() {
    previous = doc.activeElement || null;
    open = true;
    query = '';
    index = 0;
    input.value = '';
    root.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.focus();
    commands = await load();
    if (!open) return;
    draw();
  }
  function hide() {
    open = false;
    root.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    const back = previous;
    previous = null;
    back?.focus?.();
  }
  function choose(item) {
    hide();
    if (item) onRun(item.run);
  }
  input.addEventListener('input', () => { query = input.value; index = 0; draw(); });
  doc.getElementById('open-command-palette')?.addEventListener('click', () => { if (open) hide(); else void show(); });
  doc.addEventListener('keydown', event => {
    if (doc.querySelector?.('dialog[open]') && !root.contains(doc.activeElement)) return;
    const next = reducePalette({ open, query, index, commands: shown() }, event);
    if (next.toggle) {
      event.preventDefault();
      if (next.open) void show(); else hide();
      return;
    }
    if (!open) return;
    if (next.escape || next.trap || next.moved || 'choose' in next) event.preventDefault();
    if (next.escape) hide();
    if (next.moved) { index = next.index; draw(); }
    if ('choose' in next) choose(next.choose);
  });
  return { show, hide, root, input };
}
