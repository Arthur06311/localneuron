import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Updates,currentTarget,newerVersion,platformOffer,releaseManifest,RELEASE_FEED} from '../src/updates.js';

const macTarget={id:'mac' as const,arch:'arm64' as const};
const windowsTarget={id:'windows' as const,arch:'x64' as const};
const linuxTarget={id:'linux' as const,arch:'x64' as const};
const hash='a'.repeat(64);
const manifest=(version='0.28.0')=>({version,notes:'Novidades',files:[{id:'mac',filename:'LocalNeuron-macOS-arm64.dmg',bytes:123,sha256:hash,available:true,href:`https://github.com/Arthur06311/localneuron/releases/download/v${version}/LocalNeuron-macOS-arm64.dmg`}]});
const file=(id:'mac'|'windows'|'linux',filename:string,fileVersion:string,tag:string,available=true)=>({id,filename,bytes:2000000,sha256:hash,available,version:fileVersion,releaseTag:tag,href:`https://github.com/Arthur06311/localneuron/releases/download/${tag}/${filename}`});

test('Atualizações comparam versões numericamente e só aceitam downloads oficiais',()=>{
 assert.equal(newerVersion('0.100.0','0.27.0'),true);
 assert.equal(newerVersion('0.27.0','0.27.0'),false);
 assert.equal(newerVersion('0.9.0','0.27.0'),false);
 assert.throws(()=>newerVersion('garbage','0.27.0'));
 assert.equal(releaseManifest(manifest()).files.length,1);
 for(const href of ['https://evil.example/app.dmg','https://github.com/evil/release/app','javascript:alert(1)'])assert.throws(()=>releaseManifest({...manifest(),files:[{...manifest().files[0],href}]}));
 assert.throws(()=>releaseManifest({...manifest(),files:[...manifest().files,...manifest().files]}));
});

test('O feed aceita o AppImage, o NSIS e as tags já publicadas',()=>{
 const legacyLinux=releaseManifest({version:'0.27.0',files:[file('linux','LocalNeuron-Linux-x64.tar.gz','0.27.0','v0.27.0')]});
 assert.equal(legacyLinux.files[0].arch,'x64');
 const published=releaseManifest({version:'0.27.0',files:[
  file('linux','LocalNeuron-Linux-x64.deb','0.27.0','v0.27.0-linux.3'),
  file('linux','LocalNeuron-Linux-x64.pkg.tar.gz','0.27.0','v0.27.0-linux.3'),
  file('mac','LocalNeuron-macOS-arm64.dmg','0.26.0','v0.26.0'),
  file('windows','LocalNeuron-Windows-x64.zip','0.26.0','v0.26.0'),
 ]});
 assert.equal(published.files.length,4);
 const workflow=releaseManifest({version:'0.28.0',files:[
  file('linux','LocalNeuron-Linux-x64.AppImage','0.28.0','v0.28.0'),
  file('windows','LocalNeuron-Windows-x64-Setup.exe','0.28.0','v0.28.0'),
 ]});
 assert.equal(platformOffer(workflow,linuxTarget)?.filename,'LocalNeuron-Linux-x64.AppImage');
 assert.equal(platformOffer(workflow,windowsTarget)?.filename,'LocalNeuron-Windows-x64-Setup.exe');
 assert.throws(()=>releaseManifest({version:'0.27.0',files:[file('linux','LocalNeuron-Linux-x64.deb','0.27.0','v0.27.0-evil')]}));
 assert.throws(()=>releaseManifest({version:'0.27.0',files:[file('windows','LocalNeuron-Windows-x64.zip','0.26.0','v0.27.0-linux.3')]}));
 assert.throws(()=>releaseManifest({version:'0.28.0',files:[file('linux','LocalNeuron-Linux-x64.tar.gz','0.28.0','v0.28.0')].map(item=>({...item,filename:'LocalNeuron-Linux-x64.rpm'}))}));
});

