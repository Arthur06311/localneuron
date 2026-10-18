import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {Core} from '../dist/src/core.js';
import {createApp} from '../dist/src/server.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const known = JSON.parse(await readFile(new URL('./a11y-known.json', import.meta.url), 'utf8'));
const widths = [320, 390, 768];
const password = 'senha-teste-a11y-12';

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function allowed(rule, target) {
  return known.some(entry => entry.rule === rule && target.includes(entry.target));
}

test('headless accessibility audit of the public UI', {timeout: 240000}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'neuron-a11y-'));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const core = new Core(dir, resolve(root));
  await core.init();
  const {app, token} = await createApp(core, 'a11y-audit-session', origin);
  await app.listen({host: '127.0.0.1', port});
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--mute-audio', '--no-sandbox'],
  });
  const layoutProblems = [];
  const axeProblems = [];
  const axeSummary = [];
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 800}, deviceScaleFactor: 1});
    await context.addCookies([{name: 'colmeia', value: token, url: origin, httpOnly: true, sameSite: 'Strict'}]);
    await context.addInitScript(() => {
      if (!localStorage.getItem('colmeia-theme')) localStorage.setItem('colmeia-theme', 'light');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await installLayoutHelpers(page);
    await page.route('**/remote*', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname === '/remote' ? '/remote.html' : url.pathname;
      const type = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
      await route.fulfill({status: 200, contentType: type, body: await readFile(resolve(root, 'public' + path))});
    });

    for (const file of ['/navigation.css', '/a11y.css']) {
      const response = await page.request.get(origin + file);
      assert.equal(response.status(), 200, `${file} is not served`);
    }

    await page.goto(origin + '/', {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#vault-password');
    assert.equal(await page.getAttribute('.theme-switch', 'role'), 'group');

    for (const width of widths) {
      await page.setViewportSize({width, height: 800});
      await auditSurface(page, `setup@${width}`, width, layoutProblems, axeProblems, axeSummary);
      await assertShell(page, `setup@${width}`, width, layoutProblems);
    }

    const setup = await page.request.post(origin + '/v1/setup', {
      headers: {authorization: 'Bearer ' + token, 'content-type': 'application/json', 'idempotency-key': 'a11y-setup-01'},
      data: {password},
    });
    assert.equal(setup.status(), 200, await setup.text());
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#content h1');

    const destinations = [
      ['wizard', 'account', 'wizard'],
      ['chat', 'work', 'chat'],
      ['models', 'work', 'models'],
      ['photo', 'create', 'photo'],
      ['connections', 'connect', 'connections'],
      ['settings', 'account', 'settings'],
      ['subscription', 'account', 'subscription'],
    ];
    for (const width of widths) {
      await page.setViewportSize({width, height: 800});
      for (const [name, island, dest] of destinations) {
        await openDestination(page, island, dest);
        if (dest === 'photo') {
          if (width === 320 && await page.locator('dialog.recommend-dialog[open]').count()) {
            await auditSurface(page, 'photo-guide@320', width, layoutProblems, axeProblems, axeSummary, {shell: false});
          }
          await dismissDialogs(page);
        }
        const label = `${name}@${width}`;
        await auditSurface(page, label, width, layoutProblems, axeProblems, axeSummary);
        await assertShell(page, label, width, layoutProblems);
      }
      await assertMenus(page, width, layoutProblems);
    }

    await page.emulateMedia({colorScheme: 'dark'});
    await page.evaluate(() => localStorage.setItem('colmeia-theme', 'dark'));
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#content h1');
    await page.setViewportSize({width: 320, height: 800});
    await openDestination(page, 'work', 'chat');
    await auditSurface(page, 'chat-dark@320', 320, layoutProblems, axeProblems, axeSummary);
    await assertShell(page, 'chat-dark@320', 320, layoutProblems);

    await page.goto(origin + '/remote', {waitUntil: 'domcontentloaded'});
    await page.setViewportSize({width: 320, height: 800});
    await page.waitForSelector('#login');
    await auditSurface(page, 'remote@320', 320, layoutProblems, axeProblems, axeSummary, {shell: false});
    const remoteOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (remoteOverflow > 1) layoutProblems.push({where: 'remote@320', type: 'overflow', detail: `${remoteOverflow}px`});
    await page.evaluate(() => { document.querySelector('#connect').hidden = true; document.querySelector('#conversation').hidden = false; });
    await auditSurface(page, 'remote-chat@320', 320, layoutProblems, axeProblems, axeSummary, {shell: false});

    const report = {layoutProblems, axeProblems, axeSummary};
    if (process.env.A11Y_DUMP) await writeFile('/tmp/a11y-findings.json', JSON.stringify(report, null, 2));
    assert.deepEqual(layoutProblems, [], layoutProblems.map(item => `${item.where} ${item.type} ${item.detail}`).join('\n'));
    if (!process.env.A11Y_DUMP) {
      assert.deepEqual(axeProblems, [], axeProblems.slice(0, 40).map(item => `${item.where} ${item.impact} ${item.rule} ${item.target}`).join('\n'));
    }
  } finally {
    await browser.close();
    await app.close();
    await core.close();
    await rm(dir, {recursive: true, force: true});
  }
});

