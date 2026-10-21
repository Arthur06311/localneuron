/** Run on the publisher's HTTPS server. Never distribute its private key with the desktop app. */
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { createHash, createHmac, randomUUID, sign, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { Lease } from './subscription.js';
import { createPostgresStore, MemoryBillingStore, type BillingStore } from './billing-store.js';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const eventSchema=z.object({id:z.string().max(200),type:z.string().max(200),data:z.object({object:z.record(z.string(),z.any())})});
export function verifyWebhook(raw:Buffer, header:string, secret:string, now=Date.now()) {
  const parts=header.split(',').map(s=>s.split('='));const timestamp=parts.find(([k])=>k==='t')?.[1];
  if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)throw Error('Webhook fora do prazo.');
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  if(!parts.some(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v??'')&&timingSafeEqual(expected,Buffer.from(v,'hex'))))throw Error('Webhook inválido.');
  return eventSchema.parse(JSON.parse(raw.toString('utf8')));
}
export function signLease(lease:Lease,key:string) { const payload=Buffer.from(JSON.stringify(lease)).toString('base64url');return payload+'.'+sign(null,Buffer.from(payload),key).toString('base64url'); }
/** Keyed HMAC of a card fingerprint or e-mail. The raw value is never stored. */
export function trialIdentityHmac(kind:'card'|'email', value:string, key:string) {
  const normalized=kind==='email'?value.trim().toLowerCase():value.trim();
  if(!normalized||normalized.length>(kind==='email'?320:128))throw Error('Identificador de teste inválido.');
  return createHmac('sha256',key).update(kind+'\0'+normalized).digest('hex');
}
export type BillingPlan='monthly'|'yearly';
export type BillingConfig={databaseUrl?:string;secretKey:string;webhookSecret:string;monthlyPriceId:string;yearlyPriceId:string;privateKey:string;publicUrl:string;trialHmacKey:string};
export const approvedPlans=Object.freeze({
  monthly:Object.freeze({currency:'brl',unitAmount:2000,interval:'month',intervalCount:1}),
  yearly:Object.freeze({currency:'brl',unitAmount:15000,interval:'year',intervalCount:1}),
});
const priceShape=(price:any,plan:BillingPlan)=>{
  const expected=approvedPlans[plan];
  return Boolean(price?.active&&price.type==='recurring'&&price.currency===expected.currency&&price.unit_amount===expected.unitAmount&&price.billing_scheme==='per_unit'&&price.recurring?.interval===expected.interval&&price.recurring?.interval_count===expected.intervalCount&&price.recurring?.usage_type==='licensed'&&!price.transform_quantity);
};
export function validateApprovedPrice(price:any):BillingPlan {
  const plan=(['monthly','yearly'] as const).find(name=>priceShape(price,name));
  if(!plan)throw Error('O preço do Pro precisa ser R$ 20,00 por mês (BRL 2000) ou R$ 150 por ano (BRL 15000), fixo e sem cobrança por uso.');
  return plan;
}
type StripeMethod='GET'|'POST'|'DELETE';
type StripeCall=(path:string,body?:Record<string,string>,idempotency?:string,method?:StripeMethod)=>Promise<any>;
export function stripeClient(secret:string):StripeCall {
  return async(path,body,idempotency,method)=>{
    const verb=method??(body?'POST':'GET');
    const response=await fetch('https://api.stripe.com/v1/'+path,{method:verb,redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+secret,'Stripe-Version':'2025-03-31.basil',...(body?{'content-type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body:body?new URLSearchParams(body):undefined});
    if(!response.ok)throw Error('O provedor de pagamentos está indisponível.');
    const text=await response.text();if(text.length>1024**2)throw Error('Resposta de pagamento excessiva.');return text?JSON.parse(text):{};
  };
}
export function readPrivateKey(env:NodeJS.ProcessEnv=process.env) {
  const inline=env.LOCALNEURON_LICENSE_PRIVATE_KEY;
  if(typeof inline==='string'&&inline.trim())return inline.replace(/\\n/g,'\n');
  if(env.LOCALNEURON_LICENSE_PRIVATE_KEY_FILE)return readFileSync(env.LOCALNEURON_LICENSE_PRIVATE_KEY_FILE,'utf8');
  throw Error('Configure LOCALNEURON_LICENSE_PRIVATE_KEY ou LOCALNEURON_LICENSE_PRIVATE_KEY_FILE.');
}
export function billingConfigFromEnv(env:NodeJS.ProcessEnv=process.env):BillingConfig {
  const parsed=z.object({DATABASE_URL:z.string().min(1),STRIPE_SECRET_KEY:z.string().min(1),STRIPE_WEBHOOK_SECRET:z.string().min(1),STRIPE_MONTHLY_PRICE_ID:z.string().min(1),STRIPE_YEARLY_PRICE_ID:z.string().min(1),LOCALNEURON_BILLING_PUBLIC_URL:z.string().url(),LOCALNEURON_BILLING_TRIAL_HMAC_KEY:z.string().min(32)}).parse(env);
  return {databaseUrl:parsed.DATABASE_URL,secretKey:parsed.STRIPE_SECRET_KEY,webhookSecret:parsed.STRIPE_WEBHOOK_SECRET,monthlyPriceId:parsed.STRIPE_MONTHLY_PRICE_ID,yearlyPriceId:parsed.STRIPE_YEARLY_PRICE_ID,privateKey:readPrivateKey(env),publicUrl:parsed.LOCALNEURON_BILLING_PUBLIC_URL,trialHmacKey:parsed.LOCALNEURON_BILLING_TRIAL_HMAC_KEY};
}
export function trustBillingProxy(env:NodeJS.ProcessEnv=process.env) {
  return env.LOCALNEURON_BILLING_TRUST_PROXY==='supabase'||String(env.SUPABASE_URL??'').includes('.supabase.co');
}
function clientIp(real:unknown,forwarded:unknown,fallback:string,trust:boolean) {
  if(!trust)return fallback;
  const raw=typeof real==='string'&&real.trim()?real:typeof forwarded==='string'?forwarded.split(',')[0]:'';
  const value=raw.trim();
  if(!value||value.length>64||!/^[0-9a-fA-F:.]+$/.test(value)||value.includes('..'))return fallback;
  return value;
}
function publicBase(publicUrl:string) {
  const origin=new URL(publicUrl);
  const path=origin.pathname.replace(/\/$/,'')||'/';
  const ok=path==='/'||path==='/billing'||path.endsWith('/functions/v1/billing');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||!ok)throw Error('Configure uma origem HTTPS pública.');
  origin.pathname=path==='/'?'/':path;origin.search='';origin.hash='';
  return origin;
}
function billingLinks(base:URL) {
  const path=base.pathname.replace(/\/$/,'')||'/';
  const success=new URL(base.origin),cancel=new URL(base.origin);
  if(path==='/'||path==='/billing'){success.pathname='/billing/success';cancel.pathname='/billing/cancel';}
  else{success.pathname=path+'/success';cancel.pathname=path+'/cancel';}
  if(path.includes('/functions/v1/billing')){success.searchParams.set('forceFunctionRegion','sa-east-1');cancel.searchParams.set('forceFunctionRegion','sa-east-1');}
  return {success:success.href,cancel:cancel.href};
}
const hadTrial=(sub:any)=>Boolean(sub&&(sub.status==='trialing'||sub.trial_start||sub.trial_end));
const verifiedHandlers=new WeakMap<object,(event:z.infer<typeof eventSchema>)=>Promise<{received:boolean}>>();
export async function createBillingService(config:BillingConfig, stripe:StripeCall=stripeClient(config.secretKey), now=Date.now, store?:BillingStore, env:NodeJS.ProcessEnv=process.env) {
  if(typeof config.trialHmacKey!=='string'||config.trialHmacKey.length<32)throw Error('Configure LOCALNEURON_BILLING_TRIAL_HMAC_KEY com pelo menos 32 caracteres.');
  if(config.monthlyPriceId===config.yearlyPriceId)throw Error('Os preços mensal e anual precisam ser identificadores diferentes.');
  const origin=publicBase(config.publicUrl);
  const links=billingLinks(origin);
  const monthly=await stripe('prices/'+encodeURIComponent(config.monthlyPriceId));
  const yearly=await stripe('prices/'+encodeURIComponent(config.yearlyPriceId));
  if(validateApprovedPrice(monthly)!=='monthly')throw Error('O preço mensal do Pro precisa ser fixo: R$ 20,00 em BRL por mês, sem cobrança por uso.');
  if(validateApprovedPrice(yearly)!=='yearly')throw Error('O preço anual do Pro precisa ser fixo: R$ 150 em BRL por ano, sem cobrança por uso.');
  const priceId:Record<BillingPlan,string>={monthly:config.monthlyPriceId,yearly:config.yearlyPriceId};
  const db=store??(config.databaseUrl?createPostgresStore(config.databaseUrl,undefined,env):new MemoryBillingStore());
  const trust=trustBillingProxy(env);
  const app=Fastify({logger:false,bodyLimit:256*1024,trustProxy:'loopback'});
  const limited={config:{rateLimit:{max:60,timeWindow:'1 minute'}}};
  const hits=new Map<string,number>();
  let lastPurge=0;
  class DurableRateStore {
    route='*';
    constructor(_options?:unknown) {}
    child(routeOptions:any) {
      const child=new DurableRateStore();
      const info=routeOptions?.routeInfo;
      child.route=String(info?.url||routeOptions?.path||'*');
      return child;
    }
    incr(key:string, cb:(err:Error|null, result?:{current:number;ttl:number})=>void, timeWindow:number, max:number) {
      const windowMs=Math.max(1,Number(timeWindow)||60_000);
      const nowMs=now();
      const windowStart=Math.floor(nowMs/windowMs)*windowMs;
      const ttl=Math.max(1,windowStart+windowMs-nowMs);
      const ipHash=createHmac('sha256',config.trialHmacKey).update('ip\0'+String(key)).digest('hex');
      const cacheKey=ipHash+'\0'+this.route+'\0'+windowStart;
      const cached=hits.get(cacheKey);
      if(cached!==undefined&&cached>max){cb(null,{current:cached,ttl});return;}
      void (async()=>{
        let current:number;
        try{current=await db.bumpRate(ipHash,this.route,windowStart);}
        catch{current=(hits.get(cacheKey)??0)+1;}
        hits.set(cacheKey,current);
        if(lastPurge<windowStart){lastPurge=windowStart;void db.purgeRateWindows(nowMs-120_000).catch(()=>{});}
        cb(null,{current,ttl});
      })().catch(err=>cb(err instanceof Error?err:Error('Limite indisponível.')));
    }
  }
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    if(req.headers.origin)return reply.code(403).send({error:'Use o aplicativo LocalNeuron.'});
  });
  await app.register(rateLimit,{global:true,max:60,timeWindow:'1 minute',store:DurableRateStore as any,allowList:(req:any)=>['/health','/billing/health','/billing/webhook'].includes(String(req.url).split('?')[0]),keyGenerator:(req:any)=>clientIp(req.headers['x-real-ip'],req.headers['x-forwarded-for'],req.ip,trust),errorResponseBuilder:()=>Object.assign(Error('Aguarde antes de tentar novamente.'),{statusCode:429})});
  app.setErrorHandler((_e,req,reply)=>{const status=(_e as any).statusCode||400;return reply.code(status).send({error:status===429?'Aguarde antes de tentar novamente.':status===401?'Não autorizado.':'Não foi possível concluir a operação de assinatura.'});});
  app.addHook('onClose',async()=>db.close());
  const row=(id:string)=>db.getDevice(id);
  const markTrial=(id:string)=>db.markTrial(id);
  async function authenticate(req:any,register=false) {
    const parsed=z.strictObject({device:z.string().uuid(),plan:z.enum(['monthly','yearly']).optional()}).parse(req.body);
    const secret=z.string().regex(/^Bearer [a-f0-9]{64}$/).parse(req.headers.authorization).slice(7),hash=digest(secret);
    let stored=await row(parsed.device);
    if(!stored&&register){await db.insertDevice(parsed.device,hash);stored=await row(parsed.device);}
    if(!stored||!timingSafeEqual(Buffer.from(stored.secret),Buffer.from(hash)))throw Object.assign(Error('Não autorizado'),{statusCode:401});
    return Object.assign(stored,{requestedPlan:(parsed.plan??'monthly') as BillingPlan});
  }
  const gates=new Map<string,Promise<unknown>>();
  function exclusive<T>(device:string,fn:()=>Promise<T>):Promise<T> {const p=(gates.get(device)||Promise.resolve()).then(fn,fn);gates.set(device,p);void p.finally(()=>{if(gates.get(device)===p)gates.delete(device);}).catch(()=>{});return p;}
  async function subscription(device:string) {
    let d=await row(device); if(!d)return null;
    if(!d.subscription&&d.checkout){const checkout=await stripe('checkout/sessions/'+encodeURIComponent(d.checkout));if(checkout.status==='complete'&&checkout.mode==='subscription'&&checkout.client_reference_id===device&&typeof checkout.subscription==='string'&&typeof checkout.customer==='string'){await db.updateDevice(device,{customer:checkout.customer,subscription:checkout.subscription});d=await row(device);}}
    if(!d?.subscription)return null;
    const sub=await stripe('subscriptions/'+encodeURIComponent(d.subscription)+'?expand[]=latest_invoice');
    if(sub.customer!==d.customer||sub.metadata?.device!==device)throw Error('Assinatura não corresponde à instalação.');
    if(hadTrial(sub))await markTrial(device);
    return sub;
  }
  async function rememberTrialIdentity(deviceId:string, subscriptionId:string, emailHint?:string) {
    const sub=await stripe('subscriptions/'+encodeURIComponent(subscriptionId)+'?expand[]=default_payment_method&expand[]=customer');
    const fingerprint=sub?.default_payment_method?.card?.fingerprint;
    const customerEmail=typeof sub?.customer==='object'?sub.customer?.email:undefined;
    const seen=new Set<string>();
    let repeat=false;
    const consider=async(kind:'card'|'email', value:unknown)=>{
      if(typeof value!=='string')return;
      let hmac:string;
      try{hmac=trialIdentityHmac(kind,value,config.trialHmacKey);}catch{return;}
      if(seen.has(hmac))return;
      seen.add(hmac);
      const owner=await db.rememberIdentity(hmac,subscriptionId,now());
      if(owner!==subscriptionId)repeat=true;
    };
    await consider('card',fingerprint);
    await consider('email',customerEmail);
    await consider('email',emailHint);
    if(!repeat)return false;
    await markTrial(deviceId);
    if(sub?.status==='trialing')await stripe('subscriptions/'+encodeURIComponent(subscriptionId),{trial_end:'now'});
    return true;
  }
  async function customerUsedTrial(d:any) {
    if(!d.customer)return false;
    const list=await stripe('subscriptions?customer='+encodeURIComponent(d.customer)+'&status=all&limit=100');
    const used=Boolean(list?.has_more||(Array.isArray(list?.data)&&list.data.some(hadTrial)));
    if(used)await markTrial(d.id);
    return used;
  }
  function entitlement(device:string,sub:any) {
    if(!sub)return {status:'free'};
    const allowed=new Set([config.monthlyPriceId,config.yearlyPriceId]);
    const item=sub.items?.data?.find((i:any)=>allowed.has(i.price?.id));
    const period=Number(item?.current_period_end??sub.current_period_end)*1000;
    const trialEnd=Number(sub.trial_end)*1000;
    const trialing=Boolean(item&&sub.status==='trialing'&&!sub.pause_collection&&Number.isFinite(trialEnd)&&trialEnd>now());
    const paid=Boolean(item&&sub.status==='active'&&!sub.pause_collection&&sub.latest_invoice?.status==='paid'&&Number.isFinite(period)&&period>now());
    const active=trialing||paid;
    const accessEnd=trialing?trialEnd:period;
    const lease:Lease={version:1,audience:'localneuron-pro',device,subscription:sub.id,status:active?'active':['past_due','unpaid','incomplete'].includes(sub.status)?'past_due':'canceled',issued_at:now(),expires_at:active?Math.min(accessEnd,now()+7*86400_000):now(),period_end:Number.isFinite(accessEnd)&&accessEnd>0?accessEnd:now(),cancel_at_period_end:Boolean(sub.cancel_at_period_end)};
    return {token:signLease(lease,config.privateKey)};
  }
  async function issue(deviceId:string) {
    let sub=await subscription(deviceId);
    if(sub?.status==='trialing'&&typeof sub.id==='string'){
      const ended=await rememberTrialIdentity(deviceId,sub.id);
      if(ended){
        sub=await subscription(deviceId);
        if(!sub||sub.status==='trialing')return {status:'free',trial_repeat:true};
        return {...entitlement(deviceId,sub),trial_repeat:true};
      }
    }
    return entitlement(deviceId,sub);
  }
  async function cancelIfRefunded(object:any, eventId:string) {
    if(object?.refunded!==true)return;
    const invoiceId=typeof object.invoice==='string'?object.invoice:typeof object.invoice?.id==='string'?object.invoice.id:'';
    if(!invoiceId)return;
    const invoice=await stripe('invoices/'+encodeURIComponent(invoiceId));
    const raw=invoice?.parent?.subscription_details?.subscription??invoice?.subscription;
    const subscriptionId=typeof raw==='string'?raw:typeof raw?.id==='string'?raw.id:'';
    if(!subscriptionId)return;
    const current=await stripe('subscriptions/'+encodeURIComponent(subscriptionId));
    if(current?.status==='canceled')return;
    await stripe('subscriptions/'+encodeURIComponent(subscriptionId),undefined,'ln-refund-'+eventId,'DELETE');
  }
  async function applyEvent(event:z.infer<typeof eventSchema>) {
    if(await db.hasEvent(event.id))return {received:true};
    const object=event.data.object;
    if(event.type==='charge.refunded')await cancelIfRefunded(object,event.id);
    else{
      const device=event.type==='checkout.session.completed'?object.client_reference_id:object.metadata?.device;
      const invoiceSub=object.parent?.subscription_details?.subscription;
      const lookup=typeof device==='string'?await row(device):typeof invoiceSub==='string'?await db.findDeviceBySubscription(invoiceSub):null;
      if(lookup&&['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'].includes(event.type))await exclusive(lookup.id,async()=>{
        await subscription(lookup.id);
        if(event.type!=='checkout.session.completed'&&event.type!=='customer.subscription.created')return;
        const rawSub=event.type==='checkout.session.completed'?object.subscription:object.id;
        const subscriptionId=typeof rawSub==='string'?rawSub:typeof rawSub?.id==='string'?rawSub.id:'';
        if(!subscriptionId)return;
        const emailHint=typeof object.customer_details?.email==='string'?object.customer_details.email:typeof object.customer_email==='string'?object.customer_email:undefined;
        await rememberTrialIdentity(lookup.id,subscriptionId,emailHint);
      });
    }
    await db.saveEvent(event.id,now());
    await db.purgeEvents(now()-90*86400_000);
    await db.purgeIdentities(now()-5*365*86400_000);
    return {received:true};
  }
  verifiedHandlers.set(app,applyEvent);
  app.get('/health',async()=>({ok:true}));
  app.get('/billing/health',async(_req,reply)=>{try{await db.ping();return {ok:true};}catch{return reply.code(503).send({ok:false});}});
  app.post('/billing/checkout',limited,async req=>{const d=await authenticate(req,true);return exclusive(d.id,async()=>{
    const plan=d.requestedPlan as BillingPlan;
    const current=await subscription(d.id);
    if(current&&['active','trialing','past_due','unpaid','incomplete','paused'].includes(current.status)){
      const customer=(await row(d.id))?.customer;if(!customer)throw Error('Sem assinatura.');
      const portal=await stripe('billing_portal/sessions',{customer,return_url:links.success});
      return {url:portal.url};
    }
    const fresh=await row(d.id);if(!fresh)throw Error('Instalação não encontrada.');
    if(fresh.checkout_url&&fresh.checkout_expires&&fresh.checkout_expires>now()&&!fresh.subscription&&fresh.checkout_plan===plan)return {url:fresh.checkout_url};
    const grantTrial=!(fresh.trial_used||await customerUsedTrial(fresh));
    if(fresh.checkout&&!fresh.subscription){try{await stripe('checkout/sessions/'+encodeURIComponent(fresh.checkout)+'/expire',{});}catch{/* a sessão anterior já estava encerrada */}}
    const attempt=await db.claimCheckoutAttempt(d.id,fresh.checkout_attempt||randomUUID());
    const checkout=await stripe('checkout/sessions',{mode:'subscription','line_items[0][price]':priceId[plan],'line_items[0][quantity]':'1',client_reference_id:d.id,'subscription_data[metadata][device]':d.id,'metadata[device]':d.id,success_url:links.success,cancel_url:links.cancel,payment_method_collection:'always',locale:'pt-BR',...(grantTrial?{'subscription_data[trial_period_days]':'7'}:{}),...(fresh.customer?{customer:fresh.customer}:{})},'ln-'+d.id+'-'+attempt);
    await db.updateDevice(d.id,{checkout:checkout.id,checkout_url:checkout.url,checkout_expires:checkout.expires_at*1000,checkout_attempt:null,checkout_plan:plan,subscription:null});return {url:checkout.url};
  });});
  app.post('/billing/eligibility',limited,async req=>{
    const parsed=z.strictObject({device:z.string().uuid()}).parse(req.body);
    const secret=z.string().regex(/^Bearer [a-f0-9]{64}$/).parse(req.headers.authorization).slice(7);
    const stored=await row(parsed.device);
    if(!stored)return {trial_eligible:true};
    if(!timingSafeEqual(Buffer.from(stored.secret),Buffer.from(digest(secret))))throw Object.assign(Error('Não autorizado'),{statusCode:401});
    return exclusive(stored.id,async()=>{const fresh=await row(stored.id);if(!fresh)return {trial_eligible:true};return {trial_eligible:!(fresh.trial_used||await customerUsedTrial(fresh))};});
  });
  const refresh=async(req:any)=>{const d=await authenticate(req);return exclusive(d.id,async()=>issue(d.id));};
  app.post('/billing/refresh',limited,refresh);
  app.post('/billing/subscription',limited,refresh);
  app.post('/billing/portal',limited,async req=>{const d=await authenticate(req);return exclusive(d.id,async()=>{await subscription(d.id);const customer=(await row(d.id))?.customer;if(!customer)throw Error('Sem assinatura.');const portal=await stripe('billing_portal/sessions',{customer,return_url:links.success});return {url:portal.url};});});
  app.get('/billing/success',async(_req,reply)=>reply.type('text/html; charset=utf-8').send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>LocalNeuron Pro</title><h1>Volte ao LocalNeuron</h1><p>Em Meu plano, clique em Atualizar assinatura. Nos 7 dias grátis, o Pro é liberado depois que a assinatura é confirmada. Fora do teste, o Pro é liberado após a confirmação do pagamento.</p></html>'));
  app.get('/billing/cancel',async(_req,reply)=>reply.type('text/html; charset=utf-8').send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>LocalNeuron</title><h1>Você pode continuar com o Grátis</h1><p>Volte ao LocalNeuron para conversar com suas IAs.</p></html>'));
  await app.register(async scope=>{
    scope.removeContentTypeParser('application/json');scope.addContentTypeParser('application/json',{parseAs:'buffer'},(_req,body,done)=>done(null,body));
    scope.post('/billing/webhook',async(req)=>{
      const event=verifyWebhook(req.body as Buffer,String(req.headers['stripe-signature']??''),config.webhookSecret,now());
      return applyEvent(event);
    });
  });
  return app;
}
export async function applyVerifiedStripeEvent(app:object, event:unknown) {
  const handler=verifiedHandlers.get(app);
  if(!handler)throw Error('Serviço de cobrança indisponível.');
  return handler(eventSchema.parse(event));
}
export async function createBillingFromEnv(env:NodeJS.ProcessEnv=process.env) {
  const config=billingConfigFromEnv(env);
  return createBillingService(config,stripeClient(config.secretKey),Date.now,undefined,env);
}
/** Map a Supabase function URL onto the Fastify route. The raw client address stays out of Postgres. */
export function billingFunctionPath(url?:string):string {
  let parsed:URL;
  try{parsed=new URL(url&&url.length?url:'/','https://billing.localneuron.ai');}catch{return '/';}
  let path=parsed.pathname.replace(/\/+$/,'')||'/';
  const marker='/functions/v1/billing';
  const at=path.indexOf(marker);
  if(at>=0){const rest=path.slice(at+marker.length);path=rest?'/billing'+rest:'/health';}
  if(!/^\/(health|billing(\/[\w./-]*)?)$/.test(path)||path.includes('..'))return '/';
  parsed.searchParams.delete('forceFunctionRegion');
  const query=parsed.searchParams.toString();
  return path+(query?'?'+query:'');
}
type WebMethod='GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS';
export async function handleBillingWeb(app:Awaited<ReturnType<typeof createBillingService>>, request:Request):Promise<Response> {
  await app.ready();
  const method=(request.method||'GET').toUpperCase();
  const safe=(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(method)?method:'GET') as WebMethod;
  const headers:Record<string,string>={};
  request.headers.forEach((value,key)=>{if(key==='content-length'||key==='transfer-encoding')return;headers[key]=value;});
  const target=new URL(request.url);
  const payload=safe==='GET'||safe==='HEAD'?undefined:Buffer.from(await request.arrayBuffer());
  const result=await app.inject({method:safe,url:billingFunctionPath(target.pathname+target.search),headers,payload});
  const out=new Headers();
  for(const [key,value] of Object.entries(result.headers)){
    if(value===undefined)continue;
    if(Array.isArray(value)){for(const item of value)out.append(key,String(item));}
    else out.set(key,String(value));
  }
  return new Response(new Uint8Array(result.rawPayload),{status:result.statusCode,headers:out});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const host=z.enum(['127.0.0.1','0.0.0.0']).default('127.0.0.1').parse(process.env.LOCALNEURON_BILLING_HOST);
  const app=await createBillingFromEnv();
  await app.listen({host,port:Number(process.env.LOCALNEURON_BILLING_PORT||4330)});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.close().then(()=>process.exit(0)));
}
