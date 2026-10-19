import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonicalText,manifestsFromSource,mergeWorkflowSums} from '../scripts/build-release-manifest.mjs';

const source=JSON.parse(readFileSync(new URL('../website/release-source.json',import.meta.url),'utf8'));

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
