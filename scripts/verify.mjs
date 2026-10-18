#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyPackage } from './protocol.mjs';
const [file, trust, extra] = process.argv.slice(2);
try {
  if (!file && !trust) {
    console.log('Nenhum pacote de auditoria informado. Conferindo a configuração pública.');
    const check = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-subscription.mjs', import.meta.url))], { stdio: 'inherit', cwd: fileURLToPath(new URL('..', import.meta.url)) });
    if (check.error) throw check.error;
    process.exitCode = check.status ?? 1;
  } else {
    if (!file || !trust || extra) throw new Error('Uso: node scripts/verify.mjs pacote.json IMPRESSAO_DIGITAL_CONFIAVEL');
    const result = verifyPackage(JSON.parse(readFileSync(file, 'utf8')), trust);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
