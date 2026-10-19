'use strict';

const warned = new Set();

function defined(value) {
  return typeof value === 'string' && value !== '';
}

function legacyEnv(suffix, env = process.env, warn = console.warn) {
  const preferredName = `LOCALNEURON_${suffix}`;
  const legacyName = `COLMEIA_${suffix}`;
  if (defined(env[preferredName])) return env[preferredName];
  if (!defined(env[legacyName])) return undefined;
  if (!warned.has(legacyName)) {
    warned.add(legacyName);
    warn(`LocalNeuron: ${legacyName} está descontinuada. Use ${preferredName}. O valor não é exibido.`);
  }
  return env[legacyName];
}

function resetEnvWarnings() {
  warned.clear();
}

module.exports = { legacyEnv, resetEnvWarnings };
