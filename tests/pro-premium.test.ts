import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Pro} from '../src/pro.js';
import {Gateway} from '../src/gateway.js';
import {optionsSchema} from '../src/inference.js';
import {requiredFeature} from '../src/subscription.js';
const dir=()=>mkdtempSync(join(tmpdir(),'neuron-premium-'));
async function waitFor(predicate:()=>boolean){const end=Date.now()+6000;while(!predicate()){if(Date.now()>end)throw Error('Timeout');await new Promise(r=>setTimeout(r,25));}}
test('Fila pausada preserva ordem por prioridade; revisão usa duas passagens e mantém evidência',async()=>{
 const d=dir(),calls:any[]=[];const pro=new Pro(d,{canRun:()=>true,models:async()=>[{key:'small',size_bytes:100}],run:async(key,messages,options,signal,delta)=>{signal.throwIfAborted();calls.push({messages,options});return 'Versão '+calls.length;}});
 try{pro.queue(true);const p=pro.project({name:'Teste',memory:'Orçamento confirmado: 980 reais.'});
 const low=pro.enqueue({project:p.id,prompt:'Tarefa baixa',priority:0});const high=pro.enqueue({project:p.id,prompt:'Tarefa alta',quality:'thorough',priority:2,language:'es',style:'executive'});
 await new Promise(r=>setTimeout(r,800));assert.equal(calls.length,0);pro.queue(false);await waitFor(()=>low.state==='complete');
 assert.equal(high.state,'complete');assert.equal(high.calls,2);assert.equal(high.draft,'Versão 1');assert.equal(high.output,'Versão 2');assert.ok(high.finished_at!>=high.started_at!);assert.match(calls[0].messages[1].content,/Tarefa alta/);assert.match(calls[1].messages[1].content,/Versão 1/);assert.match(calls[1].messages[0].content,/980 reais/);assert.match(calls[1].messages[0].content,/espanhol/);assert.match(calls[2].messages[1].content,/Tarefa baixa/);
 assert.throws(()=>pro.prioritize(high.id,0),/Somente/);
 }finally{await pro.close();rmSync(d,{recursive:true,force:true});}
});
test('Modo rápido limita resposta e atalhos persistem no backup',async()=>{
 const d=dir();let captured:any;const pro=new Pro(d,{canRun:()=>true,models:async()=>[{key:'m',size_bytes:100}],run:async(k,m,o)=>{captured=o;return 'ok';}});
 try{const p=pro.project({name:'Projeto'});const t=pro.template({name:'Meu atalho',prompt:'Resuma o material',quality:'thorough'});pro.template({...t,name:'Nome revisado'});assert.equal(pro.state.templates.length,1);assert.throws(()=>pro.template({...t,id:'00000000-0000-4000-8000-000000000000'}),/não encontrado/);const j=pro.enqueue({project:p.id,prompt:'Resposta curta',quality:'fast'});await waitFor(()=>j.state==='complete');assert.equal(j.calls,1);assert.equal(captured.max_tokens,1024);assert.equal(captured.reasoning,'low');pro.queue(true);const backup=pro.backup('senha-ficticia-premium',[]);const inspected=pro.inspectBackup(backup,'senha-ficticia-premium');assert.equal(inspected.pro.templates[0].name,'Nome revisado');assert.equal(inspected.pro.queue_paused,true);
 }finally{await pro.close();rmSync(d,{recursive:true,force:true});}
});
test('Cancelar durante revisão mantém primeira versão e impede conclusão falsa',async()=>{
 const d=dir();let count=0;const pro=new Pro(d,{canRun:()=>true,models:async()=>[{key:'m',size_bytes:100}],run:async(k,m,o,signal)=>{if(++count===1)return 'Primeira versão preservada';return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('Cancelado')),{once:true});});}});
 try{const p=pro.project({name:'Projeto'}),j=pro.enqueue({project:p.id,prompt:'Revisar',quality:'thorough'});await waitFor(()=>j.calls===2);await pro.cancel(j.id);assert.equal(j.state,'cancelled');assert.equal(j.draft,'Primeira versão preservada');assert.ok(j.finished_at);
 }finally{await pro.close();rmSync(d,{recursive:true,force:true});}
});
test('Chave Pro permite editar cota e pausar sem trocar segredo; retomada aplica limite',async()=>{
 const d=dir();let count=0;const gateway=new Gateway(d,()=>true,async(m,msg,o)=>{count++;return {text:String(o.max_tokens),finish_reason:'stop',elapsed_ms:1,omitted_messages:0,context:2048};},0);
 try{const {key}=gateway.addKey({name:'Notebook',daily:10,max_tokens:2048});const id=gateway.status().keys[0].id;gateway.updateKey(id,{name:'Editor',daily:2,max_tokens:128,paused:true});await gateway.start('127.0.0.1','m',optionsSchema.parse({}));const send=()=>gateway.server!.inject({method:'POST',url:'/v1/chat/completions',headers:{authorization:'Bearer '+key},payload:{model:'local',messages:[{role:'user',content:'Oi'}]}});assert.equal((await send()).statusCode,403);assert.equal(count,0);gateway.updateKey(id,{name:'Editor',daily:1,max_tokens:128,paused:false});assert.equal((await send()).json().choices[0].message.content,'128');assert.equal((await send()).statusCode,429);assert.equal(gateway.status().keys[0].used,1);assert.equal(gateway.status().keys[0].name,'Editor');assert.ok(!('hash' in gateway.status().keys[0]));
 }finally{await gateway.stop();rmSync(d,{recursive:true,force:true});}
});
test('Novas mutações premium exigem assinatura; cancelamento e leitura continuam acessíveis',()=>{
 for(const p of ['/v1/pro/templates','/v1/pro/queue','/v1/pro/jobs/:id/priority','/v1/sharing/keys/:id'])assert.ok(requiredFeature('POST',p));assert.equal(requiredFeature('GET','/v1/pro'),undefined);assert.equal(requiredFeature('POST','/v1/pro/jobs/:id/cancel'),undefined);assert.equal(requiredFeature('DELETE','/v1/pro/templates/:id'),undefined);
});
