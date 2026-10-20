import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = name => readFileSync(resolve(name), 'utf8');

test('a abertura vai ao Chat e não pede senha, código nem cofre', () => {
  const app = read('public/app.js');
  const html = read('public/index.html');
  const ux = read('public/ux.js');
  const main = read('desktop/main.cjs');
  const boot = app.slice(app.lastIndexOf('try{const token='));
  for (const source of [app, html, ux, boot]) {
    assert.equal(source.includes('vault-password'), false);
    assert.equal(source.includes('remember-access'), false);
    assert.equal(source.includes('Lembrar meu acesso'), false);
    assert.equal(source.includes('Bloquear aplicativo'), false);
    assert.equal(source.includes('senha local'), false);
    assert.equal(source.includes('Confirme a senha atual'), false);
    assert.equal(source.includes('migrate-password'), false);
    assert.equal(source.includes('Começar sem o cofre antigo'), false);
    assert.equal(source.includes('id="skip-legacy"'), false);
    assert.equal(source.includes("action:'migrate'"), false);
    assert.equal(source.includes('/vault/migrate'), false);
  }
  assert.equal(html.includes('id="lock"'), false);
  assert.match(html, /data-page="chat"[^>]*aria-current="page"/);
  assert.match(html, /> Chat</);
  assert.equal(app.includes("page='wizard'"), false);
  assert.match(app, /page='chat'/);
  assert.match(boot, /page='chat'/);
  assert.match(boot, /localAccess\('open'\)/);
  assert.match(boot, /await refresh\(\)/);
  assert.match(boot, /\/vault\/skip-legacy/);
  assert.doesNotMatch(boot, /type="password"/);
  assert.match(app, /page==='chat'\)chatUI\.render/);
  assert.match(ux, /Há uma cópia do cofre antigo/);
  assert.match(ux, /Importar cópia com a senha/);
  assert.match(ux, /\/vault\/legacy/);
  assert.match(ux, /import-legacy/);
  assert.match(ux, /Cofre neste computador/);
  assert.match(main, /LOCALNEURON_DEVICE_NONCE/);
  assert.match(main, /openDeviceVault/);
  assert.match(main, /loadURL\(localSession\.url\)/);
  assert.match(main, /get\('session'\)/);
  assert.match(read('desktop/env.cjs'), /COLMEIA_/);
  assert.match(read('desktop/vault-open.cjs'), /freshDeviceVault/);
  assert.equal(read('desktop/local-access.cjs').includes('migration: true'), false);
});