test('A disponibilidade é da plataforma e da arquitetura, não de qualquer pacote',async()=>{
 const release=releaseManifest({version:'0.27.0',notes:'Notas',files:[
  file('linux','LocalNeuron-Linux-x64.deb','0.27.0','v0.27.0-linux.3'),
  file('linux','LocalNeuron-Linux-x64.pkg.tar.gz','0.27.0','v0.27.0-linux.3'),
  file('mac','LocalNeuron-macOS-arm64.dmg','0.26.0','v0.26.0'),
  file('windows','LocalNeuron-Windows-x64.zip','0.26.0','v0.26.0'),
 ]});
 const parent=mkdtempSync(join(tmpdir(),'neuron-updates-platform-'));
 const dir=join(parent,'linux'),macDir=join(parent,'mac'),windowsDir=join(parent,'windows');
 mkdirSync(dir);mkdirSync(macDir);mkdirSync(windowsDir);
 try{
  const linux=new Updates(dir,'0.26.0',async()=>Response.json(release),linuxTarget);
  await linux.check(true);
  assert.equal(linux.status().available,true);
  assert.equal(linux.status().offer?.filename,'LocalNeuron-Linux-x64.deb');
  assert.equal(linux.status().offer?.version,'0.27.0');
  assert.match(linux.status().release?.url??'',/v0\.27\.0-linux\.3/);
  const mac=new Updates(macDir,'0.26.0',async()=>Response.json(release),macTarget);
  await mac.check(true);
  assert.equal(mac.status().available,false);
  assert.equal(mac.status().offer?.version,'0.26.0');
  const windows=new Updates(windowsDir,'0.26.0',async()=>Response.json(release),windowsTarget);
  await windows.check(true);
  assert.equal(windows.status().available,false);
  const both=releaseManifest({version:'0.28.0',files:[file('linux','LocalNeuron-Linux-x64.deb','0.27.0','v0.27.0-linux.3'),file('linux','LocalNeuron-Linux-x64.AppImage','0.28.0','v0.28.0')]});
  assert.equal(platformOffer(both,linuxTarget)?.filename,'LocalNeuron-Linux-x64.AppImage');
  assert.equal(currentTarget('darwin','arm64')?.id,'mac');
  assert.equal(currentTarget('win32','x64')?.id,'windows');
  assert.equal(currentTarget('linux','x64')?.id,'linux');
  assert.equal(currentTarget('linux','arm64'),null);
 }finally{rmSync(parent,{recursive:true,force:true});}
});

test('Aviso persiste, respeita desativação e volta na próxima versão; offline preserva cache',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-updates-'));
 let calls=0,release=manifest(),offline=false;
 const fetcher:typeof fetch=async(url,options)=>{calls++;assert.equal(url,RELEASE_FEED);assert.equal(options?.redirect,'error');assert.equal(options?.body,undefined);if(offline)throw Error('offline');return Response.json(release);};
 try{
  let updates=new Updates(dir,'0.27.0',fetcher,macTarget);
  await updates.check();
  assert.equal(updates.status().available,true);
  assert.equal(calls,1);
  await updates.check();
  assert.equal(calls,1);
  updates.dismiss({version:'0.28.0'});
  updates=new Updates(dir,'0.27.0',fetcher,macTarget);
  assert.equal(updates.status().dismissed,true);
  updates.preferences({automatic:false});
  await updates.check();
  assert.equal(calls,1);
  release=manifest('0.29.0');
  await updates.check(true);
  assert.equal(updates.status().dismissed,false);
  assert.equal(updates.status().automatic,false);
  offline=true;
  await updates.check(true);
  assert.match(updates.status().error,/offline/);
  assert.equal(updates.status().release?.version,'0.29.0');
  assert.equal(updates.status().available,true);
  assert.equal(new Updates(dir,'0.29.0',fetcher,macTarget).status().available,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Manifesto excessivo ou inválido não produz link de instalação',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-updates-invalid-'));
 try{
  const updates=new Updates(dir,'0.27.0',async()=>new Response('x'.repeat(130*1024)),macTarget);
  await updates.check(true);
  assert.equal(updates.status().release,null);
  assert.equal(updates.status().available,false);
  assert.ok(updates.status().error);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('O feed gerado do catálogo único é aceito e não avisa Mac só com o Linux 0.27',async()=>{
 const release=releaseManifest(JSON.parse(readFileSync(new URL('../../website/releases.json',import.meta.url),'utf8')));
 assert.equal(platformOffer(release,linuxTarget)?.filename,'LocalNeuron-Linux-x64.deb');
 assert.equal(platformOffer(release,macTarget)?.version,'0.26.0');
 const parent=mkdtempSync(join(tmpdir(),'neuron-updates-feed-'));
 const macDir=join(parent,'mac'),linuxDir=join(parent,'linux');
 mkdirSync(macDir);mkdirSync(linuxDir);
 try{
  const mac=new Updates(macDir,'0.27.0',async()=>Response.json(release),macTarget);
  await mac.check(true);
  assert.equal(mac.status().available,false);
  const linux=new Updates(linuxDir,'0.26.0',async()=>Response.json(release),linuxTarget);
  await linux.check(true);
  assert.equal(linux.status().available,true);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
