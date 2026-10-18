import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReleaseFiles} from '../scripts/check-release-version.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const changelog=(version,body='Notas da versão.')=>`# Changelog\n\n## [Unreleased]\n\n## [${version}] - 2026-09-17\n\n${body}\n`;

test('A tag, o package.json e o changelog precisam ser a mesma versão',()=>{
 const notes=checkReleaseFiles({version:'0.27.0',changelog:changelog('0.27.0','Lembrar o acesso.'),tag:'v0.27.0'});
 assert.match(notes.notes,/Lembrar o acesso/);
 assert.throws(()=>checkReleaseFiles({version:'0.27.0',changelog:changelog('0.27.0'),tag:'v0.28.0'}),/v0\.28\.0/);
 assert.throws(()=>checkReleaseFiles({version:'0.28.0',changelog:changelog('0.27.0'),tag:'v0.28.0'}),/0\.28\.0/);
 assert.throws(()=>checkReleaseFiles({version:'0.27.0',changelog:'# Changelog\n\n## [0.27.0]\n\nTexto\n',tag:'v0.27.0'}),/AAAA-MM-DD/);
 assert.throws(()=>checkReleaseFiles({version:'0.27.0',changelog:changelog('0.27.0','')}),/vazia/);
 assert.equal(checkReleaseFiles({version:'0.27.0',changelog:changelog('0.27.0')}).tag,null);
});

test('O repositório atual passa na checagem da 0.27.0',()=>{
 const result=spawnSync(process.execPath,['scripts/check-release-version.mjs','--tag','v0.27.0'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const wrong=spawnSync(process.execPath,['scripts/check-release-version.mjs','--tag','v9.9.9'],{cwd:root,encoding:'utf8'});
 assert.notEqual(wrong.status,0);
 assert.match(wrong.stderr,/v9\.9\.9/);
 const tagged=spawnSync(process.execPath,['scripts/check-release-version.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_REF:'refs/tags/v0.27.0-linux.3'}});
 assert.notEqual(tagged.status,0);
 assert.match(tagged.stderr,/v0\.27\.0-linux\.3/);
});

test('O workflow de release não usa segredo nem assinatura',()=>{
 const workflow=readFileSync(resolve(root,'.github/workflows/release.yml'),'utf8');
 assert.doesNotMatch(workflow,/secrets\./);
 assert.match(workflow,/workflow_dispatch/);
 assert.match(workflow,/tags:\s*\n\s*- ["']v\*["']/);
 assert.match(workflow,/--draft/);
 assert.match(workflow,/npm run package -- linux x64/);
 assert.match(workflow,/npm run package -- win32 x64/);
 assert.match(workflow,/package-appimage\.py/);
 assert.match(workflow,/package-nsis\.py/);
 assert.match(workflow,/SHA256SUMS\.txt/);
 assert.doesNotMatch(workflow,/signtool|notarytool|codesign|electron-builder|electron-forge/i);
 const ux=readFileSync(resolve(root,'public/ux.js'),'utf8');
 assert.match(ux,/clientOffer\(\)/);
 assert.match(ux,/!file/);
});

test('Notas saem só da seção da versão pedida',()=>{
 const dir=mkdtempSync(join(tmpdir(),'release-notes-'));
 try{
  mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.27.0'}));
  writeFileSync(join(dir,'CHANGELOG.md'),'# Changelog\n\n## [Unreleased]\n\nRascunho\n\n## [0.27.0] - 2026-09-17\n\nTexto da 0.27\n\n## [0.26.0] - 2026-09-01\n\nTexto antigo\n');
  const result=spawnSync(process.execPath,[resolve(root,'scripts/check-release-version.mjs'),'--root',dir,'--tag','v0.27.0','--notes-file',join(dir,'notes.md')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const notes=readFileSync(join(dir,'notes.md'),'utf8');
  assert.match(notes,/Texto da 0\.27/);
  assert.doesNotMatch(notes,/Texto antigo/);
  assert.doesNotMatch(notes,/Rascunho/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
