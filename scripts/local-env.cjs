'use strict';
const { join, resolve } = require('node:path');

function read(env, name) {
  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

// LOCALNEURON_* wins. COLMEIA_* remains so an existing installation keeps its folder.
function localSetting(env, key) {
  return read(env, `LOCALNEURON_${key}`) ?? read(env, `COLMEIA_${key}`);
}

function serverConfig(env, root) {
  return {
    directory: resolve(localSetting(env, 'DATA_DIR') || join(root, '.data')),
    port: Number(localSetting(env, 'PORT') || 4317),
  };
}

function childServerEnv(env, dataDirectory, port) {
  const value = String(port);
  return {
    ...env,
    LOCALNEURON_DATA_DIR: dataDirectory,
    COLMEIA_DATA_DIR: dataDirectory,
    LOCALNEURON_PORT: value,
    COLMEIA_PORT: value,
  };
}

module.exports = { localSetting, serverConfig, childServerEnv };
