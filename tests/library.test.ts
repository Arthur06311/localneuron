import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CATALOG, catalogModel } from '../src/catalog.js';
import { downloadVerified, admitMemory, ModelLibrary } from '../src/model-library.js';

const sample = Buffer.from('GGUF fixture bytes, not a real model');
const fixture = { ...CATALOG[0], bytes: sample.length, sha256: createHash('sha256').update(sample).digest('hex') } as any;
const signal = () => new AbortController().signal;

test('Download fixa versão, limita destinos HTTPS e confere bytes e SHA-256', async () => {
  const dir=mkdtempSync(join(tmpdir(),'catalog-test-'));
  try {
    let progress=0;const destination=join(dir,'model.gguf');
    await downloadVerified(fixture,destination,signal(),n=>progress=n,(async (url:any)=>{assert.ok(String(url).includes(fixture.revision));return new Response(sample);}) as any);
    assert.deepEqual(readFileSync(destination),sample);assert.equal(progress,sample.length);
    await assert.rejects(downloadVerified({...fixture,sha256:'0'.repeat(64)},join(dir,'bad'),signal(),()=>{},(async()=>new Response(sample)) as any),/SHA-256/);
    await assert.rejects(downloadVerified(fixture,join(dir,'short'),signal(),()=>{},(async()=>new Response('short')) as any),/incompleto/);
    await assert.rejects(downloadVerified(fixture,join(dir,'large'),signal(),()=>{},(async()=>new Response(Buffer.alloc(100))) as any),/excedeu/);
    for (const location of ['http://127.0.0.1/secret','https://example.com/weights','https://huggingface.co.evil.test/','https://huggingface.co:9999/model']) {
      let calls=0;await assert.rejects(downloadVerified(fixture,join(dir,'redirect'),signal(),()=>{},(async()=>{calls++;return new Response(null,{status:302,headers:{location}});}) as any),/não autorizado/);assert.equal(calls,1);
    }
    const controller=new AbortController();controller.abort();
    await assert.rejects(downloadVerified(fixture,join(dir,'cancelled'),controller.signal,()=>{},(async()=>new Response(sample)) as any));
    assert.throws(()=>catalogModel('../../vault'),/fora do catálogo/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('Admissão reserva folga e rejeita pressão de memória sem fallback',()=>{
  const G=1024**3;admitMemory(2*G,3*G,null);
  assert.throws(()=>admitMemory(2*G,3*G-1,null),/insuficiente/);
  assert.throws(()=>admitMemory(2*G,10*G,4),/insuficiente/);
});

test('Gerenciador só carrega chaves instaladas, contexto curto e descarrega instâncias conhecidas',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'library-test-')),events:string[]=[],sent:any[]=[];
  const manager=new ModelLibrary(dir,async type=>{events.push(type);},null);
  const inventory={models:[{type:'llm',key:'small-local',size_bytes:1024,loaded_instances:[]},{type:'llm',key:'ready',size_bytes:1024,loaded_instances:[{id:'instance-ready'}]}]};
  mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
    assert.ok(url.startsWith('http://127.0.0.1:8080/'));assert.equal(options.redirect,'error');
    if(!options.body)return Response.json(inventory);
    sent.push(JSON.parse(options.body as string));return Response.json({status:'loaded',instance_id:'loaded-id',load_config:{context_length:4096}});
  });
  try {
    await assert.rejects(manager.load('https://evil.test/model'),/não encontrado/);assert.equal(sent.length,0);
    assert.equal((await manager.load('ready')).instance_id,'instance-ready');assert.equal(sent.length,0);
    await manager.load('small-local',8192);assert.deepEqual(sent[0],{model:'small-local',context_length:8192,flash_attention:true,echo_load_config:true});
    await assert.rejects(manager.unload('unknown'),/não encontrado/);
    await manager.unload('instance-ready');assert.deepEqual(sent[1],{instance_id:'instance-ready'});
    assert.ok(events.includes('model.load.requested'));assert.ok(events.includes('model.unload.completed'));
    await assert.rejects(manager.download('arbitrary'),/fora do catálogo/);
  } finally {mock.restoreAll();rmSync(dir,{recursive:true,force:true});}
});

test('Arquivo alterado nunca é importado; downloads interrompidos são recuperáveis',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'library-recover-'));
  try {
    const first=new ModelLibrary(dir,async()=>{},null);
    first.jobs['qwen3-mini']={id:'qwen3-mini',state:'downloading',downloaded:4,total:CATALOG.find(m=>m.id==='qwen3-mini')!.bytes};first.save();
    const recovered=new ModelLibrary(dir,async()=>{},null);
    assert.equal(recovered.jobs['qwen3-mini'].state,'failed');
    writeFileSync(join(recovered.directory,CATALOG.find(m=>m.id==='qwen3-mini')!.file),'tampered');
    await assert.rejects(recovered.install('qwen3-mini'),/alterado/);
    assert.equal(recovered.busy,false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