async function dismissDialogs(page) {
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()));
}

async function openDestination(page, island, dest) {
  await dismissDialogs(page);
  const trigger = page.locator(`[data-nav-island="${island}"]`);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await page.locator(`#nav-island-${island} [data-page="${dest}"]`).click();
  await page.waitForFunction(expected => document.body.dataset.page === expected, dest);
  await page.waitForSelector('#content h1, #content .notice');
  await page.waitForFunction(() => !document.querySelector('#content .loading')).catch(() => {});
  if (dest === 'photo') await page.locator('dialog.recommend-dialog[open]').waitFor({timeout: 3000}).catch(() => {});
  if (dest !== 'photo') await dismissDialogs(page);
}

async function auditSurface(page, where, width, layoutProblems, axeProblems, axeSummary, options = {}) {
  if (options.shell !== false) await dismissDialogs(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) layoutProblems.push({where, type: 'overflow', detail: `${overflow}px`});
  if (options.shell !== false) {
    const clipped = await page.evaluate(() => clippedControls());
    for (const item of clipped) layoutProblems.push({where, type: 'clipped', detail: item});
    const skip = page.locator('.skip-link');
    if (await skip.count()) {
      await skip.focus();
      const skipClip = await page.evaluate(() => {
        const element = document.querySelector('.skip-link');
        const rect = element.getBoundingClientRect();
        const inView = rect.width > 1 && rect.height > 1 && rect.top >= -1 && rect.left >= -1 && rect.bottom <= window.innerHeight + 1 && rect.right <= window.innerWidth + 1;
        return inView ? '' : `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      });
      if (skipClip) layoutProblems.push({where, type: 'skip-link', detail: skipClip});
      await page.evaluate(() => document.body.focus());
    }
  }
  const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const violation of results.violations) {
    const count = violation.nodes.length;
    axeSummary.push({where, impact: violation.impact, rule: violation.id, count, help: violation.help});
    if (!['critical', 'serious'].includes(violation.impact)) continue;
    for (const node of violation.nodes) {
      const target = node.target.join(' ');
      if (!allowed(violation.id, target)) {
        axeProblems.push({where, impact: violation.impact, rule: violation.id, target, help: violation.help});
      }
    }
  }
  }

async function assertShell(page, where, width, layoutProblems) {
  const shell = await page.evaluate(() => {
    const visible = element => {
      if (!element || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };
    const text = element => (element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
    const islands = [...document.querySelectorAll('[data-nav-island]')].map(element => ({
      id: element.dataset.navIsland,
      open: element.getAttribute('aria-expanded') === 'true',
      visible: visible(element),
      text: `${text(element)} ${element.textContent || ''}`,
      height: Math.round(element.getBoundingClientRect().height),
    }));
    const themes = [...document.querySelectorAll('[data-theme]')].map(element => ({
      id: element.dataset.theme,
      visible: visible(element),
      text: text(element),
    }));
    const lock = document.querySelector('#lock');
    return {
      islands,
      themes,
      lock: {visible: visible(lock), text: text(lock), height: lock ? Math.round(lock.getBoundingClientRect().height) : 0},
      group: document.querySelector('.theme-switch')?.getAttribute('role') || '',
    };
  });
  if (shell.group !== 'group') layoutProblems.push({where, type: 'theme-group', detail: shell.group || 'missing'});
  for (const name of ['Trabalhar', 'Criar', 'Conectar', 'Conta']) {
    const island = shell.islands.find(item => item.text.includes(name));
    if (!island?.visible || !island.text.includes(name)) layoutProblems.push({where, type: 'island-hidden', detail: name});
    else if (width <= 720 && (island.text.includes('•••') || island.height < 40)) layoutProblems.push({where, type: 'island-label', detail: `${name} h=${island.height} ${island.text.slice(0, 80)}`});
  }
  for (const name of ['Claro', 'Escuro', 'Sistema']) {
    const theme = shell.themes.find(item => item.text.includes(name));
    if (!theme?.visible) layoutProblems.push({where, type: 'theme-hidden', detail: name});
  }
  if (!shell.lock.visible || !shell.lock.text.includes('Bloquear') || (width <= 720 && shell.lock.height < 40)) {
    layoutProblems.push({where, type: 'lock', detail: JSON.stringify(shell.lock)});
  }
  const reached = await tabLabels(page);
  for (const name of ['Trabalhar', 'Criar', 'Conectar', 'Conta', 'Claro', 'Escuro', 'Sistema', 'Bloquear']) {
    if (!reached.some(stop => stop.label.includes(name))) layoutProblems.push({where, type: 'keyboard', detail: `${name} :: ${reached.slice(0, 12).map(stop => stop.label).join(' | ')}`});
  }
  for (const id of ['create', 'connect', 'account']) {
    const island = shell.islands.find(item => item.id === id);
    const leaked = reached.filter(stop => stop.menu === `nav-island-${id}`);
    if (island && !island.open && leaked.length) {
      layoutProblems.push({where, type: 'closed-menu-tab', detail: leaked.map(stop => stop.label).join(', ')});
    }
  }
}

async function assertMenus(page, width, layoutProblems) {
  await dismissDialogs(page);
  for (const [island, sample, pageId] of [['create', 'Imagem', 'photo'], ['account', 'Configuração guiada', 'wizard']]) {
    const trigger = page.locator(`[data-nav-island="${island}"]`);
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    const box = await page.locator(`#nav-island-${island}`).boundingBox();
    if (!box) {
      layoutProblems.push({where: `menu-${island}@${width}`, type: 'menu-missing', detail: sample});
    } else {
      const viewport = page.viewportSize();
      if (box.x < -1 || box.y < -1 || box.x + box.width > viewport.width + 1) {
        layoutProblems.push({where: `menu-${island}@${width}`, type: 'menu-overflow', detail: JSON.stringify({box, viewport})});
      }
      const height = await page.locator(`#nav-island-${island} button`).first().evaluate(element => element.getBoundingClientRect().height);
      if (width <= 720 && height < 40) layoutProblems.push({where: `menu-${island}@${width}`, type: 'menu-target', detail: `${sample} ${Math.round(height)}px`});
    }
    const reached = await tabLabels(page);
    if (!reached.some(stop => stop.page === pageId || stop.label.includes(sample))) layoutProblems.push({where: `menu-${island}@${width}`, type: 'menu-keyboard', detail: sample});
    if (await trigger.getAttribute('aria-expanded') === 'true') await trigger.click();
  }
}

async function tabLabels(page) {
  await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  const labels = [];
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const label = (element.getAttribute('aria-label') || element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
      const menu = element.closest('.nav-island-menu');
      return {label, page: element.dataset.page || '', menu: menu?.id || ''};
    });
    if (!stop?.label || labels.some(item => item.label === stop.label)) break;
    labels.push(stop);
  }
  return labels;
}

async function installLayoutHelpers(page) {
  await page.addInitScript(() => {
    window.clippedControls = () => {
      const visible = element => {
        if (element.closest('[hidden]')) return false;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      };
      const clippedBy = element => {
        const rect = element.getBoundingClientRect();
        let node = element.parentElement;
        while (node && node !== document.documentElement) {
          const style = getComputedStyle(node);
          const clips = style.overflowX === 'hidden' || style.overflowX === 'clip' || style.overflowY === 'hidden' || style.overflowY === 'clip';
          if (clips) {
            const parent = node.getBoundingClientRect();
            const overlapX = Math.max(0, Math.min(rect.right, parent.right) - Math.max(rect.left, parent.left));
            const overlapY = Math.max(0, Math.min(rect.bottom, parent.bottom) - Math.max(rect.top, parent.top));
            const area = rect.width * rect.height;
            if (area > 0 && (overlapX * overlapY) / area < 0.6) {
              const name = (element.getAttribute('aria-label') || element.innerText || element.id || element.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
              return name;
            }
          }
          node = node.parentElement;
        }
        return '';
      };
      const found = [];
      for (const element of document.querySelectorAll('a, button, input, select, textarea, summary')) {
        if (!visible(element) || element.classList.contains('skip-link')) continue;
        element.scrollIntoView({block: 'nearest', inline: 'nearest'});
        const name = clippedBy(element);
        if (name) found.push(name);
      }
      return found.slice(0, 12);
    };
  });
}
