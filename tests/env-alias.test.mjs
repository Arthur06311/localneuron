import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { legacyEnv, resetEnvWarnings } = createRequire(import.meta.url)('../desktop/env.cjs');
const secret = 'segredo-de-teste-7f3a';
const preferred = 'valor-novo-localneuron';

test('só LOCALNEURON_* é usado e não avisa', () => {
  resetEnvWarnings();
  const messages = [];
  const value = legacyEnv('DATA_DIR', { LOCALNEURON_DATA_DIR: preferred }, message => messages.push(message));
  assert.equal(value, preferred);
  assert.deepEqual(messages, []);
});

test('só COLMEIA_* continua valendo, avisa uma vez e não revela o valor', () => {
  resetEnvWarnings();
  const messages = [];
  const env = { COLMEIA_DATA_DIR: secret };
  assert.equal(legacyEnv('DATA_DIR', env, message => messages.push(message)), secret);
  assert.equal(legacyEnv('DATA_DIR', env, message => messages.push(message)), secret);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /COLMEIA_DATA_DIR está descontinuada/);
  assert.match(messages[0], /LOCALNEURON_DATA_DIR/);
  assert.equal(messages[0].includes(secret), false);
});

test('com as duas definidas, LOCALNEURON_* prevalece e não avisa', () => {
  resetEnvWarnings();
  const messages = [];
  const value = legacyEnv('PORT', {
    LOCALNEURON_PORT: '4321',
    COLMEIA_PORT: secret,
  }, message => messages.push(message));
  assert.equal(value, '4321');
  assert.deepEqual(messages, []);
});

test('o aviso de descontinuação sai uma vez por variável', () => {
  resetEnvWarnings();
  const messages = [];
  const warn = message => messages.push(message);
  const env = { COLMEIA_DATA_DIR: secret, COLMEIA_PORT: '4317' };
  legacyEnv('DATA_DIR', env, warn);
  legacyEnv('PORT', env, warn);
  legacyEnv('DATA_DIR', env, warn);
  legacyEnv('PORT', env, warn);
  assert.deepEqual(messages.map(message => message.includes('COLMEIA_DATA_DIR')), [true, false]);
  assert.equal(messages.filter(message => message.includes('COLMEIA_PORT')).length, 1);
  assert.equal(messages.length, 2);
  for (const message of messages) assert.equal(message.includes(secret), false);
});
