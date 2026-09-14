import test from 'node:test';
import assert from 'node:assert/strict';
import { contextWindow, optionsSchema, complete, type Message } from '../src/inference.js';
import { Core } from '../src/core.js';
import { Chats } from '../src/chat.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('Janela conserva instruções e turnos recentes sem exigir uma conversa nova',()=>{
 const messages:Message[]=[{role:'system',content:'Instrução importante'},...Array.from({length:80},(_,i)=>[{role:'user' as const,content:`pergunta ${i} `+'x'.repeat(300)},{role:'assistant' as const,content:`resposta ${i} `+'x'.repeat(400)}]).flat(),{role:'user',content:'Qual foi o último assunto?'}];
 const result=contextWindow(messages,optionsSchema.parse({context:4096,max_tokens:512}));assert.ok(result.omitted_messages>0);assert.deepEqual(result.messages[0],messages[0]);assert.deepEqual(result.messages.at(-1),messages.at(-1));assert.equal(result.messages[1].role,'user');assert.ok(messages.length>result.messages.length);
 assert.throws(()=>contextWindow([{role:'user',content:'x'.repeat(60000)}],optionsSchema.parse({context:4096})),/não cabe/);
 assert.equal(contextWindow([{role:'user',content:'Oi'}],optionsSchema.parse({context:65536}),4096).context,4096);
});
test('Adaptador preserva papéis, parâmetros, SSE fragmentado e término por limite',async()=>{
 const original=globalThis.fetch;let sent:any;
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/models'))return Response.json({models:[{type:'llm',key:'mini',loaded_instances:[{id:'loaded',config:{context_length:8192}}]}]});
  sent=JSON.parse(String(init?.body));const text='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'privado'}}]})+'\n\n'+'data: '+JSON.stringify({choices:[{delta:{content:'Olá **você**'},finish_reason:'length'}],usage:{prompt_tokens:25,completion_tokens:12}})+'\n\ndata: [DONE]\n\n';const bytes=new TextEncoder().encode(text);return new Response(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}}));
 };
 try{const messages:Message[]=[{role:'system',content:'Escreva bem.'},{role:'user',content:'Pergunta'},{role:'assistant',content:'Resposta anterior'},{role:'user',content:'Continue'}],deltas:string[]=[];const result=await complete('loaded',messages,optionsSchema.parse({context:8192,max_tokens:2048,temperature:1.1,reasoning:'high'}),new AbortController().signal,t=>deltas.push(t));assert.deepEqual(sent.messages,messages);assert.equal(sent.temperature,1.1);assert.equal(sent.reasoning_effort,'high');assert.equal(result.finish_reason,'length');assert.equal(result.completion_tokens,12);assert.equal(result.text,'Olá **você**');assert.ok(!deltas.join('').includes('privado'));}
 finally{globalThis.fetch=original;}
});
test('Regenerar preserva versões sem duplicar a pergunta, e parâmetros decimais persistem com integridade',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'chat-settings-'));let core=new Core(dir,resolve('.'));await core.init();await core.setup('senha-parametros-segura');let calls=0;const seen:unknown[]=[];const chat=new Chats(core,async(_m,messages,_s,_d,options)=>{seen.push(options);calls++;return 'Resposta '+calls;});
 try{const {id}=await chat.create('create-settings-01');await chat.send(id,'local','Olá','send-settings-01',{temperature:.8,top_p:.92});await Promise.all([...chat.jobs.values()].map(j=>j.promise));await chat.send(id,'local','Gerar novamente','retry-settings-01',{temperature:.9},true);await Promise.all([...chat.jobs.values()].map(j=>j.promise));const saved=(await chat.list())[0];assert.equal(saved.messages.length,2);assert.equal(saved.title,'Olá');assert.equal(saved.messages[1].versions?.[0].content,'Resposta 1');assert.equal(JSON.parse(saved.messages[1].options_json!).temperature,.9);assert.equal((seen[0] as any).top_p,.92);await core.close();core=new Core(dir,resolve('.'));await core.init();await core.unlock('senha-parametros-segura');assert.equal((await core.snapshot()).chats?.[0].messages[1].content,'Resposta 2');}
 finally{await chat.close();await core.close();rmSync(dir,{recursive:true,force:true});}
});
test('Resposta cortada mantém o trecho recebido e não é tratada como concluída',async()=>{
 const original=globalThis.fetch;const deltas:string[]=[];
 globalThis.fetch=async(url)=>String(url).endsWith('/models')?Response.json({models:[{type:'llm',key:'mini',loaded_instances:[{id:'loaded'}]}]}):new Response('data: '+JSON.stringify({choices:[{delta:{content:'Um trecho útil'},finish_reason:null}]})+'\n\n');
 try{await assert.rejects(complete('loaded',[{role:'user',content:'Oi'}],optionsSchema.parse({}),new AbortController().signal,t=>deltas.push(t)),/interrompida/);assert.deepEqual(deltas,['Um trecho útil']);}finally{globalThis.fetch=original;}
});
