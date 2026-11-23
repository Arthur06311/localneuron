import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

function allowlist(server){
  const start=server.indexOf('const staticFiles');
  assert.ok(start>=0,'staticFiles declaration missing');
  const end=server.indexOf('};',start);
  return server.slice(start,end);
}

test('every stylesheet and script referenced by index.html is served',async()=>{
  const html=await readFile(resolve(root,'public/index.html'),'utf8');
  const block=allowlist(await readFile(resolve(root,'src/server.ts'),'utf8'));
  const refs=[...html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)="(\/[^"]+)"/g)].map(match=>match[1]);
  assert.ok(refs.includes('/a11y-visual.css'));
  assert.ok(refs.includes('/navigation.css'));
  for(const ref of refs){
    const key=ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(block,new RegExp(`['"]${key}['"]\\s*:`),`${ref} is missing from staticFiles`);
  }
});

test('o Chat importa /chat-edit.js e a allowlist entrega esse módulo',async()=>{
  const server=await readFile(resolve(root,'src/server.ts'),'utf8');
  const block=allowlist(server);
  const served=new Set([...block.matchAll(/['"]\/([^'"]+)['"]\s*:/g)].map(match=>match[1]));
  assert.match(block,/['"]\/chat-edit\.js['"]\s*:\s*\[\s*['"]chat-edit\.js['"]\s*,\s*['"]application\/javascript['"]\s*\]/);
  assert.match(block,/['"]\/chat-drop\.js['"]\s*:\s*\[\s*['"]chat-drop\.js['"]\s*,\s*['"]application\/javascript['"]\s*\]/);
  async function filesIn(dir,prefix=''){
    const found=[];
    for(const name of await readdir(dir,{withFileTypes:true})){
      if(name.name==='vendor'||name.name==='model-icons'||name.name==='mascotes')continue;
      const relative=prefix+name.name;
      if(name.isDirectory())found.push(...await filesIn(join(dir,name.name),relative+'/'));
      else if(name.name.endsWith('.js'))found.push(relative);
    }
    return found;
  }
  const missing=[];
  for(const file of await filesIn(resolve(root,'public'))){
    if(!served.has(file))continue;
    const source=await readFile(resolve(root,'public',file),'utf8');
    for(const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)){
      let spec=match[1].slice(2);
      if(!spec.endsWith('.js'))spec+='.js';
      if(spec.startsWith('vendor/'))continue;
      if(!served.has(spec))missing.push(`${file} -> ${spec}`);
    }
  }
  assert.deepEqual(missing,[]);
  const chat=await readFile(resolve(root,'public/chat.js'),'utf8');
  assert.match(chat,/from\s+["']\.\/chat-edit\.js["']/);
});
