import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHmac,generateKeyPairSync,randomUUID} from 'node:crypto';
import {Subscription,billingEndpoint,requiredFeature,verifyLease,type Lease} from '../src/subscription.js';
import {billingConfigFromEnv,billingFunctionPath,createBillingService,handleBillingWeb,signLease,verifyWebhook,validateApprovedPrice,trialIdentityHmac} from '../src/billing-service.js';
import {MemoryBillingStore,assertTransactionPoolerUrl,createPostgresStore,supabasePoolOptions} from '../src/billing-store.js';
import type postgres from 'postgres';
import {optimizeContext} from '../src/optimization.js';
import {optionsSchema} from '../src/inference.js';
import {Core} from '../src/core.js';
import {createApp} from '../src/server.js';
import {testKeys,testConfig,activateTestPro} from './subscription-fixture.js';
const privateKey=testKeys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const temporary=()=>mkdtempSync(join(tmpdir(),'neuron-subscription-'));
const day=86400_000;
const monthlyPrice=()=>({active:true,type:'recurring',currency:'brl',unit_amount:2000,billing_scheme:'per_unit',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}});
const yearlyPrice=()=>({active:true,type:'recurring',currency:'brl',unit_amount:15000,billing_scheme:'per_unit',recurring:{interval:'year',interval_count:1,usage_type:'licensed'}});
const trialHmacKey='hmac-de-teste-com-32-caracteres-ou-mais';
const rateHmacKey='hmac-de-limite-com-32-caracteres-ou-mais';
const billingConfig=(_dir:string)=>({secretKey:'test',webhookSecret:'webhook-test',monthlyPriceId:'price_month',yearlyPriceId:'price_year',privateKey,publicUrl:'https://billing.example.com',trialHmacKey,rateHmacKey});
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
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions'){creates++;return {id:'cs_test',url:'https://checkout.stripe.com/c/test',expires_at:(now+day)/1000};}
  if(path==='checkout/sessions/cs_test')return {status:paid?'complete':'open',mode:'subscription',client_reference_id:device,customer:'cus_test',subscription:'sub_test'};
  if(path.startsWith('subscriptions/'))return {id:'sub_test',customer:'cus_test',metadata:{device},status,cancel_at_period_end:cancel,latest_invoice:{status:paid?'paid':'open'},items:{data:[{price:{id:'price_month'},current_period_end:period/1000}]}};
  if(path==='billing_portal/sessions')return {url:'https://billing.stripe.com/p/session/test'};
  throw Error(path);
 };
 const app=await createBillingService(billingConfig(dir),stripe,()=>now);
 const headers={authorization:'Bearer '+'a'.repeat(64)};const post=(path:string)=>app.inject({method:'POST',url:'/billing/'+path,headers,payload:{device}});
 try{const [a,b]=await Promise.all([post('checkout'),post('checkout')]);assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);assert.equal(creates,1);const created=calls.find(c=>c.path==='checkout/sessions');assert.equal(created.body['line_items[0][price]'],'price_month');assert.equal(created.body['subscription_data[trial_period_days]'],'7');assert.equal((await post('refresh')).json().status,'free');
 const wrong=await app.inject({method:'POST',url:'/billing/portal',headers:{authorization:'Bearer '+'b'.repeat(64)},payload:{device}});assert.equal(wrong.statusCode,401);
 paid=true;let data=(await post('refresh')).json();assert.equal(verifyLease(data.token,testConfig.publicKey,device).status,'active');const portal=await post('checkout');assert.equal(portal.statusCode,200);assert.equal(portal.json().url,'https://billing.stripe.com/p/session/test');assert.equal(creates,1);
 assert.equal((await post('portal')).statusCode,200);assert.equal(calls.find(c=>c.path==='billing_portal/sessions').body.customer,'cus_test');
 cancel=true;assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).cancel_at_period_end,true);
 status='past_due';paid=false;assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).status,'past_due');
 status='active';paid=true;period+=30*day;assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).period_end,period);
 const raw=JSON.stringify({id:'evt_duplicate',type:'customer.subscription.updated',data:{object:{metadata:{device},status:'past_due'}}}),ts=Math.floor(now/1000),signature='t='+ts+',v1='+createHmac('sha256','webhook-test').update(ts+'.'+raw).digest('hex');
 for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url:'/billing/webhook',headers:{'content-type':'application/json','stripe-signature':signature},payload:raw})).statusCode,200);
 assert.equal(verifyLease((await post('refresh')).json().token,testConfig.publicKey,device).status,'active');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Lista de preços: aceita mensal BRL 2000 e anual BRL 15000 e recusa combinações fora da lista',async()=>{
 const monthly=monthlyPrice(),yearly=yearlyPrice();
 assert.equal(validateApprovedPrice(monthly),'monthly');assert.equal(validateApprovedPrice(yearly),'yearly');
 for(const price of [{...monthly,active:false},{...monthly,type:'one_time'},{...monthly,currency:'usd'},{...monthly,unit_amount:15000},{...monthly,unit_amount:null},{...yearly,unit_amount:2000},{...monthly,billing_scheme:'tiered'},{...monthly,transform_quantity:{divide_by:5,round:'up'}},{...monthly,recurring:{...monthly.recurring,interval:'year'}},{...yearly,recurring:{...yearly.recurring,interval:'month'}},{...monthly,recurring:{...monthly.recurring,interval_count:3}},{...yearly,recurring:{...yearly.recurring,interval_count:12}},{...monthly,recurring:{...monthly.recurring,usage_type:'metered'}}])
  assert.throws(()=>validateApprovedPrice(price),/2000|15000/);
 const dir=temporary();
 try{
  const wrong=async(path:string)=>{if(path==='prices/price_month')return {...monthly,unit_amount:1000};if(path==='prices/price_year')return yearly;throw Error(path);};
  await assert.rejects(()=>createBillingService(billingConfig(dir),wrong),/2000|15000/);
  const swapped=async(path:string)=>{if(path==='prices/price_month')return yearly;if(path==='prices/price_year')return yearly;throw Error(path);};
  await assert.rejects(()=>createBillingService(billingConfig(dir),swapped),/20,00/);
  await assert.rejects(()=>createBillingService({...billingConfig(dir),yearlyPriceId:'price_month'},async()=>monthly),/diferentes/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Checkout anual usa o preço de R$ 150 e inclui 7 dias de teste',async()=>{
 const dir=temporary(),device=randomUUID(),now=Date.now(),calls:any[]=[];
 const stripe=async(path:string,body?:Record<string,string>)=>{
  calls.push({path,body});
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_year',url:'https://checkout.stripe.com/c/year',expires_at:(now+day)/1000};
  throw Error(path);
 };
 const app=await createBillingService(billingConfig(dir),stripe,()=>now);
 const headers={authorization:'Bearer '+'c'.repeat(64)};
 try{
  const response=await app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device,plan:'yearly'}});
  assert.equal(response.statusCode,200);assert.equal(response.json().url,'https://checkout.stripe.com/c/year');
  const body=calls.find(c=>c.path==='checkout/sessions').body;
  assert.equal(body.mode,'subscription');assert.equal(body['line_items[0][price]'],'price_year');assert.equal(body['line_items[0][quantity]'],'1');
  assert.equal(body['subscription_data[trial_period_days]'],'7');assert.equal(body['subscription_data[metadata][device]'],device);
  assert.equal(body.client_reference_id,device);assert.equal(body['metadata[device]'],device);
  assert.equal(Object.keys(body).some(key=>/email|\[name\]|^name$|secret/i.test(key)),false);
  assert.equal(body.payment_method_collection,'always');assert.equal(body.locale,'pt-BR');
  assert.equal((await app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device,plan:'vitalicio'}})).statusCode,400);
  assert.equal((await app.inject({method:'GET',url:'/health'})).json().ok,true);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Status trialing conta como licença ativa, sem exigir fatura paga',async()=>{
 const dir=temporary(),device=randomUUID();let now=Date.now(),status='trialing',trialEnd=now+7*day,invoice='open',paused:any=null;
 const stripe=async(path:string)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_trial',url:'https://checkout.stripe.com/c/trial',expires_at:(now+day)/1000};
  if(path==='checkout/sessions/cs_trial')return {status:'complete',mode:'subscription',client_reference_id:device,customer:'cus_trial',subscription:'sub_trial'};
  if(path.startsWith('subscriptions/sub_trial'))return {id:'sub_trial',customer:'cus_trial',metadata:{device},status,cancel_at_period_end:false,trial_end:trialEnd/1000,pause_collection:paused,latest_invoice:{status:invoice},items:{data:[{price:{id:'price_year'},current_period_end:(now+365*day)/1000}]}};
  throw Error(path);
 };
 const app=await createBillingService(billingConfig(dir),stripe,()=>now);
 const headers={authorization:'Bearer '+'d'.repeat(64)};const post=()=>app.inject({method:'POST',url:'/billing/refresh',headers,payload:{device}});
 try{
  assert.equal((await app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device,plan:'yearly'}})).statusCode,200);
  const lease=verifyLease((await post()).json().token,testConfig.publicKey,device);
  assert.equal(lease.status,'active');assert.ok(lease.expires_at<=trialEnd);assert.ok(lease.expires_at>now);assert.ok(lease.expires_at-lease.issued_at<=7*day);assert.equal(lease.period_end,trialEnd);
  status='active';invoice='open';const unpaid=verifyLease((await post()).json().token,testConfig.publicKey,device);assert.notEqual(unpaid.status,'active');
  status='trialing';invoice='open';paused={behavior:'void'};assert.notEqual(verifyLease((await post()).json().token,testConfig.publicKey,device).status,'active');
  paused=null;trialEnd=now-1000;assert.notEqual(verifyLease((await post()).json().token,testConfig.publicKey,device).status,'active');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('O teste só é reservado quando a assinatura existe',async()=>{
 const dir=temporary(),device=randomUUID();let now=Date.now(),sessions=0,complete=false,status='canceled';const calls:any[]=[];
 const stripe=async(path:string,body?:Record<string,string>)=>{
  calls.push({path,body});
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions'){sessions++;return {id:'cs_'+sessions,url:'https://checkout.stripe.com/c/'+sessions,expires_at:(now+3600_000)/1000};}
  if(path.endsWith('/expire'))return {id:'expired',status:'expired'};
  if(path.startsWith('checkout/sessions/'))return complete?{status:'complete',mode:'subscription',client_reference_id:device,customer:'cus_trial',subscription:'sub_trial'}:{status:'expired',mode:'subscription',client_reference_id:device};
  if(path.startsWith('subscriptions/sub_trial'))return {id:'sub_trial',customer:'cus_trial',metadata:{device},status,trial_end:(now+7*day)/1000,latest_invoice:{status:'open'},items:{data:[{price:{id:'price_month'},current_period_end:(now+30*day)/1000}]}};
  if(path.startsWith('subscriptions?'))return {data:[{id:'sub_old',status:'canceled',trial_end:1}],has_more:false};
  if(path==='billing_portal/sessions')return {url:'https://billing.stripe.com/p/session/test'};
  throw Error(path);
 };
 const store=new MemoryBillingStore();
 const app=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 const headers={authorization:'Bearer '+'e'.repeat(64)};
 const checkout=(plan:'monthly'|'yearly'='monthly')=>app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device,plan}});
 const sessionBodies=()=>calls.filter(c=>c.path==='checkout/sessions').map(c=>c.body);
 try{
  assert.equal((await checkout('monthly')).statusCode,200);
  assert.equal(sessionBodies()[0]['subscription_data[trial_period_days]'],'7');
  assert.equal((await checkout('yearly')).statusCode,200);
  assert.equal(sessionBodies()[1]['subscription_data[trial_period_days]'],'7');
  assert.equal(sessionBodies()[1]['line_items[0][price]'],'price_year');
  now+=2*day;
  assert.equal((await checkout('monthly')).statusCode,200);
  assert.equal(sessionBodies()[2]['subscription_data[trial_period_days]'],'7');
  assert.equal((await store.getDevice(device))?.trial_used,0);
  assert.equal((await app.inject({method:'POST',url:'/billing/eligibility',headers,payload:{device}})).json().trial_eligible,true);
  complete=true;status='trialing';
  assert.equal(verifyLease((await app.inject({method:'POST',url:'/billing/refresh',headers,payload:{device}})).json().token,testConfig.publicKey,device).status,'active');
  assert.equal((await store.getDevice(device))?.trial_used,1);
  assert.equal((await app.inject({method:'POST',url:'/billing/eligibility',headers,payload:{device}})).json().trial_eligible,false);
  assert.equal((await checkout()).json().url,'https://billing.stripe.com/p/session/test');
  status='canceled';
  assert.equal((await checkout()).statusCode,200);
  assert.equal(sessionBodies().at(-1)['subscription_data[trial_period_days]'],undefined);
  await store.updateDevice(device,{trial_used:0,customer:'cus_prior',checkout:null,checkout_url:null,checkout_expires:null,checkout_plan:null,subscription:null});
  now+=2*day;
  assert.equal((await checkout()).statusCode,200);
  assert.equal(sessionBodies().at(-1)['subscription_data[trial_period_days]'],undefined);
  assert.equal(calls.some(c=>c.path==='subscriptions?customer=cus_prior&status=all&limit=100'),true);
  assert.equal((await store.getDevice(device))?.trial_used,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('O aplicativo envia o plano anual ao Checkout',async()=>{
 const dir=temporary(),original=globalThis.fetch;
 try{const local=new Subscription(dir,{...testConfig,serviceUrl:'https://billing.example.com/'},()=>Date.now());let sent:any;
  globalThis.fetch=async(_url,init)=>{sent=JSON.parse(String((init as RequestInit).body));return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/year'}));};
  assert.equal((await local.checkout('yearly')).url,'https://checkout.stripe.com/c/year');assert.equal(sent.plan,'yearly');assert.equal(sent.device,local.snapshot().device);
  await assert.rejects(()=>local.checkout('vitalicio' as 'monthly'),/mensal ou o anual/);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});}
});
test('Falha de rede não destrói licença offline válida; checkout nunca instala licença',async()=>{
 const dir=temporary(),now=Date.now(),original=globalThis.fetch;
 try{const local=new Subscription(dir,{...testConfig,serviceUrl:'https://billing.example.com/'},()=>now);local.install(signLease(lease(local.snapshot().device,now),privateKey));
 globalThis.fetch=async()=>{throw Error('offline');};await assert.rejects(()=>local.refresh());assert.equal(local.active,true);
 globalThis.fetch=async()=>new Response(JSON.stringify({url:'https://checkout.stripe.com/c/test'}));assert.equal((await local.checkout()).url,'https://checkout.stripe.com/c/test');assert.equal(local.active,true);
 globalThis.fetch=async()=>new Response(JSON.stringify({url:'https://example.com/falso'}));await assert.rejects(()=>local.checkout(),/inválido/);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});}
});
test('Cartão ou e-mail repetido encerra o teste sem gravar o valor',async()=>{
 const dir=temporary(),now=Date.now();const email='Pessoa@Example.com',fingerprint='fp_cartao_unico_de_teste';const ended:string[]=[];
 const devices={a:randomUUID(),b:randomUUID(),c:randomUUID(),d:randomUUID()};
 const subs:Record<string,any>={
  sub_a:{id:'sub_a',customer:{id:'cus_a',email},metadata:{device:devices.a},status:'trialing',default_payment_method:{card:{fingerprint}}},
  sub_b:{id:'sub_b',customer:{id:'cus_b',email:'outra@example.com'},metadata:{device:devices.b},status:'trialing',default_payment_method:{card:{fingerprint}}},
  sub_c:{id:'sub_c',customer:{id:'cus_c',email},metadata:{device:devices.c},status:'trialing',default_payment_method:{card:{fingerprint:'fp_outro_cartao'}}},
  sub_d:{id:'sub_d',customer:{id:'cus_d',email:'nova@example.com'},metadata:{device:devices.d},status:'trialing',default_payment_method:{card:{fingerprint:'fp_cartao_novo'}}},
 };
 const stripe=async(path:string,body?:Record<string,string>)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_'+path.length,url:'https://checkout.stripe.com/c/pay',expires_at:(now+day)/1000};
  if(path.startsWith('checkout/sessions/'))return {status:'open',mode:'subscription'};
  if(path.includes('expand[]=default_payment_method')){const id=decodeURIComponent(path.split('/')[1].split('?')[0]);return subs[id];}
  if(body?.trial_end==='now'){const id=decodeURIComponent(path.split('/')[1]);ended.push(id);subs[id].status='active';return subs[id];}
  throw Error(path);
 };
 const store=new MemoryBillingStore();
 const app=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 const headers={authorization:'Bearer '+'f'.repeat(64)};
 const postEvent=(id:string,type:string,object:any)=>app.inject({method:'POST',url:'/billing/webhook',headers:{'content-type':'application/json','stripe-signature':(()=>{const raw=JSON.stringify({id,type,data:{object}}),ts=Math.floor(now/1000);return 't='+ts+',v1='+createHmac('sha256','webhook-test').update(ts+'.'+raw).digest('hex');})()},payload:JSON.stringify({id,type,data:{object}})});
 try{
  const card=trialIdentityHmac('card',fingerprint,trialHmacKey),mail=trialIdentityHmac('email','  pessoa@example.com ',trialHmacKey);
  assert.equal(card,trialIdentityHmac('card',fingerprint,trialHmacKey));assert.equal(mail.length,64);assert.notEqual(card,fingerprint);assert.notEqual(mail,email.toLowerCase());
  assert.notEqual(trialIdentityHmac('card',email,trialHmacKey),mail);assert.notEqual(trialIdentityHmac('email',email,trialHmacKey+'x'),mail);
  for(const id of Object.values(devices))assert.equal((await app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device:id}})).statusCode,200);
  assert.equal((await postEvent('evt_a','customer.subscription.created',{id:'sub_a',metadata:{device:devices.a}})).statusCode,200);
  assert.equal((await postEvent('evt_a2','checkout.session.completed',{client_reference_id:devices.a,subscription:'sub_a',customer_details:{email}})).statusCode,200);
  assert.deepEqual(ended,[]);
  assert.equal((await postEvent('evt_b','customer.subscription.created',{id:'sub_b',metadata:{device:devices.b}})).statusCode,200);
  assert.equal((await postEvent('evt_c','checkout.session.completed',{client_reference_id:devices.c,subscription:'sub_c',customer_email:email})).statusCode,200);
  assert.equal((await postEvent('evt_d','customer.subscription.created',{id:'sub_d',metadata:{device:devices.d}})).statusCode,200);
  assert.deepEqual(ended,['sub_b','sub_c']);
  const rows=await store.listIdentities();
  assert.ok(rows.length>=2);assert.ok(rows.every(row=>/^[a-f0-9]{64}$/.test(row.hmac)&&row.subscription.startsWith('sub_')));
  const blob=JSON.stringify({devices:[...store.devices.values()],identities:rows,events:[...store.events]});
  assert.equal(blob.includes(email),false);assert.equal(blob.includes(email.toLowerCase()),false);assert.equal(blob.includes(fingerprint),false);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Elegibilidade desconhecida não anuncia o teste e a página só mostra os 7 dias para quem pode',async()=>{
 const dir=temporary(),original=globalThis.fetch;let now=Date.now();const {readFileSync}=await import('node:fs');
 try{const local=new Subscription(dir,{...testConfig,serviceUrl:'https://billing.example.com/'},()=>now);
  assert.equal(local.snapshot().trial_eligible,false);assert.equal(local.snapshot().trial_checked,false);
  let calls=0;globalThis.fetch=async()=>{calls++;throw Error('offline');};await local.refreshEligibility();await local.refreshEligibility();assert.equal(local.snapshot().trial_eligible,false);assert.equal(local.snapshot().trial_checked,true);assert.equal(calls,1);
  now+=11*60_000;globalThis.fetch=async()=>new Response(JSON.stringify({trial_eligible:true}));await local.refreshEligibility();assert.equal(local.snapshot().trial_eligible,true);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({trial_eligible:true}));};
  local.install(signLease(lease(local.snapshot().device,now),privateKey));assert.equal(local.snapshot().trial_eligible,false);await local.refreshEligibility();assert.equal(calls,0);
  const idle=new Subscription(dir+'-off',testConfig,()=>now);await idle.refreshEligibility();assert.equal(calls,0);
  const page=readFileSync(resolve('public/subscription.js'),'utf8');
  assert.match(page,/trial=Boolean\(state\.configured&&!managing&&!state\.trial_repeat&&state\.trial_checked&&state\.trial_eligible\)/);
  assert.doesNotMatch(page,/!state\.trial_checked/);
  assert.match(page,/trial\?'<p class="trial-note">7 dias grátis<\/p>':''/);
  assert.match(page,/uma vez por pessoa e por cartão/);
  assert.match(page,/O teste grátis desta pessoa ou deste cartão já foi usado e terminou agora/);
  assert.doesNotMatch(page,/Troque entre Mensal e Anual/);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});rmSync(dir+'-off',{recursive:true,force:true});}
});
test('O serviço exige a chave de HMAC do teste',async()=>{
 const dir=temporary();
 try{await assert.rejects(()=>createBillingService({...billingConfig(dir),trialHmacKey:'curta'},async()=>monthlyPrice()),/32/);
  await assert.rejects(()=>createBillingService({...billingConfig(dir),rateHmacKey:'curta'},async()=>monthlyPrice()),/RATE_HMAC_KEY/);
  await assert.rejects(()=>createBillingService({...billingConfig(dir),rateHmacKey:trialHmacKey},async()=>monthlyPrice()),/diferente/);
 }
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('Postgres usa o pooler 6543 em sa-east-1, verify-full, e a migração não guarda cartão',async()=>{
 const options=supabasePoolOptions();
 assert.equal(options.prepare,false);assert.equal(options.max,1);assert.equal(options.ssl.rejectUnauthorized,true);assert.match(options.ssl.ca,/BEGIN CERTIFICATE/);
 const custom=supabasePoolOptions({LOCALNEURON_BILLING_DB_CA:options.ssl.ca.replace(/\n/g,'\\n')});assert.match(custom.ssl.ca,/BEGIN CERTIFICATE/);
 assert.throws(()=>supabasePoolOptions({LOCALNEURON_BILLING_DB_CA:'nao-e-um-pem'}),/PEM/);
 assert.throws(()=>assertTransactionPoolerUrl('postgresql://local:local@127.0.0.1:5432/postgres'),/6543/);
 let opened=false;const connect=(((_url:string,opts:ReturnType<typeof supabasePoolOptions>)=>{opened=true;assert.equal(opts.prepare,false);assert.equal(opts.ssl.rejectUnauthorized,true);return {async end(){}};}) as unknown) as typeof postgres;
 const store=createPostgresStore('postgresql://billing_app.projeto:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',connect);
 assert.equal(opened,true);await store.close();
 const refuse=(()=>{throw Error('não conecta');}) as unknown as typeof postgres;
 assert.throws(()=>createPostgresStore('postgresql://billing_app.projeto:senha@db.projeto.supabase.co:6543/postgres',refuse),/sa-east-1/);
 assert.throws(()=>createPostgresStore('postgresql://postgres.projeto:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',refuse),/billing_app/);
 assert.throws(()=>createPostgresStore('postgresql://local:local@127.0.0.1:5432/postgres',refuse),/6543/);
 const sql=['20261021000000_init.sql','20261021010000_role_and_rate.sql','20261021020000_keep_alive.sql','20261021030000_rate_window_purge.sql'].map(name=>readFileSync(resolve('supabase/migrations',name),'utf8')).join('\n');
 assert.match(sql,/billing\.devices/);assert.match(sql,/billing\.events/);assert.match(sql,/billing\.trial_identities/);assert.match(sql,/billing_app/);assert.match(sql,/rate_windows/);assert.match(sql,/created bigint/);
 assert.match(sql,/pg_cron/);assert.match(sql,/billing-keep-alive/);assert.match(sql,/billing-purge-events/);assert.match(sql,/billing-purge-identities/);assert.match(sql,/for all to billing_app/);
 assert.match(sql,/enable row level security/);assert.doesNotMatch(sql,/fingerprint|email/i);
 const ratePurge=readFileSync(resolve('supabase/migrations/20261021030000_rate_window_purge.sql'),'utf8');
 assert.match(ratePurge,/billing-purge-rates/);assert.match(ratePurge,/\*\/2 \* \* \* \*/);assert.doesNotMatch(readFileSync(resolve('supabase/migrations/20261021020000_keep_alive.sql'),'utf8'),/\*\/2 \* \* \* \*/);
 const fn=readFileSync(resolve('supabase/functions/billing/index.ts'),'utf8');assert.match(fn,/starting \?\?=/);assert.doesNotMatch(fn,/SERVICE_ROLE/);
 const hook=readFileSync(resolve('supabase/functions/stripe-webhook/index.ts'),'utf8');assert.match(hook,/constructEventAsync/);assert.match(hook,/createSubtleCryptoProvider/);assert.match(hook,/starting \?\?=/);assert.match(hook,/apiVersion: stripeApiVersion/);
 const billingDeno=readFileSync(resolve('supabase/functions/billing/deno.json'),'utf8');const hookDeno=readFileSync(resolve('supabase/functions/stripe-webhook/deno.json'),'utf8');
 assert.doesNotMatch(billingDeno,/sloppy-imports/);assert.doesNotMatch(hookDeno,/sloppy-imports/);assert.match(billingDeno,/npm:fastify@5\.12\.7/);assert.match(hookDeno,/npm:postgres@3\.4\.9/);
 assert.doesNotMatch(readFileSync(resolve('deno.json'),'utf8'),/sloppy-imports/);assert.match(hook,/npm:stripe@18\.0\.0/);
 const serviceSrc=readFileSync(resolve('src/billing-service.ts'),'utf8');const storeSrc=readFileSync(resolve('src/billing-store.ts'),'utf8');
 assert.match(serviceSrc,/from '\.\/billing-store\.ts'/);assert.match(storeSrc,/from '\.\/billing-ca\.ts'/);assert.doesNotMatch(serviceSrc,/x-forwarded-for/);
 assert.match(readFileSync(resolve('dist/src/billing-service.js'),'utf8'),/from ["']\.\/billing-store\.js["']/);
 assert.match(readFileSync(resolve('dist/src/billing-store.js'),'utf8'),/from ["']\.\/billing-ca\.js["']/);
 const roleSql=readFileSync(resolve('supabase/migrations/20261021010000_role_and_rate.sql'),'utf8');
 assert.match(roleSql,/create role billing_app nologin noinherit nosuperuser nobypassrls/);
 assert.match(roleSql,/alter role billing_app with nologin noinherit nobypassrls;/);
 assert.doesNotMatch(roleSql,/alter role billing_app with nologin noinherit nosuperuser/);
 assert.match(readFileSync(resolve('.github/workflows/ci.yml'),'utf8'),/deno check supabase\/functions\/\*\/index\.ts/);
 assert.match(readFileSync(resolve('.gitignore'),'utf8'),/supabase\/\.temp\//);
 assert.doesNotMatch(serviceSrc,/billing\.localneuron\.ai/);
 const deploy=readFileSync(resolve('docs/billing-deploy.md'),'utf8');assert.doesNotMatch(deploy,/billing\.localneuron\.ai/);assert.match(deploy,/--api-version=2025-03-31\.basil/);assert.match(deploy,/500\.000/);assert.match(deploy,/LOCALNEURON_BILLING_TRUST_PROXY=off/);assert.match(deploy,/cf-connecting-ip/);assert.match(deploy,/203\.0\.113\.50/);assert.match(deploy,/42501/);assert.doesNotMatch(deploy,/hop da direita/);
 assert.equal((readFileSync(resolve('supabase/config.toml'),'utf8').match(/verify_jwt = false/g)||[]).length,2);
 assert.equal(existsSync('vercel.json'),false);assert.equal(existsSync('api/billing.js'),false);assert.equal(existsSync('billing/migrations/20261021000000_init.sql'),false);
 assert.equal(existsSync('fly.toml'),false);assert.equal(existsSync('billing/Dockerfile'),false);assert.equal(existsSync('billing/docker-entrypoint.sh'),false);assert.equal(existsSync('.dockerignore'),false);
});
test('A função entrega o corpo cru do webhook e a saúde no caminho do Supabase',async()=>{
 const dir=temporary(),now=Date.now();
 const stripe=async(path:string)=>{if(path==='prices/price_month')return monthlyPrice();if(path==='prices/price_year')return yearlyPrice();throw Error(path);};
 const app=await createBillingService(billingConfig(dir),stripe,()=>now);
 const payload='{"id": "evt_raw", "type": "invoice.paid", "data": {"object": {}}}';
 const ts=Math.floor(now/1000),signature='t='+ts+',v1='+createHmac('sha256','webhook-test').update(ts+'.'+payload).digest('hex');
 try{
  assert.equal(billingFunctionPath('https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing/health?forceFunctionRegion=sa-east-1').split('?')[0],'/billing/health');
  assert.equal(billingFunctionPath('/functions/v1/billing/checkout').split('?')[0],'/billing/checkout');
  const health=await handleBillingWeb(app,new Request('https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing/health'));
  assert.equal(health.status,200);assert.match(await health.text(),/"ok":true/);
  const response=await handleBillingWeb(app,new Request('https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing/webhook?forceFunctionRegion=sa-east-1',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature,'content-length':'9999'},body:payload}));
  assert.equal(response.status,200);assert.match(await response.text(),/received/);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Checkout autenticado para no 60º pedido e saúde continua livre',async()=>{
 const dir=temporary(),device=randomUUID(),now=Date.now();
 const stripe=async(path:string)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_rate',url:'https://checkout.stripe.com/c/rate',expires_at:(now+day)/1000};
  if(path==='checkout/sessions/cs_rate')return {status:'open',mode:'subscription',client_reference_id:device};
  throw Error(path);
 };
 const app=await createBillingService(billingConfig(dir),stripe,()=>now);
 const headers={authorization:'Bearer '+'a'.repeat(64)};
 const checkout=()=>app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device}});
 try{
  for(let i=0;i<60;i++)assert.equal((await checkout()).statusCode,200);
  const blocked=await checkout();
  assert.equal(blocked.statusCode,429);assert.match(blocked.body,/Aguarde antes de tentar novamente/);
  assert.equal((await app.inject({method:'GET',url:'/health'})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/billing/checkout',headers:{...headers,origin:'https://evil.example'},payload:{device}})).statusCode,403);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Elegibilidade não cria instalação e o refresh repetido não emite licença de teste',async()=>{
 const dir=temporary(),device=randomUUID();let now=Date.now(),status='trialing';
 const fingerprint='fp_repetido';
 const stripe=async(path:string,body?:Record<string,string>)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_rep',url:'https://checkout.stripe.com/c/rep',expires_at:(now+day)/1000};
  if(path.includes('expand[]=default_payment_method'))return {id:'sub_rep',status,customer:{id:'cus_rep',email:'pessoa@example.com'},default_payment_method:{card:{fingerprint}},metadata:{device}};
  if(body?.trial_end==='now')return {id:'sub_rep',status};
  if(path.startsWith('subscriptions/sub_rep'))return {id:'sub_rep',customer:'cus_rep',metadata:{device},status,trial_end:(now+7*day)/1000,latest_invoice:{status:'open'},items:{data:[{price:{id:'price_month'},current_period_end:(now+30*day)/1000}]}};
  throw Error(path);
 };
 const store=new MemoryBillingStore();
 await store.rememberIdentity(trialIdentityHmac('card',fingerprint,trialHmacKey),'sub_outra',now-day);
 const app=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 const headers={authorization:'Bearer '+'a'.repeat(64)};
 try{
  assert.equal((await app.inject({method:'POST',url:'/billing/eligibility',headers,payload:{device}})).json().trial_eligible,true);
  assert.equal(await store.getDevice(device),undefined);
  assert.equal((await app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device}})).statusCode,200);
  await store.updateDevice(device,{customer:'cus_rep',subscription:'sub_rep',checkout:null});
  const refreshed=await app.inject({method:'POST',url:'/billing/refresh',headers,payload:{device}});
  assert.equal(refreshed.statusCode,200);assert.equal(refreshed.json().trial_repeat,true);assert.equal(refreshed.json().token,undefined);assert.equal(refreshed.json().status,'free');
  store.ping=async()=>{throw Error('senha-do-banco-nao-sai');};
  const health=await app.inject({method:'GET',url:'/billing/health'});
  assert.equal(health.statusCode,503);assert.deepEqual(health.json(),{ok:false});assert.equal(health.body.includes('senha-do-banco-nao-sai'),false);
  assert.equal((await app.inject({method:'GET',url:'/health'})).json().ok,true);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('O limite durável vale entre instâncias e cai para a memória se o banco falhar',async()=>{
 const dir=temporary(),device=randomUUID(),now=Date.now();
 const stripe=async(path:string)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_share',url:'https://checkout.stripe.com/c/share',expires_at:(now+day)/1000};
  if(path==='checkout/sessions/cs_share')return {status:'open',mode:'subscription',client_reference_id:device};
  throw Error(path);
 };
 const store=new MemoryBillingStore();let bumps=0;
 const original=store.bumpRate.bind(store);
 store.bumpRate=async(ipHash,route,windowStart)=>{bumps++;assert.match(ipHash,/^[a-f0-9]{64}$/);assert.equal(ipHash.includes('.'),false);assert.equal(route.includes('.'),false);return original(ipHash,route,windowStart);};
 const headers={authorization:'Bearer '+'b'.repeat(64)};
 const first=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 const second=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 const post=(app:typeof first)=>app.inject({method:'POST',url:'/billing/checkout',headers,payload:{device}});
 try{
  for(let i=0;i<60;i++)assert.equal((await post(first)).statusCode,200);
  const mid=bumps;
  assert.equal((await post(second)).statusCode,429);
  assert.equal(bumps,mid+1);
  assert.equal((await post(second)).statusCode,429);
  assert.equal(bumps,mid+1);
 }finally{await first.close();await second.close();}
 store.bumpRate=async()=>{throw Error('banco');};
 const fallback=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 try{
  for(let i=0;i<60;i++)assert.equal((await post(fallback)).statusCode,200);
  assert.equal((await post(fallback)).statusCode,429);
 }finally{await fallback.close();rmSync(dir,{recursive:true,force:true});}
});
test('O limite usa cf-connecting-ip, cai em x-real-ip e ignora x-forwarded-for',async()=>{
 const dir=temporary(),device=randomUUID(),now=Date.now();
 const stripe=async(path:string)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_hop',url:'https://checkout.stripe.com/c/hop',expires_at:(now+day)/1000};
  if(path==='checkout/sessions/cs_hop')return {status:'open',mode:'subscription',client_reference_id:device};
  throw Error(path);
 };
 const store=new MemoryBillingStore();const seen:string[]=[];
 const original=store.bumpRate.bind(store);
 store.bumpRate=async(ipHash,route,windowStart)=>{seen.push(ipHash);return original(ipHash,route,windowStart);};
 const app=await createBillingService(billingConfig(dir),stripe,()=>now,store,{LOCALNEURON_BILLING_TRUST_PROXY:'supabase'});
 const post=(extra:Record<string,string>)=>app.inject({method:'POST',url:'/billing/checkout',headers:{authorization:'Bearer '+'d'.repeat(64),...extra},payload:{device}});
 try{
  assert.equal((await post({'cf-connecting-ip':'203.0.113.5','x-real-ip':'1.2.3.4','x-forwarded-for':'9.9.9.9'})).statusCode,200);
  assert.equal((await post({'cf-connecting-ip':'203.0.113.5','x-real-ip':'9.9.9.9','x-forwarded-for':'8.8.8.8'})).statusCode,200);
  assert.equal(seen[0],seen[1]);assert.match(seen[0],/^[a-f0-9]{64}$/);
  assert.equal((await post({'cf-connecting-ip':'198.51.100.9','x-forwarded-for':'203.0.113.5'})).statusCode,200);
  assert.notEqual(seen[2],seen[0]);
  const realOnly=seen.length;
  assert.equal((await post({'x-real-ip':'203.0.113.9','x-forwarded-for':'198.51.100.9'})).statusCode,200);
  assert.notEqual(seen[realOnly],seen[0]);assert.notEqual(seen[realOnly],seen[2]);
  assert.equal((await post({'cf-connecting-ip':'203.0.113.5, 198.51.100.1','x-real-ip':'203.0.113.9'})).statusCode,200);
  assert.equal(seen[realOnly+1],seen[realOnly]);
  const forwardedOnly=seen.length;
  assert.equal((await post({'x-forwarded-for':'192.0.2.50'})).statusCode,200);
  assert.equal((await post({})).statusCode,200);
  assert.equal(seen[forwardedOnly],seen[forwardedOnly+1]);
  assert.notEqual(seen[forwardedOnly],seen[0]);assert.notEqual(seen[forwardedOnly],seen[realOnly]);
 }finally{await app.close();}
 const plain=new MemoryBillingStore();const plainSeen:string[]=[];
 plain.bumpRate=async(ipHash)=>{plainSeen.push(ipHash);return 1;};
 const unset=await createBillingService(billingConfig(dir),stripe,()=>now,plain,{});
 try{
  assert.equal((await unset.inject({method:'POST',url:'/billing/checkout',headers:{authorization:'Bearer '+'d'.repeat(64),'cf-connecting-ip':'203.0.113.5','x-forwarded-for':'192.0.2.50'},payload:{device}})).statusCode,200);
  assert.equal((await unset.inject({method:'POST',url:'/billing/checkout',headers:{authorization:'Bearer '+'d'.repeat(64),'cf-connecting-ip':'198.51.100.9','x-forwarded-for':'192.0.2.50'},payload:{device}})).statusCode,200);
  assert.notEqual(plainSeen[0],plainSeen[1]);
 }finally{await unset.close();}
 const offStore=new MemoryBillingStore();const offSeen:string[]=[];
 offStore.bumpRate=async(ipHash)=>{offSeen.push(ipHash);return 1;};
 const off=await createBillingService(billingConfig(dir),stripe,()=>now,offStore,{LOCALNEURON_BILLING_TRUST_PROXY:'off',SUPABASE_URL:'https://hifnfveklpskbtxyeqza.supabase.co'});
 try{
  assert.equal((await off.inject({method:'POST',url:'/billing/checkout',headers:{authorization:'Bearer '+'d'.repeat(64),'cf-connecting-ip':'203.0.113.5','x-real-ip':'198.51.100.9','x-forwarded-for':'9.9.9.9'},payload:{device}})).statusCode,200);
  assert.equal((await off.inject({method:'POST',url:'/billing/checkout',headers:{authorization:'Bearer '+'d'.repeat(64),'cf-connecting-ip':'198.51.100.8','x-real-ip':'203.0.113.9','x-forwarded-for':'8.8.8.8'},payload:{device}})).statusCode,200);
  assert.equal(offSeen[0],offSeen[1]);
 }finally{await off.close();rmSync(dir,{recursive:true,force:true});}
});
test('Reembolso integral cancela a assinatura e cobrança sem fatura de assinatura é reconhecida',async()=>{
 const dir=temporary(),now=Date.now();const deleted:{path:string;key?:string;method?:string}[]=[];
 const stripe=async(path:string,_body?:Record<string,string>,key?:string,method?:string)=>{
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path.startsWith('invoice_payments?')&&path.includes('payment[payment_intent]=pi_full'))return {data:[{invoice:'in_1',payment:{type:'payment_intent',payment_intent:'pi_full'}}]};
  if(path.startsWith('invoice_payments?')&&path.includes('payment[payment_intent]=pi_done'))return {data:[{invoice:'in_done',payment:{type:'payment_intent',payment_intent:'pi_done'}}]};
  if(path.startsWith('invoice_payments?')&&path.includes('payment[payment_intent]=pi_fail'))return {data:[{invoice:'in_fail',payment:{type:'payment_intent',payment_intent:'pi_fail'}}]};
  if(path.startsWith('invoice_payments?')&&path.includes('payment[payment_intent]=pi_loose'))return {data:[]};
  if(path.startsWith('invoice_payments?')&&path.includes('payment[payment_intent]=pi_plain'))return {data:[{invoice:'in_plain',payment:{type:'payment_intent',payment_intent:'pi_plain'}}]};
  if(path==='invoices/in_1')return {parent:{subscription_details:{subscription:'sub_r'}}};
  if(path==='invoices/in_plain')return {};
  if(path==='invoices/in_done')return {parent:{subscription_details:{subscription:'sub_done'}}};
  if(path==='invoices/in_fail')return {parent:{subscription_details:{subscription:'sub_fail'}}};
  if(method==='DELETE'){if(path.endsWith('sub_fail'))throw Error('falhou');deleted.push({path,key,method});return {status:'canceled'};}
  if(path.startsWith('subscriptions/'))return {id:path.split('/')[1],status:path.includes('sub_done')?'canceled':'active'};
  throw Error(path);
 };
 const store=new MemoryBillingStore();
 const app=await createBillingService(billingConfig(dir),stripe,()=>now,store);
 const post=(id:string,object:any)=>{const raw=JSON.stringify({id,type:'charge.refunded',data:{object}}),ts=Math.floor(now/1000),signature='t='+ts+',v1='+createHmac('sha256','webhook-test').update(ts+'.'+raw).digest('hex');return app.inject({method:'POST',url:'/billing/webhook',headers:{'content-type':'application/json','stripe-signature':signature},payload:raw});};
 const logs:string[]=[];const originalError=console.error;console.error=(...args:unknown[])=>{logs.push(args.map(String).join(' '));};
 try{
  assert.equal((await post('evt_partial',{refunded:false,payment_intent:'pi_partial'})).statusCode,200);assert.equal(deleted.length,0);
  assert.equal((await post('evt_full',{refunded:true,payment_intent:'pi_full'})).statusCode,200);
  assert.equal(deleted[0].path,'subscriptions/sub_r');assert.equal(deleted[0].method,'DELETE');assert.equal(deleted[0].key,'ln-refund-evt_full');
  assert.equal((await post('evt_done',{refunded:true,payment_intent:'pi_done'})).statusCode,200);assert.equal(deleted.length,1);
  assert.notEqual((await post('evt_fail',{refunded:true,payment_intent:'pi_fail'})).statusCode,200);
  assert.equal((await post('evt_loose',{refunded:true,payment_intent:'pi_loose'})).statusCode,200);
  assert.equal((await post('evt_plain',{refunded:true,payment_intent:'pi_plain'})).statusCode,200);
  assert.equal((await post('evt_bare',{refunded:true,invoice:'in_1'})).statusCode,200);
  assert.equal(deleted.length,1);
  assert.equal(await store.hasEvent('evt_fail'),false);assert.equal(await store.hasEvent('evt_full'),true);
  assert.equal(await store.hasEvent('evt_loose'),true);assert.equal(await store.hasEvent('evt_plain'),true);assert.equal(await store.hasEvent('evt_bare'),true);
  assert.match(logs.join('\n'),/sem fatura de assinatura/);assert.equal(logs.filter(line=>/pi_|in_/.test(line)).join(' || '),'');
  assert.equal(JSON.stringify([...store.events]).includes('invoice'),false);assert.equal(JSON.stringify([...store.events]).includes('in_1'),false);
 }finally{console.error=originalError;await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('A URL das funções junta o caminho e fixa São Paulo',async()=>{
 const dir=temporary(),original=globalThis.fetch;
 try{const target=billingEndpoint('https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing','/billing/checkout');
  assert.equal(target.pathname,'/functions/v1/billing/checkout');assert.equal(target.searchParams.get('forceFunctionRegion'),'sa-east-1');
  assert.equal(billingEndpoint('https://billing.example.com/','/billing/refresh').href,'https://billing.example.com/billing/refresh');
  const local=new Subscription(dir,{...testConfig,serviceUrl:'https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing'},()=>Date.now());
  let sent='';let region='';
  globalThis.fetch=async(url,init)=>{sent=String(url);region=String((init as RequestInit).headers&&(init as RequestInit&{headers:Record<string,string>}).headers['x-region']);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/year'}));};
  assert.equal((await local.checkout('yearly')).url,'https://checkout.stripe.com/c/year');
  assert.match(sent,/\/functions\/v1\/billing\/checkout\?forceFunctionRegion=sa-east-1$/);assert.equal(region,'sa-east-1');
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'free',trial_repeat:true}));
  await local.refresh();assert.equal(local.snapshot().trial_repeat,true);assert.equal(local.snapshot().trial_checked,true);assert.equal(local.snapshot().trial_eligible,false);
  const again=new Subscription(dir,{...testConfig,serviceUrl:'https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing'},()=>Date.now());
  assert.equal(again.snapshot().trial_repeat,true);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});}
});
test('Meu plano consulta a elegibilidade sem travar o chat',async()=>{
 const dir=temporary(),core=new Core(dir,resolve('.'));await core.init();await core.setup('assinatura-senha-de-teste');
 const {app,subscription}=await createApp(core,'test-pro-token',undefined,undefined,{...testConfig,serviceUrl:'https://billing.example.com/'});
 const headers={host:'127.0.0.1:4317',authorization:'Bearer test-pro-token'};const original=globalThis.fetch;
 let calls=0;let release=()=>{};const gate=new Promise<void>(r=>{release=r;});
 globalThis.fetch=async()=>{calls++;await gate;return new Response(JSON.stringify({trial_eligible:true}));};
 try{
  assert.equal((await app.inject({method:'GET',url:'/v1/subscription',headers})).statusCode,200);assert.equal(calls,0);
  const started=Date.now();const plan=await app.inject({method:'GET',url:'/v1/subscription?intent=plan',headers});
  assert.ok(Date.now()-started<1000);assert.equal(plan.json().trial_eligible,false);assert.equal(plan.json().trial_checked,false);assert.equal(calls,1);
  release();let seen=false;
  for(let i=0;i<40&&!seen;i++){await new Promise(r=>setTimeout(r,25));seen=(await app.inject({method:'GET',url:'/v1/subscription',headers})).json().trial_eligible===true;}
  assert.equal(seen,true);assert.equal(calls,1);
  activateTestPro(subscription);calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({trial_eligible:true}));};
  await app.inject({method:'GET',url:'/v1/subscription?intent=plan',headers});assert.equal(calls,0);
 }finally{release();globalThis.fetch=original;await app.close();await core.close();rmSync(dir,{recursive:true,force:true});}
});
test('A URL pública das funções pede a região de São Paulo',async()=>{
 const dir=temporary(),device=randomUUID(),now=Date.now();const calls:any[]=[];
 const stripe=async(path:string,body?:Record<string,string>)=>{
  calls.push({path,body});
  if(path==='prices/price_month')return monthlyPrice();
  if(path==='prices/price_year')return yearlyPrice();
  if(path==='checkout/sessions')return {id:'cs_region',url:'https://checkout.stripe.com/c/region',expires_at:(now+day)/1000};
  throw Error(path);
 };
 const app=await createBillingService({...billingConfig(dir),publicUrl:'https://hifnfveklpskbtxyeqza.supabase.co/functions/v1/billing'},stripe,()=>now);
 try{
  assert.equal((await app.inject({method:'POST',url:'/billing/checkout',headers:{authorization:'Bearer '+'c'.repeat(64)},payload:{device,plan:'yearly'}})).statusCode,200);
  const body=calls.find(c=>c.path==='checkout/sessions').body;
  assert.match(body.success_url,/\/functions\/v1\/billing\/success\?forceFunctionRegion=sa-east-1/);
  assert.match(body.cancel_url,/forceFunctionRegion=sa-east-1/);
  assert.equal(body.client_reference_id,device);
  const page=await app.inject({method:'GET',url:'/billing/success'});
  assert.match(String(page.headers['content-type']),/text\/plain/);assert.doesNotMatch(page.body,/<html/i);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('Produção recusa iniciar sem DATABASE_URL',()=>{
 assert.throws(()=>billingConfigFromEnv({}),/DATABASE_URL/);
});
test('Arquivo de assinatura corrompido preserva o original e mantém Grátis disponível',async()=>{
 const {writeFileSync,readdirSync,readFileSync}=await import('node:fs');const dir=temporary();try{writeFileSync(join(dir,'subscription.json'),'{corrompido');const local=new Subscription(dir,testConfig);assert.equal(local.active,false);const backup=readdirSync(dir).find(p=>p.startsWith('subscription.json.invalid-'));assert.ok(backup);assert.equal(readFileSync(join(dir,backup),'utf8'),'{corrompido');assert.match(local.snapshot().error,/recuperação/);}finally{rmSync(dir,{recursive:true,force:true});}
});
