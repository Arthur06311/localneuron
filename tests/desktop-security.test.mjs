import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { createMainWindow, createAgentWindow } = require(resolve('desktop/window-policy.cjs'));
const { ALLOWED_IPC_CHANNELS, invokeAllowed } = require(resolve('desktop/preload-api.cjs'));

function fakeBrowserWindow() {
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      const handlers = {};
      this.webContents = {
        openHandler: null,
        handlers,
        setWindowOpenHandler(fn) { this.openHandler = fn; },
        on(event, fn) { handlers[event] = fn; },
      };
    }
  }
  return BrowserWindow;
}

function navigationEvent() {
  return { prevented: false, preventDefault() { this.prevented = true; } };
}

test('As janelas efetivas isolam o renderer e mantêm webSecurity ligado', () => {
  const BrowserWindow = fakeBrowserWindow();
  const opened = [];
  const shell = { openExternal(url) { opened.push(url); return Promise.resolve(); } };
  const main = createMainWindow(BrowserWindow, {
    preload: '/app/desktop/preload.cjs',
    origin: 'http://127.0.0.1:4318',
    shell,
  });
  const agent = createAgentWindow(BrowserWindow);
  for (const prefs of [main.options.webPreferences, agent.options.webPreferences]) {
    assert.equal(prefs.contextIsolation, true);
    assert.equal(prefs.nodeIntegration, false);
    assert.equal(prefs.nodeIntegrationInWorker, false);
    assert.equal(prefs.nodeIntegrationInSubFrames, false);
    assert.equal(prefs.sandbox, true);
    assert.equal(prefs.webSecurity, true);
    assert.equal(prefs.allowRunningInsecureContent, false);
    assert.equal(prefs.webviewTag, false);
  }
  assert.equal(main.options.webPreferences.preload, '/app/desktop/preload.cjs');
  assert.equal(main.options.webPreferences.spellcheck, false);
  assert.equal(agent.options.webPreferences.partition, 'persist:localneuron-agent-browser');
  assert.equal(agent.options.webPreferences.preload, undefined);
  assert.equal(readFileSync(resolve('desktop/main.cjs'), 'utf8').includes('new BrowserWindow'), false);
  assert.equal(readFileSync(resolve('desktop/computer.cjs'), 'utf8').includes('new BrowserWindow'), false);
});

test('window.open e a navegação externa só saem da app em http/https público', () => {
  const BrowserWindow = fakeBrowserWindow();
  const opened = [];
  const shell = {
    openExternal(url) {
      opened.push(url);
      return Promise.reject(new Error('browser indisponível'));
    },
  };
  const origin = 'http://127.0.0.1:4318';
  const main = createMainWindow(BrowserWindow, { preload: '/preload.cjs', origin, shell });
  const open = url => main.webContents.openHandler({ url });
  assert.deepEqual(open('https://example.com/docs'), { action: 'deny' });
  assert.deepEqual(open('http://example.com:80/a'), { action: 'deny' });
  assert.deepEqual(open('https://example.com:443/a'), { action: 'deny' });
  for (const url of [
    'https://example.com:8443/',
    'http://127.0.0.1:4318/',
    'http://localhost/',
    'http://[::1]/',
    'https://user:secret@example.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
  ]) assert.deepEqual(open(url), { action: 'deny' });
  assert.deepEqual(opened, ['https://example.com/docs', 'http://example.com/a', 'https://example.com/a']);

  const same = navigationEvent();
  main.webContents.handlers['will-navigate'](same, origin + '/#session=abc');
  assert.equal(same.prevented, false);
  for (const url of ['https://example.com/', 'file:///tmp/x', ':::', 'http://user@127.0.0.1:4318/']) {
    const event = navigationEvent();
    main.webContents.handlers['will-redirect'](event, url);
    assert.equal(event.prevented, true, url);
  }
  const webview = navigationEvent();
  main.webContents.handlers['will-attach-webview'](webview);
  assert.equal(webview.prevented, true);

  const agent = createAgentWindow(BrowserWindow);
  assert.deepEqual(agent.webContents.openHandler({ url: 'https://example.com/' }), { action: 'deny' });
  const publicPage = navigationEvent();
  agent.webContents.handlers['will-navigate'](publicPage, 'https://example.com:8443/path');
  assert.equal(publicPage.prevented, false);
  for (const url of ['file:///tmp/x', 'http://127.0.0.1/', 'javascript:alert(1)', 'https://user:pw@example.com/']) {
    const event = navigationEvent();
    agent.webContents.handlers['will-navigate'](event, url);
    assert.equal(event.prevented, true, url);
  }
});

test('O preload expõe só os canais IPC permitidos', async () => {
  const invokes = [];
  const exposed = [];
  const electron = {
    contextBridge: { exposeInMainWorld(name, api) { exposed.push({ name, api }); } },
    ipcRenderer: {
      invoke(channel, ...args) { invokes.push({ channel, args }); return Promise.resolve({ channel }); },
      send() { throw new Error('send não pode ser usado'); },
      sendSync() { throw new Error('sendSync não pode ser usado'); },
    },
    shell: { openExternal() { throw new Error('shell não pode ser exposto'); } },
  };
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electron;
    return original.call(this, request, parent, isMain);
  };
  try {
    const preload = resolve('desktop/preload.cjs');
    delete require.cache[preload];
    delete require.cache[resolve('desktop/preload-api.cjs')];
    require(preload);
  } finally {
    Module._load = original;
  }
  assert.equal(exposed.length, 1);
  assert.equal(exposed[0].name, 'colmeiaDesktop');
  const api = exposed[0].api;
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api).sort(), ['chooseFolder', 'localAccess', 'restoreWorkspace']);
  for (const forbidden of ['ipcRenderer', 'require', 'shell', 'send', 'invoke', 'openExternal']) {
    assert.equal(Object.hasOwn(api, forbidden), false);
  }
  await api.restoreWorkspace();
  await api.localAccess({ action: 'status', channel: 'shell' });
  await api.localAccess('suspend');
  await api.chooseFolder();
  assert.deepEqual(invokes.map(call => call.channel), [
    'localneuron:restore-workspace',
    'localneuron:local-access',
    'localneuron:local-access',
    'colmeia:choose-folder',
  ]);
  assert.deepEqual(invokes[0].args, []);
  assert.deepEqual(invokes[1].args, [{ action: 'status', channel: 'shell' }]);
  assert.deepEqual(invokes[1].channel, 'localneuron:local-access');
  assert.deepEqual([...new Set(invokes.map(call => call.channel))].sort(), [...ALLOWED_IPC_CHANNELS].sort());
  assert.deepEqual(ALLOWED_IPC_CHANNELS, [
    'localneuron:restore-workspace',
    'localneuron:local-access',
    'colmeia:choose-folder',
  ]);
  const renderer = { invoke() { throw new Error('não devia invocar'); } };
  assert.throws(() => invokeAllowed(renderer, 'shell', []), /Canal IPC não permitido/);
  assert.throws(() => invokeAllowed(renderer, 'ipcRenderer', ['send']), /Canal IPC não permitido/);
  const source = readFileSync(resolve('desktop/preload.cjs'), 'utf8');
  assert.doesNotMatch(source, /\bshell\b/);
  assert.doesNotMatch(source, /ipcRenderer\.(send|sendSync|postMessage)/);
  assert.match(source, /exposeDesktopApi\(contextBridge, ipcRenderer\)/);
});
