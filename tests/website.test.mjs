import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../website/',import.meta.url));
test('Pages assets and anchors work under a repository subpath',async()=>{
 for(const name of ['index.html','guide.html','compare-lm-studio.html']){
  const html=await readFile(resolve(root,name),'utf8');
  assert.match(html,/<main\b/);assert.match(html,/<h1\b/);
  for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(/^https:\/\//.test(href))continue;
   assert(!href.startsWith('/'),'Root-relative asset: '+href);
   const [path,anchor]=href.split('#'),destination=resolve(root,path||name);
   assert(destination===root.slice(0,-1)||destination.startsWith(root),'Outside website: '+href);
   const info=await stat(destination),page=info.isDirectory()?resolve(destination,'index.html'):destination;
   if(anchor)assert((await readFile(page,'utf8')).includes(`id="${anchor}"`),'Missing anchor '+href);
  }
 }
});
test('Downloads have fixed release URLs, size and SHA-256',async()=>{
 const {spawnSync}=await import('node:child_process');
 const check=spawnSync(process.execPath,['scripts/build-release-manifest.mjs','--check'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 const manifest=JSON.parse(await readFile(resolve(root,'releases.json'),'utf8'));
 const downloads=JSON.parse(await readFile(resolve(root,'downloads.json'),'utf8'));
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
test('Pages uses a static allowlist without local administrative APIs',async()=>{
 assert.deepEqual((await readdir(root)).sort(),['.nojekyll','CNAME','app-icon.png','app.js','compare-lm-studio.html','guide.html','index.html','locale.js','product.png','downloads.json','release-source.json','releases.json','style.css'].sort());
 const js=await readFile(resolve(root,'app.js'),'utf8');
 assert(js.includes("fetch('./downloads.json'"));assert(!js.includes('/api/locale'));assert(!js.includes('/api/releases'));assert(!/127\.0\.0\.1|localhost|\/v1\//.test(js));
});

test('Website downloads use the published per-platform installer from the same catalog',async()=>{
 const data=JSON.parse(await readFile(resolve(root,'downloads.json'),'utf8'));
 assert.deepEqual(data.files.map(f=>f.id),['mac','windows','linux']);
 for(const f of data.files){assert.match(f.releaseTag,/^v\d+\.\d+\.\d+(?:-linux\.\d+)?$/);assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.equal(typeof f.available,'boolean');assert.equal(f.href,`https://github.com/Arthur06311/localneuron/releases/download/${f.releaseTag}/${f.filename}`);}
 const linux=data.files.find(f=>f.id==='linux');assert.equal(linux.filename,'LocalNeuron-Linux-x64.deb');assert.equal(linux.releaseTag,'v0.27.0-linux.3');assert.equal(linux.alternatives[0].filename,'LocalNeuron-Linux-x64.pkg.tar.gz');assert.match(linux.alternatives[0].sha256,/^[a-f0-9]{64}$/);
});
test('Visible website version stays on the published 0.27.0',async()=>{
 const escaped='0\\.27\\.0';
 const index=await readFile(resolve(root,'index.html'),'utf8');
 const app=await readFile(resolve(root,'app.js'),'utf8');
 assert.match(index,new RegExp(`id="version">${escaped}</span>`));
 assert.match(index,new RegExp(`Alfa ${escaped}</p>`));
 assert.match(index,new RegExp(`CENTRAL DE INFORMAÇÕES · ${escaped}`));
 assert.match(index,new RegExp(`${escaped}</span> / ALFA`));
 assert.doesNotMatch(index,/0\.26/);
 assert.match(app,new RegExp(`Alpha ${escaped}`));
 assert.match(app,new RegExp(`Alfa ${escaped}`));
 assert.match(app,new RegExp(`INFORMATION CENTER · ${escaped}`));
 assert.match(app,new RegExp(`CENTRO DE INFORMACIÓN · ${escaped}`));
 assert.doesNotMatch(app,/· 0\.27"/);
 const marker='const landingCopy=';
 const landingStart=app.indexOf(marker);
 assert.notEqual(landingStart,-1);
 let depth=0,inString=false,escape=false,end=-1;
 for(let i=landingStart+marker.length;i<app.length;i++){
  const c=app[i];
  if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;continue;}
  if(c==='"')inString=true;
  else if(c==='{')depth++;
  else if(c==='}'&&--depth===0){end=i;break;}
 }
 assert.notEqual(end,-1);
 const landing=JSON.parse(app.slice(landingStart+marker.length,end+1));
 const keys=Object.keys(landing.en);
 assert.deepEqual(Object.keys(landing),['en','es','fr','de','ja','zh']);
 for(const lang of Object.keys(landing))assert.deepEqual(Object.keys(landing[lang]),keys,lang);
 assert.match(landing.en.platforms,new RegExp(`Alpha ${escaped}`));
 assert.match(landing.es.platforms,new RegExp(`Alfa ${escaped}`));
 for(const name of ['guide.html','compare-lm-studio.html']){
  const html=await readFile(resolve(root,name),'utf8');
  assert.match(html,new RegExp(`<span>${escaped} · Alfa</span>`));
 }
});
