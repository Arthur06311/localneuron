import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

test('mcp-servers.js entra na allowlist estática e a tela de ajustes o monta', () => {
  const server = readFileSync(resolve(root, 'src/server.ts'), 'utf8');
  const start = server.indexOf('const staticFiles');
  const block = server.slice(start, server.indexOf('};', start));
  assert.match(block, /['"]\/mcp-servers\.js['"]\s*:\s*\[\s*['"]mcp-servers\.js['"]\s*,\s*['"]application\/javascript['"]\s*\]/);
  const app = readFileSync(resolve(root, 'public/app.js'), 'utf8');
  const page = readFileSync(resolve(root, 'public/mcp-servers.js'), 'utf8');
  assert.match(app, /from '\.\/mcp-servers\.js'/);
  assert.match(app, /id="mcp-servers"/);
  assert.match(app, /mountMcpServers\(/);
  assert.match(page, /t\('settings\.mcp\.title'\)/);
  assert.match(page, /t\('settings\.mcp\.empty'\)/);
  assert.doesNotMatch(page, /https?:\/\/(127\.0\.0\.1|localhost)/);
});
