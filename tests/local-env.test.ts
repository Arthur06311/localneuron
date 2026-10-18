import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { localSetting, serverConfig, childServerEnv } = createRequire(import.meta.url)('../../scripts/local-env.cjs') as {
  localSetting: (env: NodeJS.ProcessEnv, key: string) => string | undefined;
  serverConfig: (env: NodeJS.ProcessEnv, root: string) => { directory: string; port: number };
  childServerEnv: (env: NodeJS.ProcessEnv, dataDirectory: string, port: number) => NodeJS.ProcessEnv;
};

test('LOCALNEURON tem precedência e COLMEIA continua como reserva', () => {
  const both = { LOCALNEURON_DATA_DIR: '/dados/novo', COLMEIA_DATA_DIR: '/dados/antigo', LOCALNEURON_PORT: '4400', COLMEIA_PORT: '4317', LOCALNEURON_DESKTOP_DATA_DIR: '/desktop/novo', COLMEIA_DESKTOP_DATA_DIR: '/desktop/antigo' };
  assert.equal(localSetting(both, 'DATA_DIR'), '/dados/novo');
  assert.equal(localSetting(both, 'PORT'), '4400');
  assert.equal(localSetting(both, 'DESKTOP_DATA_DIR'), '/desktop/novo');
  assert.equal(localSetting({ COLMEIA_DATA_DIR: '/dados/antigo', COLMEIA_PORT: '4321', COLMEIA_DESKTOP_DATA_DIR: '/desktop/antigo' }, 'DATA_DIR'), '/dados/antigo');
  assert.equal(localSetting({ COLMEIA_PORT: '4321' }, 'PORT'), '4321');
  assert.equal(localSetting({ COLMEIA_DESKTOP_DATA_DIR: '/desktop/antigo' }, 'DESKTOP_DATA_DIR'), '/desktop/antigo');
  assert.equal(localSetting({ LOCALNEURON_DATA_DIR: '   ', COLMEIA_DATA_DIR: '/dados/antigo' }, 'DATA_DIR'), '/dados/antigo');
  assert.equal(localSetting({ LOCALNEURON_PORT: '', COLMEIA_PORT: '4322' }, 'PORT'), '4322');
  assert.equal(localSetting({}, 'DATA_DIR'), undefined);
  const fallback = serverConfig({ COLMEIA_PORT: '4320' }, '/app');
  assert.equal(fallback.directory, resolve('/app/.data'));
  assert.equal(fallback.port, 4320);
  const preferred = serverConfig({ LOCALNEURON_DATA_DIR: '/dados/novo', COLMEIA_DATA_DIR: '/dados/antigo', LOCALNEURON_PORT: '4500', COLMEIA_PORT: '1' }, '/app');
  assert.equal(preferred.directory, '/dados/novo');
  assert.equal(preferred.port, 4500);
  const defaults = serverConfig({}, '/app');
  assert.equal(defaults.directory, resolve('/app/.data'));
  assert.equal(defaults.port, 4317);
  const child = childServerEnv({ LOCALNEURON_DATA_DIR: '/herdado', COLMEIA_PORT: '1', OTHER: 'mantido' }, '/espaco/workspace', 4318);
  assert.equal(child.LOCALNEURON_DATA_DIR, '/espaco/workspace');
  assert.equal(child.COLMEIA_DATA_DIR, '/espaco/workspace');
  assert.equal(child.LOCALNEURON_PORT, '4318');
  assert.equal(child.COLMEIA_PORT, '4318');
  assert.equal(child.OTHER, 'mantido');
  assert.equal(serverConfig(child, '/app').directory, '/espaco/workspace');
  assert.equal(serverConfig(child, '/app').port, 4318);
});
