import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHmac,generateKeyPairSync,randomUUID} from 'node:crypto';
import {Subscription,requiredFeature,verifyLease,type Lease} from '../src/subscription.js';
import {createBillingService,signLease,verifyWebhook} from '../src/billing-service.js';
import {optimizeContext} from '../src/optimization.js';
import {optionsSchema} from '../src/inference.js';
import {Core} from '../src/core.js';
import {createApp} from '../src/server.js';
import {testKeys,testConfig,activateTestPro} from './subscription-fixture.js';
const privateKey=testKeys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const temporary=()=>mkdtempSync(join(tmpdir(),'neuron-subscription-'));
const day=86400_000;
function lease(device:string,now:number):Lease {return {version:1,audience:'localneuron-pro',device,subscription:'sub_test',status:'active',issued_at:now,expires_at:now+7*day,period_end:now+30*day,cancel_at_period_end:false};}
test('Licença assinada: offline, reinício, expiração, cancelamento e relógio',()=>{
 const dir=temporary();let now=Date.now();const initial=now;
 try{let local=new Subscription(dir,testConfig,()=>now);assert.equal(local.active,false);local.install(signLease(lease(local.snapshot().device,now),privateKey));assert.equal(local.active,true);
 local=new Subscription(dir,testConfig,()=>now);assert.equal(local.active,true);now+=6*day;assert.equal(local.active,true);now+=day;assert.equal(local.active,false);
 local.install(signLease({...lease(local.snapshot().device,now),cancel_at_period_end:true},privateKey));assert.equal(local.snapshot().status,'canceling');now-=day;assert.equal(local.snapshot().status,'clock_error');now=initial+8*day;assert.equal(local.active,true);
 local.install(signLease({...lease(local.snapshot().device,now),status:'past_due',expires_at:now},privateKey));assert.equal(local.active,false);assert.equal(local.snapshot().status,'past_due');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Recusa adulteração, outra chave/dispositivo, licença antiga/futura e prazo excessivo',()=>{
 const dir=temporary(),now=Date.now();try{const local=new Subscription(dir,testConfig,()=>now),valid=lease(local.snapshot().device,now),token=signLease(valid,privateKey);local.install(token);
 const other=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'}).toString();
 for(const bad of [token.slice(0,-10)+'aaaaaaaaaa',signLease(valid,other),signLease({...valid,device:randomUUID()},privateKey),signLease({...valid,issued_at:now-1},privateKey),signLease({...valid,issued_at:now+day},privateKey),signLease({...valid,expires_at:now+8*day},privateKey)])assert.throws(()=>local.install(bad));
 assert.equal(local.active,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Divisão de recursos preserva dados, exportação, parada e recursos básicos',()=>{
 for(const [method,path,body] of [['GET','/v1/pro',{}],['GET','/v1/pro/projects/id/export/docx',{}],['POST','/v1/pro/projects',{id:'existing'}],['POST','/v1/pro/jobs/id/cancel',{}],['POST','/v1/pro/backup',{}],['POST','/v1/pro/backup/restore',{}],['DELETE','/v1/sharing/keys/id',{}],['POST','/v1/chats/id/send',{}],['POST','/v1/local-engines/transcribe',{}],['POST','/v1/model-library/load',{}]] as const)assert.equal(requiredFeature(method,path,body),undefined);
 assert.equal(requiredFeature('POST','/v1/pro/jobs'),'jobs');assert.equal(requiredFeature('POST','/v1/pro/optimize'),'performance');assert.equal(requiredFeature('POST','/v1/pro/projects',{}),'projects');
});
test('Rotas reais: Grátis bloqueia Pro no servidor, licença libera e expiração preserva projeto',async()=>{
 const dir=temporary(),core=new Core(dir,resolve('.'));await core.init();await core.setup('assinatura-senha-de-teste');const {app,subscription}=await createApp(core,'test-pro-token',undefined,undefined,testConfig);
 const headers={host:'127.0.0.1:4317',authorization:'Bearer test-pro-token'};
 const request=(method:any,url:string,payload?:any)=>app.inject({method,url,headers,payload});
 try{for(const path of ['/v1/pro/templates','/v1/pro/queue','/v1/pro/jobs/test/priority','/v1/sharing/keys/test','/v1/pro/projects','/v1/pro/jobs','/v1/pro/optimize','/v1/sharing/keys','/v1/pro/media/inpaint','/v1/subscription/studio'])assert.equal((await request('POST',path,{})).statusCode,402);
 assert.equal((await app.inject({method:'POST',url:'/v1/pro/jobs',headers:{host:headers.host},payload:{}})).statusCode,401);
 assert.equal((await request('POST','/v1/subscription/checkout',{})).statusCode,400);
 activateTestPro(subscription);const p=(await request('POST','/v1/pro/projects',{name:'Meu projeto',body:'Meu trabalho continua meu.'})).json();assert.ok(p.id);
 subscription.install(signLease({...lease(subscription.snapshot().device,Date.now()+1),status:'canceled',expires_at:Date.now()+1},privateKey));
 assert.equal((await request('POST','/v1/pro/jobs',{})).statusCode,402);
 const exported=await request('GET',`/v1/pro/projects/${p.id}/export/md`);assert.equal(exported.statusCode,200);assert.match(exported.body,/Meu trabalho continua meu/);
 assert.equal((await request('POST','/v1/pro/projects',{id:p.id,name:p.name,body:'Editado após expirar',expected:0})).statusCode,200);
 assert.equal((await request('POST','/v1/chats',{})).statusCode,400); // idempotency is still required for free chat.
 await request('POST','/v1/lock',{});assert.equal((await request('GET','/v1/subscription')).statusCode,423);
 }finally{await app.close();await core.close();rmSync(dir,{recursive:true,force:true});}
});
test('Otimização respeita RAM, limita saída, reaproveita contexto e recusa modelo excessivo',()=>{
 const model={key:'gguf:test',size_bytes:2*1024**3,format:'GGUF'},opts=optionsSchema.parse({max_tokens:16384});
 const economy=optimizeContext(model,12*1024**3,'economy',opts),extended=optimizeContext(model,12*1024**3,'extended',opts);
 assert.equal(economy.options.context,4096);assert.equal(economy.options.max_tokens,2048);assert.equal(extended.options.context,32768);
 const reuse=optimizeContext({...model,loaded_instances:[{id:'a',config:{context_length:4096}}]},2*1024**3,'balanced',opts);assert.equal(reuse.reuses_loaded_context,true);
 assert.throws(()=>optimizeContext(model,1024**3,'balanced',opts),/RAM insuficiente/);
});
test('Stripe exige assinatura do webhook, corpo original e timestamp recente',()=>{
 const raw=Buffer.from(JSON.stringify({id:'evt_1',type:'invoice.paid',data:{object:{}}})),now=Date.now(),ts=Math.floor(now/1000);const header='t='+ts+',v1='+createHmac('sha256','test-secret').update(ts+'.').update(raw).digest('hex');
 assert.equal(verifyWebhook(raw,header,'test-secret',now).id,'evt_1');assert.throws(()=>verifyWebhook(Buffer.from(raw.toString()+' '),header,'test-secret',now));assert.throws(()=>verifyWebhook(raw,header,'test-secret',now+301000));assert.throws(()=>verifyWebhook(raw,header,'other',now));
});
test('Cobrança mensal: checkout único, confirmação, portal, renovação, falha e webhook repetido',async()=>{
 const dir=temporary(),device=randomUUID(),now=Date.now();let paid=false,status='active',cancel=false,creates=0,period=now+30*day;const calls:any[]=[];
 const stripe=async(path:string,body?:Record<string,string>,key?:string)=>{
  calls.push({path,body,key});
  if(path==='prices/price_month')return {active:true,type:'recurring',recurring:{interval:'month',interval_count:1}};
  if(path==='checkout/sessions'){creates++;return {id:'cs_test',url:'https://checkout.stripe.com/c/test',expires_at:(now+day)/1000};}
  if(path==='checkout/sessions/cs_test')return {status:paid?'complete':'open',mode:'subscription',client_reference_id:device,customer:'cus_test',subscription:'sub_test'};
  if(path.startsWith('subscriptions/'))return {id:'sub_test',customer:'cus_test',metadata:{device},status,cancel_at_period_end:cancel,latest_invoice:{status:paid?'paid':'open'},items:{data:[{price:{id:'price_month'},current_period_end:period/1000}]}};
  if(path==='billing_portal/sessions')return {url:'https://billing.stripe.com/p/session/test'};
  throw Error(path);
 };
 const app=await createBillingService({database:join(dir,'billing.sqlite'),secretKey:'test',webhookSecret:'webhook-test',priceId:'price_month',privateKey,publicUrl:'https://billing.example.com'},stripe,()=>now);
 const headers={authorization:'Bearer '+'a'.repeat(64)};const post=(path:string)=>app.inject({method:'POST',url:'/billing/'+path,headers,payload:{device}});
 try{const [a,b]=await Promise.all([post('checkout'),post('checkout')]);assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);assert.equal(creates,1);assert.equal((await post('refresh')).json().status,'free');
 const wrong=await app.inject({method:'POST',url:'/billing/portal',headers:{authorization:'Bearer '+'b'.repeat(64)},payload:{device}});assert.equal(wrong.statusCode,401);
 paid=true;let data=(await post('refresh')).json();assert.equal(verifyLease(data.token,testConfig.publicKey,device).status,'active');assert.equal((await post('checkout')).statusCode,400);
 assert.equal((await post('portal')).statusCode,200);assert.equal(calls.find(c=>c.path==='billing_portal/sessions').body.customer,'cus_test');
 cancel=true;assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).cancel_at_period_end,true);
 status='past_due';paid=false;assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).status,'past_due');
 status='active';paid=true;period+=30*day;assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).period_end,period);
 const raw=JSON.stringify({id:'evt_duplicate',type:'customer.subscription.updated',data:{object:{metadata:{device},status:'past_due'}}}),ts=Math.floor(now/1000),signature='t='+ts+',v1='+createHmac('sha256','webhook-test').update(ts+'.'+raw).digest('hex');
 for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url:'/billing/webhook',headers:{'content-type':'application/json','stripe-signature':signature},payload:raw})).statusCode,200);
 assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).status,'active');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Falha de rede não destrói licença offline válida; checkout nunca instala licença',async()=>{
 const dir=temporary(),now=Date.now(),original=globalThis.fetch;
 try{const local=new Subscription(dir,{...testConfig,serviceUrl:'https://billing.example.com/'},()=>now);local.install(signLease(lease(local.snapshot().device,now),privateKey));
 globalThis.fetch=async()=>{throw Error('offline');};await assert.rejects(()=>local.refresh());assert.equal(local.active,true);
 globalThis.fetch=async()=>new Response(JSON.stringify({url:'https://checkout.stripe.com/c/test'}));assert.equal((await local.checkout()).url,'https://checkout.stripe.com/c/test');assert.equal(local.active,true);
 globalThis.fetch=async()=>new Response(JSON.stringify({url:'https://example.com/falso'}));await assert.rejects(()=>local.checkout(),/inválido/);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});}
});
test('Arquivo de assinatura corrompido preserva o original e mantém Grátis disponível',async()=>{
 const {writeFileSync,readdirSync,readFileSync}=await import('node:fs');const dir=temporary();try{writeFileSync(join(dir,'subscription.json'),'{corrompido');const local=new Subscription(dir,testConfig);assert.equal(local.active,false);const backup=readdirSync(dir).find(p=>p.startsWith('subscription.json.invalid-'));assert.ok(backup);assert.equal(readFileSync(join(dir,backup),'utf8'),'{corrompido');assert.match(local.snapshot().error,/recuperação/);}finally{rmSync(dir,{recursive:true,force:true});}
});
