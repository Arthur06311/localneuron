import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CATALOG, catalogFiles, modelUrl, type CatalogModel } from '../src/catalog.js';
import { MEDIA_CATALOG } from '../src/media-catalog.js';
import { downloadParts } from '../src/model-library.js';
import { ggufSetBytes } from '../src/gguf-parts.js';

test('661 versões únicas, fontes fixadas e arquivos completos',()=>{
 assert.equal(CATALOG.length,661);assert.equal(new Set(CATALOG.map(m=>m.id)).size,661);
 const added=CATALOG.filter(m=>m.id.startsWith('hf-'));assert.equal(added.length,200);assert.equal(new Set(added.map(m=>m.base_model)).size,200);
 assert.equal(CATALOG.filter(m=>m.id.startsWith('n09-')).length,350);assert.equal(new Set(CATALOG.filter(m=>m.id.startsWith('n09-')).map(m=>m.base_model)).size,350);
 const filenames=new Set<string>();
 for(const m of CATALOG){
  assert.match(m.revision,/^[a-f0-9]{40}$/);assert.ok(m.categories?.length);assert.ok(m.computer_ram_gib>m.ram_gib);
  if(m.id.startsWith('hf-'))assert.ok(['apache-2.0','mit','artistic-2.0','openmdw-1.1'].includes(m.license));
  const files=catalogFiles(m);assert.equal(files.reduce((a,f)=>a+f.bytes,0),m.bytes);assert.equal(files[0].file,m.file);
  for(const [i,f] of files.entries()){
   assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(f.bytes)&&f.bytes>0);assert.ok(!/[\\/]/.test(f.file));
   assert.ok(!filenames.has(f.file),f.file);filenames.add(f.file);
   const url=new URL(modelUrl(m,f));assert.equal(url.hostname,'huggingface.co');assert.ok(url.pathname.includes(m.revision));
   if(m.parts&&m.parts.length>1){assert.ok(f.file.endsWith(`-${String(i+1).padStart(5,'0')}-of-${String(files.length).padStart(5,'0')}.gguf`));assert.ok(!f.path?.split('/').includes('..'));}
  }
 }
 assert.ok(CATALOG.some(m=>m.parameters_b===235&&m.parts));assert.ok(CATALOG.some(m=>m.parameters_b===671&&m.parts));
 assert.equal(MEDIA_CATALOG.length,366);assert.ok(MEDIA_CATALOG.every(m=>m.external&&['Imagem','Vídeo'].includes(m.categories[0])));
});

test('Download multipart agrega progresso, usa subpastas da fonte e valida cada parte antes de continuar',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'colmeia-parts-'));
 const payload=[Buffer.from('GGUF first'),Buffer.from('GGUF second')];
 const parts=payload.map((b,i)=>({file:`fixture-${String(i+1).padStart(5,'0')}-of-00002.gguf`,path:`Q4_K_M/fixture-${String(i+1).padStart(5,'0')}-of-00002.gguf`,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}));
 const model:CatalogModel={...CATALOG[0],file:parts[0].file,parts,bytes:payload.reduce((a,b)=>a+b.length,0)};
 try{
  let calls=0,progress=0;await downloadParts(model,directory,new AbortController().signal,n=>{assert.ok(n>=progress);progress=n;},(async(url:any)=>{assert.ok(String(url).includes('/Q4_K_M/'));return new Response(payload[calls++]);}) as any);
  assert.equal(calls,2);assert.equal(progress,model.bytes);assert.deepEqual(readFileSync(join(directory,parts[1].file)),payload[1]);
  assert.equal(ggufSetBytes(directory,parts[0].file),model.bytes);assert.equal(ggufSetBytes(directory,parts[1].file),null);
  rmSync(join(directory,parts[1].file));assert.equal(ggufSetBytes(directory,parts[0].file),null);
  const bad=join(directory,'bad');mkdirSync(bad);calls=0;
  await assert.rejects(downloadParts(model,bad,new AbortController().signal,()=>{},(async()=>{calls++;return new Response(Buffer.alloc(payload[0].length));}) as any),/SHA-256/);assert.equal(calls,1);
  const aborted=new AbortController();aborted.abort();await assert.rejects(downloadParts(model,join(directory,'cancelled'),aborted.signal,()=>{}));
  symlinkSync(join(directory,parts[0].file),join(directory,parts[1].file));assert.equal(ggufSetBytes(directory,parts[0].file),null);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
