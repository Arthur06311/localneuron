#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyPackage } from './protocol.mjs';
try {
  const [file, trust] = process.argv.slice(2);
  if (!file || !trust) throw new Error('Uso: node scripts/verify.mjs pacote.json IMPRESSAO_DIGITAL_CONFIAVEL');
  const result = verifyPackage(JSON.parse(readFileSync(file, 'utf8')), trust);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
