import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHmac,generateKeyPairSync,randomUUID} from 'node:crypto';
import {Subscription,requiredFeature,verifyLease,type Lease} from '../src/subscription.js';
import {billingConfigFromEnv,billingRequestUrl,createBillingService,dispatchNodeRequest,signLease,verifyWebhook,validateApprovedPrice,trialIdentityHmac} from '../src/billing-service.js';
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
const billingConfig=(_dir:string)=>({secretKey:'test',webhookSecret:'webhook-test',monthlyPriceId:'price_month',yearlyPriceId:'price_year',privateKey,publicUrl:'https://billing.example.com',trialHmacKey});
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
 const dir=temporary(),now=Date.now(),original=globalThis.fetch;const {readFileSync}=await import('node:fs');
 try{const local=new Subscription(dir,{...testConfig,serviceUrl:'https://billing.example.com/'},()=>now);
  assert.equal(local.snapshot().trial_eligible,false);
  globalThis.fetch=async()=>{throw Error('offline');};await local.refreshEligibility();assert.equal(local.snapshot().trial_eligible,false);
  globalThis.fetch=async()=>new Response(JSON.stringify({trial_eligible:true}));await local.refreshEligibility();assert.equal(local.snapshot().trial_eligible,true);
  local.install(signLease(lease(local.snapshot().device,now),privateKey));assert.equal(local.snapshot().trial_eligible,false);
  const page=readFileSync(resolve('public/subscription.js'),'utf8');
  assert.match(page,/trial=Boolean\(state\.configured&&state\.trial_eligible&&!managing\)/);
  assert.match(page,/trial\?'<p class="trial-note">7 dias grátis<\/p>':''/);
  assert.match(page,/Troque entre Mensal e Anual em Gerenciar assinatura/);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});}
});
test('O serviço exige a chave de HMAC do teste',async()=>{
 const dir=temporary();
 try{await assert.rejects(()=>createBillingService({...billingConfig(dir),trialHmacKey:'curta'},async()=>monthlyPrice()),/32/);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('Postgres usa o pooler 6543 sem prepared statements e a migração não guarda cartão',async()=>{
 assert.equal(supabasePoolOptions.prepare,false);assert.equal(supabasePoolOptions.ssl,'require');assert.equal(supabasePoolOptions.max,1);
 assert.throws(()=>assertTransactionPoolerUrl('postgresql://local:local@127.0.0.1:5432/postgres'),/6543/);
 let opened=false;const connect=(((_url:string,options:typeof supabasePoolOptions)=>{opened=true;assert.equal(options.prepare,false);return {async end(){}};}) as unknown) as typeof postgres;
 const store=createPostgresStore('postgresql://postgres.projeto:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',connect);
 assert.equal(opened,true);await store.close();
 assert.throws(()=>createPostgresStore('postgresql://local:local@127.0.0.1:5432/postgres',(()=>{throw Error('não conecta');}) as unknown as typeof postgres),/6543/);
 const sql=readFileSync(resolve('billing/migrations/20261021000000_init.sql'),'utf8');
 assert.match(sql,/billing\.devices/);assert.match(sql,/billing\.events/);assert.match(sql,/billing\.trial_identities/);
 assert.match(sql,/enable row level security/);assert.doesNotMatch(sql,/fingerprint|email/i);
 const vercel=readFileSync(resolve('vercel.json'),'utf8');assert.match(vercel,/gru1/);assert.match(vercel,/path=\/health/);
 assert.match(readFileSync(resolve('api/billing.js'),'utf8'),/bodyParser:\s*false/);
 assert.equal(existsSync('fly.toml'),false);assert.equal(existsSync('billing/Dockerfile'),false);assert.equal(existsSync('billing/docker-entrypoint.sh'),false);assert.equal(existsSync('.dockerignore'),false);
});
test('A função da Vercel entrega o corpo cru do webhook na rota pública',async()=>{
 const dir=temporary(),now=Date.now();
 const stripe=async(path:string)=>{if(path==='prices/price_month')return monthlyPrice();if(path==='prices/price_year')return yearlyPrice();throw Error(path);};
 const app=await createBillingService(billingConfig(dir),stripe,()=>now);
 const payload='{"id": "evt_raw", "type": "invoice.paid", "data": {"object": {}}}';
 const ts=Math.floor(now/1000),signature='t='+ts+',v1='+createHmac('sha256','webhook-test').update(ts+'.'+payload).digest('hex');
 const request={method:'POST',url:'/api/billing?path=/billing/webhook',headers:{'content-type':'application/json','stripe-signature':signature,'content-length':'9999','transfer-encoding':'chunked'},async *[Symbol.asyncIterator](){yield Buffer.from(payload);}};
 const response={statusCode:0,setHeader(){},end(body?:any){this.statusCode=response.statusCode;response.body=Buffer.isBuffer(body)?body.toString('utf8'):String(body??'');},body:''};
 try{
  assert.equal(billingRequestUrl('/health'),'/health');
  assert.equal(billingRequestUrl('/api/billing?path=/health'),'/health');
  assert.equal(billingRequestUrl('/api/billing?path=/billing/webhook'),'/billing/webhook');
  assert.equal(billingRequestUrl('/billing/success'),'/billing/success');
  await dispatchNodeRequest(app,request,response);
  assert.equal(response.statusCode,200);assert.match(response.body,/received/);
  const health={statusCode:0,setHeader(){},end(body?:any){health.body=Buffer.isBuffer(body)?body.toString('utf8'):String(body??'');},body:''};
  await dispatchNodeRequest(app,{method:'GET',url:'/api/billing?path=/health',headers:{},async *[Symbol.asyncIterator](){}},health);
  assert.equal(health.statusCode,200);assert.match(health.body,/"ok":true/);
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
test('Produção recusa iniciar sem DATABASE_URL',()=>{
 assert.throws(()=>billingConfigFromEnv({}),/DATABASE_URL/);
});
test('Arquivo de assinatura corrompido preserva o original e mantém Grátis disponível',async()=>{
 const {writeFileSync,readdirSync,readFileSync}=await import('node:fs');const dir=temporary();try{writeFileSync(join(dir,'subscription.json'),'{corrompido');const local=new Subscription(dir,testConfig);assert.equal(local.active,false);const backup=readdirSync(dir).find(p=>p.startsWith('subscription.json.invalid-'));assert.ok(backup);assert.equal(readFileSync(join(dir,backup),'utf8'),'{corrompido');assert.match(local.snapshot().error,/recuperação/);}finally{rmSync(dir,{recursive:true,force:true});}
});
