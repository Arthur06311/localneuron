import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listensBeyondLoopback, exposureBanner, networkExposureNotice } from '../public/network-notice.js';

const notice = 'está a escutar fora deste computador. Outros dispositivos desta rede conseguem aceder.';

test('Aviso de escuta fora do loopback distingue loopback, 0.0.0.0 e LAN', () => {
  for (const host of ['', '127.0.0.1', '127.0.0.2', 'localhost', '::1', '[::1]']) assert.equal(listensBeyondLoopback(host), false, host);
  for (const host of ['0.0.0.0', '::', '192.168.1.10', '10.1.2.3', '172.16.0.4']) assert.equal(listensBeyondLoopback(host), true, host);
  assert.equal(exposureBanner(false, 'A Minha API'), '');
  const banner = exposureBanner(true, 'A Minha API');
  assert.equal(banner.includes('class="notice warn"'), true);
  assert.equal(banner.includes('role="alert"'), true);
  assert.equal(banner.includes(networkExposureNotice('A Minha API')), true);
  assert.match(banner, /A Minha API está a escutar fora deste computador\. Outros dispositivos desta rede conseguem aceder\./);
  assert.match(networkExposureNotice('A Rede EXO'), new RegExp('A Rede EXO ' + notice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Minha API e EXO mostram o aviso quando o estado indica escuta fora do loopback', () => {
  const sharing = readFileSync(new URL('../public/sharing.js', import.meta.url), 'utf8');
  const exo = readFileSync(new URL('../public/exo.js', import.meta.url), 'utf8');
  assert.match(sharing, /exposureBanner\(state\.exposed,'A Minha API'\)/);
  assert.match(sharing, /<h1>Minha API<\/h1>/);
  assert.match(exo, /id="exo-exposure"/);
  assert.match(exo, /exposureBanner\(state\.exposed, "A Rede EXO"\)/);
});
