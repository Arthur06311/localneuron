import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = name => readFileSync(resolve(name), 'utf8');

test('a interface não oferece senha, lembrete nem bloqueio', () => {
  const app = read('public/app.js');
  const html = read('public/index.html');
  const ux = read('public/ux.js');
  const main = read('desktop/main.cjs');
  for (const source of [app, html, ux]) {
    assert.equal(source.includes('vault-password'), false);
    assert.equal(source.includes('remember-access'), false);
    assert.equal(source.includes('Lembrar meu acesso'), false);
    assert.equal(source.includes('Bloquear aplicativo'), false);
    assert.equal(source.includes('senha local'), false);
  }
  assert.equal(html.includes('id="lock"'), false);
  assert.match(app, /id="migrate-password"/);
  assert.match(app, /Senha atual/);
  assert.match(app, /id="skip-legacy"/);
  assert.match(app, /Começar sem o cofre antigo/);
  assert.match(app, /action:'fresh'/);
  assert.match(app, /\/vault\/skip-legacy/);
  assert.match(app, /localAccess\('open'\)/);
  assert.match(app, /action:'migrate'/);
  assert.match(app, /\/vault\/migrate/);
  assert.match(app, /needs_migration/);
  assert.match(ux, /Há uma cópia do cofre antigo/);
  assert.match(ux, /Importar cópia com a senha/);
  assert.match(ux, /\/vault\/legacy/);
  assert.match(ux, /import-legacy/);
  assert.match(main, /LOCALNEURON_DEVICE_NONCE/);
  assert.match(main, /openDeviceVault/);
  assert.match(read('desktop/env.cjs'), /COLMEIA_/);
});
