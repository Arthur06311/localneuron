import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {manifestsFromSource,mergeWorkflowSums} from '../scripts/build-release-manifest.mjs';

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
  const filename='LocalNeuron-Linux-x64.AppImage';
  writeFileSync(join(dir,filename),payload);
  const digest=createHash('sha256').update(payload).digest('hex');
  writeFileSync(join(dir,'SHA256SUMS.txt'),`${digest}  ${filename}\n`);
  const merged=mergeWorkflowSums(source,{sums:join(dir,'SHA256SUMS.txt'),tag:'v0.28.0',version:'0.28.0',notes:'Notas 0.28'});
  const feed=manifestsFromSource(merged).releases;
  const appimage=feed.files.find(file=>file.filename===filename);
  assert.equal(appimage.available,false);
  assert.equal(appimage.releaseTag,'v0.28.0');
  assert.equal(appimage.bytes,payload.length);
  assert.equal(feed.files.find(file=>file.filename==='LocalNeuron-Linux-x64.deb').available,true);
  assert.throws(()=>mergeWorkflowSums(source,{sums:join(dir,'SHA256SUMS.txt'),tag:'v0.27.0-linux.3',version:'0.28.0',notes:'x'}),/não bate/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
