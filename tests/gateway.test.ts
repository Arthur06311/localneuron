import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gateway } from '../src/gateway.js';
import { optionsSchema } from '../src/inference.js';

test('API isolada autentica, responde nos dois formatos e não publica o painel',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'api-test-'));let permitted=true,calls=0;
 const gateway=new Gateway(dir,()=>permitted,async(_model,messages,_options,signal,delta)=>{calls++;assert.equal(messages.at(-1)?.content,'Olá');signal.throwIfAborted();delta('Oi');delta('Oi, tudo bem?');return {text:'Oi, tudo bem?',finish_reason:'stop',elapsed_ms:10,omitted_messages:0,context:8192,prompt_tokens:2,completion_tokens:4};},0);
 try{
  const {key}=await gateway.rotate();assert.ok(!readFileSync(join(dir,'sharing.json'),'utf8').includes(key));assert.ok(!JSON.stringify(gateway.status()).includes(key));
  await assert.rejects(gateway.start('0.0.0.0','model',optionsSchema.parse({})),/rede privada/);
  await gateway.start('127.0.0.1','model',optionsSchema.parse({}));const url=gateway.status().base_url!,headers={authorization:'Bearer '+key,'content-type':'application/json'};
  assert.equal((await fetch(url+'/models')).status,401);assert.equal((await fetch(url+'/models',{headers:{authorization:'Bearer bad-key'}})).status,401);
  assert.equal((await fetch(url+'/workspace',{headers})).status,404);assert.equal((await fetch(url+'/models',{headers:{...headers,origin:'https://evil.example'}})).status,403);
  assert.equal((await (await fetch(url+'/models',{headers})).json() as any).data[0].id,'local');
  const input={model:'local',messages:[{role:'user',content:'Olá'}]};
  const normal=await fetch(url+'/chat/completions',{method:'POST',headers,body:JSON.stringify(input)});assert.equal(normal.status,200);assert.equal((await normal.json() as any).choices[0].message.content,'Oi, tudo bem?');
  const stream=await fetch(url+'/chat/completions',{method:'POST',headers,body:JSON.stringify({...input,stream:true,stream_options:{include_usage:true}})});const output=await stream.text();assert.match(output,/chat.completion.chunk/);assert.match(output,/\[DONE\]/);assert.match(output,/completion_tokens/);
  assert.equal((await fetch(url+'/chat/completions',{method:'POST',headers,body:JSON.stringify({...input,tools:[]})})).status,400);
  permitted=false;assert.equal((await fetch(url+'/chat/completions',{method:'POST',headers,body:JSON.stringify(input)})).status,503);assert.equal(calls,2);
  await gateway.revoke();assert.equal(gateway.status().enabled,false);assert.equal(gateway.status().has_key,false);await assert.rejects(gateway.start('127.0.0.1','model',optionsSchema.parse({})),/chave/);
 }finally{await gateway.stop();rmSync(dir,{recursive:true,force:true});}
});
test('Desligar API cancela geração e uma segunda chamada não compete por memória',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'api-cancel-'));let began!:()=>void;const ready=new Promise<void>(resolve=>began=resolve);
 const gateway=new Gateway(dir,()=>true,async(_m,_messages,_o,signal,delta)=>{delta('parcial');began();await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));signal.throwIfAborted();throw new Error('unreachable');},0);
 try{const {key}=await gateway.rotate();await gateway.start('127.0.0.1','model',optionsSchema.parse({}));const url=gateway.status().base_url!,headers={authorization:'Bearer '+key,'content-type':'application/json'},body=JSON.stringify({model:'local',messages:[{role:'user',content:'Oi'}],stream:true});const pending=fetch(url+'/chat/completions',{method:'POST',headers,body});await ready;assert.equal((await fetch(url+'/chat/completions',{method:'POST',headers,body})).status,503);const response=await pending;const text=response.text();await gateway.stop();assert.match(await text,/interrompida/);assert.equal(gateway.busy,false);}
 finally{await gateway.stop();rmSync(dir,{recursive:true,force:true});}
});
test('Chaves Pro limitam tokens e cota inclusive em concorrência; chat remoto exige chave',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'api-pro-'));let calls=0;const gateway=new Gateway(dir,()=>true,async(_m,_messages,options)=>{calls++;assert.equal(options.max_tokens,128);await new Promise(r=>setTimeout(r,100));return {text:'Olá',finish_reason:'stop',elapsed_ms:100,omitted_messages:0,context:4096};},0);
 try{const {key}=gateway.addKey({name:'Notebook',daily:1,max_tokens:128});assert.ok(!readFileSync(join(dir,'sharing.json'),'utf8').includes(key));await gateway.start('127.0.0.1','model',optionsSchema.parse({}));const base=gateway.status().base_url!,origin=base.replace('/v1','');assert.equal((await fetch(origin+'/remote')).status,200);assert.equal((await fetch(base+'/models',{headers:{origin}})).status,401);const request=()=>fetch(base+'/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json',origin},body:JSON.stringify({model:'local',messages:[{role:'user',content:'Oi'}],max_tokens:4096})});const results=await Promise.all([request(),request(),request()]);assert.deepEqual(results.map(r=>r.status).sort(),[200,429,429]);assert.equal(calls,1);assert.equal(gateway.status().queued,0);await gateway.removeKey(gateway.status().keys[0].id);assert.equal(gateway.status().enabled,false);}finally{await gateway.stop();rmSync(dir,{recursive:true,force:true});}
});
test('Expirar Pro recusa chave premium sem consumir cota e preserva chave básica',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'api-plan-'));let active=true,calls=0;
 const gateway=new Gateway(dir,()=>true,async()=>{calls++;return {text:'OK',finish_reason:'stop',elapsed_ms:1,omitted_messages:0,context:4096};},0,process.cwd(),()=>active);
 try{const basic=await gateway.rotate(),premium=gateway.addKey({name:'Pro',daily:20,max_tokens:128});await gateway.start('127.0.0.1','model',optionsSchema.parse({}));const request=(key:string)=>fetch(gateway.status().base_url+'/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:'local',messages:[{role:'user',content:'Oi'}]})});
 assert.equal((await request(premium.key)).status,200);active=false;assert.equal((await request(premium.key)).status,402);assert.equal((await request(basic.key)).status,200);assert.equal(gateway.status().keys[0].used,1);assert.equal(calls,2);
 }finally{await gateway.stop();rmSync(dir,{recursive:true,force:true});}
});
