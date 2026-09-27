import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../website/',import.meta.url));
test('Pages assets and anchors work under a repository subpath',async()=>{
 for(const name of ['index.html','guide.html']){
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
 const manifest=JSON.parse(await readFile(resolve(root,'releases.json'),'utf8'));
 assert.equal(manifest.version,JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version);assert.deepEqual(manifest.files.map(x=>x.id),['mac','windows','linux']);
 for(const item of manifest.files){assert.match(item.sha256,/^[a-f0-9]{64}$/);assert(item.bytes>1000000&&item.bytes<2*1024**3);assert.equal(typeof item.available,'boolean');assert.equal(item.href,`https://github.com/Arthur06311/localneuron/releases/download/v${manifest.version}/${item.filename}`);}
});
test('Pages uses a static allowlist without local administrative APIs',async()=>{
 assert.deepEqual((await readdir(root)).sort(),['.nojekyll','CNAME','app-icon.png','app.js','guide.html','index.html','locale.js','product.png','downloads.json','releases.json','style.css'].sort());
 const js=await readFile(resolve(root,'app.js'),'utf8');
 assert(js.includes("fetch('./downloads.json'"));assert(!js.includes('/api/locale'));assert(!js.includes('/api/releases'));assert(!/127\.0\.0\.1|localhost|\/v1\//.test(js));
});

test('Website downloads use the published per-platform installer without altering the legacy update feed',async()=>{
 const data=JSON.parse(await readFile(resolve(root,'downloads.json'),'utf8'));
 assert.deepEqual(data.files.map(f=>f.id),['mac','windows','linux']);
 for(const f of data.files){assert.match(f.releaseTag,/^v\d+\.\d+\.\d+(?:-linux\.\d+)?$/);assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.equal(f.available,true);assert.equal(f.href,`https://github.com/Arthur06311/localneuron/releases/download/${f.releaseTag}/${f.filename}`);}
 const linux=data.files.find(f=>f.id==='linux');assert.equal(linux.filename,'LocalNeuron-Linux-x64.deb');assert.equal(linux.releaseTag,'v0.27.0-linux.3');assert.equal(linux.alternatives[0].filename,'LocalNeuron-Linux-x64.pkg.tar.gz');assert.match(linux.alternatives[0].sha256,/^[a-f0-9]{64}$/);
});
