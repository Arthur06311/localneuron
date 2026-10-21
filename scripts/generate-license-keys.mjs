#!/usr/bin/env node
// Gera o par Ed25519 da licença fora do repositório. A chave privada não é impressa.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function insideRepo(target) {
  const rel = relative(repoRoot, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function outsideRepo(file) {
  const abs = resolve(file);
  const parent = dirname(abs);
  const realParent = existsSync(parent) ? realpathSync(parent) : parent;
  const realFile = resolve(realParent, basename(abs));
  if (insideRepo(abs) || insideRepo(realFile)) {
    fail('A chave privada não pode ficar dentro do repositório. Escolha uma pasta fora dele, por exemplo ~/.localneuron.');
  }
  return realFile;
}

function readArgs(argv) {
  let dir = resolve(homedir(), '.localneuron');
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      console.log('Uso: npm run license-keys -- [--dir PASTA] [--force]\nA pasta padrão é ~/.localneuron. A chave privada nunca é gravada no repositório.');
      process.exit(0);
    } else if (arg === '--force') force = true;
    else if (arg === '--dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail('Informe a pasta depois de --dir.');
      dir = resolve(value);
      i += 1;
    } else fail('Argumento desconhecido: ' + arg + '. Use --help.');
  }
  return { dir, force };
}

const { dir, force } = readArgs(process.argv.slice(2));
const privatePath = outsideRepo(resolve(dir, 'license-private.pem'));
const publicPath = outsideRepo(resolve(dir, 'license-public.pem'));
if (!force && (existsSync(privatePath) || existsSync(publicPath))) {
  fail('O par já existe. Use --force só se quiser substituir. Licenças já emitidas deixam de valer se a chave mudar.');
}

const pair = generateKeyPairSync('ed25519');
const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
mkdirSync(dirname(privatePath), { recursive: true, mode: 0o700 });
writeFileSync(privatePath, privatePem, { mode: 0o600 });
writeFileSync(publicPath, publicPem, { mode: 0o644 });

console.log('Chave privada (não commite, não cole em chat): ' + privatePath);
console.log('Chave pública: ' + publicPath);
console.log(String(publicPem).trim());
