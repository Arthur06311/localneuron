import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalText,manifestsFromSource,mergeWorkflowSums} from '../scripts/build-release-manifest.mjs';

const source=JSON.parse(readFileSync(new URL('../catalog/release-source.json',import.meta.url),'utf8'));

test('O catálogo gera o site e o feed com os mesmos bytes e hashes',()=>{
 const built=manifestsFromSource(source);
 assert.equal(built.downloads.files.find(file=>file.id==='linux').filename,'LocalNeuron-Linux-x64.deb');
 assert.equal(built.downloads.files.find(file=>file.id==='linux').alternatives[0].filename,'LocalNeuron-Linux-x64.pkg.tar.gz');
 const deb=built.releases.files.find(file=>file.filename==='LocalNeuron-Linux-x64.deb');
 assert.equal(deb.href,'https://github.com/Arthur06311/localneuron/releases/download/v0.27.0-linux.3/LocalNeuron-Linux-x64.deb');
 assert.equal(deb.sha256,built.downloads.files.find(file=>file.id==='linux').sha256);
});

test('As somas do workflow entram no feed como rascunho, sem apagar o que já foi publicado',()=>{
 const dir=mkdtempSync(join(tmpdir(),'release-sums-'));
 try{
  const payload=Buffer.from('instalador');
  const digest=createHash('sha256').update(payload).digest('hex');
  const names=[
   'LocalNeuron-Linux-x64.AppImage','LocalNeuron-Linux-x64.deb','LocalNeuron-Linux-x64.pkg.tar.gz',
   'LocalNeuron-Windows-x64-Setup.exe','LocalNeuron-macOS-arm64.dmg','LocalNeuron-macOS-arm64.zip',
  ];
  const lines=names.map(filename=>{writeFileSync(join(dir,filename),payload);return `${digest}  ${filename}`;});
  writeFileSync(join(dir,'SHA256SUMS.txt'),`${lines.join('\n')}\n`);
  const merged=mergeWorkflowSums(source,{sums:join(dir,'SHA256SUMS.txt'),tag:'v0.28.0',version:'0.28.0',notes:'Notas 0.28'});
  const feed=manifestsFromSource(merged).releases;
  for(const filename of names){
   const item=feed.files.find(file=>file.filename===filename);
   assert.equal(item.available,false,filename);
   assert.equal(item.releaseTag,'v0.28.0');
   assert.equal(item.bytes,payload.length);
  }
  assert.equal(feed.files.find(file=>file.filename==='LocalNeuron-Windows-x64.zip').available,true);
  assert.throws(()=>mergeWorkflowSums(source,{sums:join(dir,'SHA256SUMS.txt'),tag:'v0.27.0-linux.3',version:'0.28.0',notes:'x'}),/não bate/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('A conferência do catálogo ignora CRLF do checkout no Windows',()=>{
 const lf='{\n  "version": "0.27.0"\n}\n';
 assert.equal(canonicalText(lf.replace(/\n/g,'\r\n')),lf);
 assert.equal(canonicalText(lf),lf);
});

test('Os downloads publicados têm URL, tamanho e SHA-256 fixos',()=>{
 const check=spawnSync(process.execPath,['scripts/build-release-manifest.mjs','--check'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 const manifest=JSON.parse(readFileSync(new URL('../catalog/releases.json',import.meta.url),'utf8'));
 const downloads=JSON.parse(readFileSync(new URL('../catalog/downloads.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'0.27.0');
 assert.equal(manifest.version,downloads.version);
 const feed=new Map(manifest.files.map(item=>[item.filename,item]));
 for(const item of downloads.files){
  const published=feed.get(item.filename);
  assert.ok(published,item.filename);
  assert.equal(published.sha256,item.sha256);assert.equal(published.bytes,item.bytes);assert.equal(published.href,item.href);assert.equal(published.releaseTag,item.releaseTag);
  for(const alternative of item.alternatives??[]){const extra=feed.get(alternative.filename);assert.ok(extra);assert.equal(extra.sha256,alternative.sha256);assert.equal(extra.href,alternative.href);}
 }
 for(const item of manifest.files){assert.match(item.sha256,/^[a-f0-9]{64}$/);assert(item.bytes>1000000&&item.bytes<2*1024**3);assert.equal(typeof item.available,'boolean');assert.equal(item.href,`https://github.com/Arthur06311/localneuron/releases/download/${item.releaseTag}/${item.filename}`);}
});

test('O catálogo de downloads usa o instalador publicado de cada plataforma',()=>{
 const data=JSON.parse(readFileSync(new URL('../catalog/downloads.json',import.meta.url),'utf8'));
 assert.deepEqual(data.files.map(f=>f.id),['mac','windows','linux']);
 for(const f of data.files){assert.match(f.releaseTag,/^v\d+\.\d+\.\d+(?:-linux\.\d+)?$/);assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.equal(typeof f.available,'boolean');assert.equal(f.href,`https://github.com/Arthur06311/localneuron/releases/download/${f.releaseTag}/${f.filename}`);}
 const linux=data.files.find(f=>f.id==='linux');assert.equal(linux.filename,'LocalNeuron-Linux-x64.deb');assert.equal(linux.releaseTag,'v0.27.0-linux.3');assert.equal(linux.alternatives[0].filename,'LocalNeuron-Linux-x64.pkg.tar.gz');assert.match(linux.alternatives[0].sha256,/^[a-f0-9]{64}$/);
});
