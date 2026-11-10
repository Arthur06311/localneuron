import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { conversationHistoryDir, registerConversationFolder } = require(resolve('desktop/conversation-folder.cjs'));

function harness(dir, { openPath, mkdir, stat } = {}) {
  let handler;
  const opened = [];
  const frame = { url: 'http://127.0.0.1:4318/configuracoes' };
  const window = { webContents: { mainFrame: frame } };
  registerConversationFolder({
    ipcMain: { handle(_name, fn) { handler = fn; } },
    shell: { openPath: openPath || (async path => { opened.push(path); return ''; }) },
    getWindow: () => window,
    origin: 'http://127.0.0.1:4318',
    dataDirectory: dir,
    ...(mkdir ? { mkdir } : {}),
    ...(stat ? { stat } : {}),
  });
  return { handler, event: { senderFrame: frame }, opened, window };
}

test('a pasta das conversas é o postgres absoluto do espaço local', () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-chats-'));
  try {
    assert.equal(conversationHistoryDir(dir), join(resolve(dir), 'postgres'));
    assert.equal(conversationHistoryDir(dir + '/'), join(resolve(dir), 'postgres'));
    const core = readFileSync(resolve('src/core.ts'), 'utf8');
    assert.match(core, /new Store\(join\(directory, 'postgres'\)\)/);
    assert.match(core, /new Store\(join\(this\.directory, 'postgres'\)\)/);
    const main = readFileSync(resolve('desktop/main.cjs'), 'utf8');
    assert.match(main, /LOCALNEURON_DATA_DIR: dataDirectory/);
    assert.match(main, /registerConversationFolder\(\{ipcMain,shell,getWindow:\(\)=>window,origin,dataDirectory\}\)/);
    const preload = readFileSync(resolve('desktop/preload.cjs'), 'utf8');
    assert.doesNotMatch(preload, /\bshell\b/);
    assert.doesNotMatch(preload, /require\(\s*['"]\.\//);
    assert.match(preload, /localneuron:conversation-folder/);
    assert.doesNotMatch(readFileSync(resolve('desktop/window-policy.cjs'), 'utf8'), /nodeIntegration:\s*true/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('abrir a pasta cria o diretório e só chama openPath nesse caminho', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-open-chats-'));
  const folder = join(dir, 'postgres');
  const harnessed = harness(dir);
  try {
    await assert.rejects(harnessed.handler({ senderFrame: { url: 'http://evil.example/' } }, 'open'), /Origem/);
    await assert.rejects(harnessed.handler(harnessed.event, { path: '/etc' }), /Ação inválida/);
    const listed = await harnessed.handler(harnessed.event, 'path');
    assert.deepEqual(listed, { ok: true, path: folder });
    assert.equal(statSync(folder, { throwIfNoEntry: false }), undefined);
    const opened = await harnessed.handler(harnessed.event, 'open');
    assert.deepEqual(opened, { ok: true, path: folder });
    assert.equal(statSync(folder).isDirectory(), true);
    assert.deepEqual(harnessed.opened, [folder]);
    const again = await harnessed.handler(harnessed.event, 'open');
    assert.deepEqual(again, { ok: true, path: folder });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('falha ao criar ou ao abrir mostra erro sem vazar a mensagem do sistema', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuron-chats-fail-'));
  const folder = join(dir, 'postgres');
  writeFileSync(folder, 'nao-e-pasta');
  const blocked = harness(dir, { openPath: async () => { throw new Error('segredo do sistema'); } });
  const missing = mkdtempSync(join(tmpdir(), 'neuron-chats-miss-'));
  const failedCreate = harness(missing, { mkdir() { const error = new Error('ENOSPC privado'); error.code = 'ENOSPC'; throw error; } });
  const refusedDir = mkdtempSync(join(tmpdir(), 'neuron-chats-refused-'));
  const refused = harness(refusedDir, { openPath: async () => 'não abriu' });
  try {
    assert.deepEqual(await blocked.handler(blocked.event, 'open'), { ok: false });
    assert.equal(blocked.opened.length, 0);
    assert.deepEqual(await failedCreate.handler(failedCreate.event, 'open'), { ok: false });
    assert.equal(JSON.stringify(await failedCreate.handler(failedCreate.event, 'path')).includes('ENOSPC'), false);
    const result = await refused.handler(refused.event, 'open');
    assert.deepEqual(result, { ok: false });
    assert.equal(JSON.stringify(result).includes('não abriu'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(missing, { recursive: true, force: true });
    rmSync(refusedDir, { recursive: true, force: true });
  }
});

test('a linha de configurações pede o caminho por IPC e desenha o texto traduzido', () => {
  const app = readFileSync(resolve('public/app.js'), 'utf8');
  const css = readFileSync(resolve('public/design-system.css'), 'utf8');
  assert.match(app, /id="conversation-storage"/);
  assert.match(app, /id="open-conversation-folder"/);
  assert.match(app, /t\('settings\.conversations'\)/);
  assert.match(app, /t\('settings\.conversationsOpen'\)/);
  assert.match(app, /t\('settings\.conversationsMissing'\)/);
  assert.match(app, /t\('settings\.conversationsPathError'\)/);
  assert.match(app, /conversationFolder\('path'\)/);
  assert.match(app, /conversationFolder\('open'\)/);
  assert.match(app, /pathEl\.textContent=result\.path/);
  assert.doesNotMatch(app, /\$\{result\.path\}/);
  assert.match(css, /\.settings-row/);
  assert.match(readFileSync(resolve('public/i18n/pt-BR.js'), 'utf8'), /'settings\.conversations': 'Onde ficam minhas conversas'/);
  assert.match(readFileSync(resolve('public/i18n/pt-BR.js'), 'utf8'), /'settings\.conversationsHelp': 'O histórico das conversas fica salvo neste computador, nesta pasta\. Se você usar Anthropic ou Grok na Minha equipe, o texto dessas conversas também vai para esse serviço\.'/);
  assert.match(readFileSync(resolve('public/i18n/en.js'), 'utf8'), /'settings\.conversationsHelp': 'Your conversation history is saved on this computer, in this folder\. If you use Anthropic or Grok in My team, the text of those conversations is also sent to that service\.'/);
  assert.match(readFileSync(resolve('public/i18n/en.js'), 'utf8'), /'settings\.conversationsOpen': 'Open folder'/);
  assert.match(app, /conversationsPathError/);
  assert.doesNotMatch(app.slice(app.indexOf('function showConversationFolder'), app.indexOf('function settings')), /conversationsMissing/);
});

test('o preload em sandbox repete a ponte de preload-api sem exigir o arquivo vizinho', () => {
  const preload = readFileSync(resolve('desktop/preload.cjs'), 'utf8');
  const api = readFileSync(resolve('desktop/preload-api.cjs'), 'utf8');
  const bridge = source => {
    const start = source.indexOf('const ALLOWED_IPC_CHANNELS');
    const marker = "contextBridge.exposeInMainWorld('colmeiaDesktop', createDesktopApi(ipcRenderer, argv));";
    const end = source.indexOf(marker);
    assert.equal(start > 0, true);
    assert.equal(end > start, true);
    return source.slice(start, end + marker.length);
  };
  assert.equal(bridge(preload), bridge(api));
  assert.match(preload, /require\('electron'\)/);
  assert.doesNotMatch(preload, /require\(\s*['"]\.\//);
  assert.match(api, /module\.exports/);
});
