import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('every stylesheet and script linked from the app shell is served', async () => {
  const html = await readFile(resolve(root, 'public/index.html'), 'utf8');
  const server = await readFile(resolve(root, 'src/server.ts'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(refs.includes('/navigation.css'));
  assert.ok(refs.includes('/a11y.css'));
  for (const ref of refs) {
    assert.match(server, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Missing route for ${ref}`);
  }
});

test('every local module import in public/ has a static route', async () => {
  const server = await readFile(resolve(root, 'src/server.ts'), 'utf8');
  const pending = ['public/app.js'];
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(resolve(root, file), 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
      const url = '/' + match[1].replace(/^\.\//, '');
      assert.match(server, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} imports ${url}, which the server does not serve`);
      const local = resolve(root, 'public' + url);
      try {
        await access(local);
        pending.push('public' + url);
      } catch {
        // Remapped assets such as /vendor/purify.js are served from node_modules.
      }
    }
  }
  await access(resolve(root, 'public/a11y.css'));
  await access(resolve(root, 'public/navigation.css'));
});
