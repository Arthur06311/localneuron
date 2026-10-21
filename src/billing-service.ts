/** Run on the publisher's HTTPS server. Never distribute its private key with the desktop app. */
import Fastify from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomUUID, sign, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { Lease } from './subscription.js';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export function verifyWebhook(raw:Buffer, header:string, secret:string, now=Date.now()) {
  const parts=header.split(',').map(s=>s.split('='));const timestamp=parts.find(([k])=>k==='t')?.[1];
  if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)throw Error('Webhook fora do prazo.');
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  if(!parts.some(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v??'')&&timingSafeEqual(expected,Buffer.from(v,'hex'))))throw Error('Webhook inválido.');
  return z.object({id:z.string().max(200),type:z.string().max(200),data:z.object({object:z.record(z.string(),z.any())})}).parse(JSON.parse(raw.toString('utf8')));
}
export function signLease(lease:Lease,key:string) { const payload=Buffer.from(JSON.stringify(lease)).toString('base64url');return payload+'.'+sign(null,Buffer.from(payload),key).toString('base64url'); }
export type BillingPlan='monthly'|'yearly';
export type BillingConfig={database:string;secretKey:string;webhookSecret:string;monthlyPriceId:string;yearlyPriceId:string;privateKey:string;publicUrl:string};
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
type StripeCall=(path:string,body?:Record<string,string>,idempotency?:string)=>Promise<any>;
export function stripeClient(secret:string):StripeCall {
  return async(path,body,idempotency)=>{
    const response=await fetch('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+secret,'Stripe-Version':'2025-03-31.basil',...(body?{'content-type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body:body?new URLSearchParams(body):undefined});
    if(!response.ok)throw Error('O provedor de pagamentos está indisponível.');
    const text=await response.text();if(text.length>1024**2)throw Error('Resposta de pagamento excessiva.');return JSON.parse(text);
  };
}
const flyClientIp=(header:unknown)=>{
  if(process.env.LOCALNEURON_BILLING_TRUST_PROXY!=='fly'||typeof header!=='string')return;
  const value=header.trim();
  if(!value||value.length>64||!/^[0-9a-fA-F:.]+$/.test(value)||value.includes('..'))return;
  return value;
};
const hadTrial=(sub:any)=>Boolean(sub&&(sub.status==='trialing'||sub.trial_start||sub.trial_end));
export async function createBillingService(config:BillingConfig, stripe:StripeCall=stripeClient(config.secretKey), now=Date.now) {
  const origin=new URL(config.publicUrl);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Configure uma origem HTTPS pública.');
  if(config.monthlyPriceId===config.yearlyPriceId)throw Error('Os preços mensal e anual precisam ser identificadores diferentes.');
  const monthly=await stripe('prices/'+encodeURIComponent(config.monthlyPriceId));
  const yearly=await stripe('prices/'+encodeURIComponent(config.yearlyPriceId));
  if(validateApprovedPrice(monthly)!=='monthly')throw Error('O preço mensal do Pro precisa ser fixo: R$ 20,00 em BRL por mês, sem cobrança por uso.');
  if(validateApprovedPrice(yearly)!=='yearly')throw Error('O preço anual do Pro precisa ser fixo: R$ 150 em BRL por ano, sem cobrança por uso.');
  const priceId:Record<BillingPlan,string>={monthly:config.monthlyPriceId,yearly:config.yearlyPriceId};
  mkdirSync(dirname(config.database),{recursive:true,mode:0o700});const db=new DatabaseSync(config.database);db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, secret TEXT NOT NULL, checkout TEXT, checkout_url TEXT, checkout_expires INTEGER, checkout_attempt TEXT, checkout_plan TEXT, customer TEXT, subscription TEXT, trial_used INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, processed INTEGER NOT NULL);`);
  const columns=()=>db.prepare('PRAGMA table_info(devices)').all() as any[];
  if(!columns().some(c=>c.name==='checkout_attempt'))db.exec('ALTER TABLE devices ADD COLUMN checkout_attempt TEXT');
  if(!columns().some(c=>c.name==='checkout_plan'))db.exec('ALTER TABLE devices ADD COLUMN checkout_plan TEXT');
  if(!columns().some(c=>c.name==='trial_used'))db.exec('ALTER TABLE devices ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0');
  const app=Fastify({logger:false,bodyLimit:256*1024,trustProxy:'loopback'});
  const rate=new Map<string,{count:number;until:number}>();
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    if(req.headers.origin)return reply.code(403).send({error:'Use o aplicativo LocalNeuron.'});
    const path=req.url.split('?')[0];
    if(path==='/billing/webhook'||path==='/health')return;
    for(const [key,value]of rate)if(value.until<now())rate.delete(key);
    const ip=flyClientIp(req.headers['fly-client-ip'])||req.ip;
    const value=rate.get(ip)||{count:0,until:now()+60_000};value.count++;rate.set(ip,value);
    if(value.count>60||rate.size>10000)return reply.code(429).send({error:'Aguarde antes de tentar novamente.'});
  });
  app.setErrorHandler((e,req,reply)=>reply.code((e as any).statusCode||400).send({error:'Não foi possível concluir a operação de assinatura.'}));
  app.addHook('onClose',async()=>db.close());
  const row=(id:string)=>db.prepare('SELECT * FROM devices WHERE id=?').get(id) as any;
  const markTrial=(id:string)=>db.prepare('UPDATE devices SET trial_used=1 WHERE id=?').run(id);
  function authenticate(req:any,register=false) {
    const parsed=z.strictObject({device:z.string().uuid(),plan:z.enum(['monthly','yearly']).optional()}).parse(req.body);
    const secret=z.string().regex(/^Bearer [a-f0-9]{64}$/).parse(req.headers.authorization).slice(7),hash=digest(secret);
    let stored=row(parsed.device);
    if(!stored&&register){db.prepare('INSERT INTO devices(id,secret) VALUES(?,?)').run(parsed.device,hash);stored=row(parsed.device);}
    if(!stored||!timingSafeEqual(Buffer.from(stored.secret),Buffer.from(hash)))throw Object.assign(Error('Não autorizado'),{statusCode:401});
    return Object.assign(stored,{requestedPlan:(parsed.plan??'monthly') as BillingPlan});
  }
  // Serialize transitions per installation. Webhook retries read current Stripe state, never event snapshots.
  const gates=new Map<string,Promise<unknown>>();
  function exclusive<T>(device:string,fn:()=>Promise<T>):Promise<T> {const p=(gates.get(device)||Promise.resolve()).then(fn,fn);gates.set(device,p);void p.finally(()=>{if(gates.get(device)===p)gates.delete(device);}).catch(()=>{});return p;}
  async function subscription(device:string) {
    let d=row(device); if(!d)return null;
    if(!d.subscription&&d.checkout){const checkout=await stripe('checkout/sessions/'+encodeURIComponent(d.checkout));if(checkout.status==='complete'&&checkout.mode==='subscription'&&checkout.client_reference_id===device&&typeof checkout.subscription==='string'&&typeof checkout.customer==='string'){db.prepare('UPDATE devices SET customer=?, subscription=? WHERE id=?').run(checkout.customer,checkout.subscription,device);d=row(device);}}
    if(!d.subscription)return null;
    const sub=await stripe('subscriptions/'+encodeURIComponent(d.subscription)+'?expand[]=latest_invoice');
    if(sub.customer!==d.customer||sub.metadata?.device!==device)throw Error('Assinatura não corresponde à instalação.');
    if(hadTrial(sub))markTrial(device);
    return sub;
  }
  async function customerUsedTrial(d:any) {
    if(!d.customer)return false;
    const list=await stripe('subscriptions?customer='+encodeURIComponent(d.customer)+'&status=all&limit=100');
    const used=Boolean(list?.has_more||(Array.isArray(list?.data)&&list.data.some(hadTrial)));
    if(used)markTrial(d.id);
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
  app.get('/health',async()=>({ok:true}));
  app.post('/billing/checkout',async req=>{const d=authenticate(req,true);return exclusive(d.id,async()=>{
    const plan=d.requestedPlan as BillingPlan;
    const current=await subscription(d.id);
    if(current&&['active','trialing','past_due','unpaid','incomplete','paused'].includes(current.status))throw Error('Gerencie sua assinatura existente.');
    const fresh=row(d.id);
    if(fresh.checkout_url&&fresh.checkout_expires>now()&&!fresh.subscription&&fresh.checkout_plan===plan)return {url:fresh.checkout_url};
    const grantTrial=!(fresh.trial_used||await customerUsedTrial(fresh));
    if(fresh.checkout&&!fresh.subscription){try{await stripe('checkout/sessions/'+encodeURIComponent(fresh.checkout)+'/expire',{});}catch{/* a sessão anterior já estava encerrada */}}
    const attempt=fresh.checkout_attempt||randomUUID();db.prepare('UPDATE devices SET checkout_attempt=? WHERE id=?').run(attempt,d.id);
    const checkout=await stripe('checkout/sessions',{mode:'subscription','line_items[0][price]':priceId[plan],'line_items[0][quantity]':'1',client_reference_id:d.id,'subscription_data[metadata][device]':d.id,'metadata[device]':d.id,success_url:origin.origin+'/billing/success',cancel_url:origin.origin+'/billing/cancel',payment_method_collection:'always',locale:'pt-BR',...(grantTrial?{'subscription_data[trial_period_days]':'7'}:{}),...(fresh.customer?{customer:fresh.customer}:{})},'ln-'+d.id+'-'+attempt);
    db.prepare('UPDATE devices SET checkout=?,checkout_url=?,checkout_expires=?,checkout_attempt=NULL,checkout_plan=?,trial_used=1,subscription=NULL WHERE id=?').run(checkout.id,checkout.url,checkout.expires_at*1000,plan,d.id);return {url:checkout.url};
  });});
  app.post('/billing/refresh',async req=>{const d=authenticate(req);return exclusive(d.id,async()=>entitlement(d.id,await subscription(d.id)));});
  app.post('/billing/portal',async req=>{const d=authenticate(req);return exclusive(d.id,async()=>{await subscription(d.id);const customer=row(d.id).customer;if(!customer)throw Error('Sem assinatura.');const portal=await stripe('billing_portal/sessions',{customer,return_url:origin.origin+'/billing/success'});return {url:portal.url};});});
  app.get('/billing/success',async(_req,reply)=>reply.type('text/html; charset=utf-8').send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>LocalNeuron Pro</title><h1>Volte ao LocalNeuron</h1><p>Em Meu plano, clique em Atualizar assinatura. Nos 7 dias grátis, o Pro é liberado depois que a assinatura é confirmada. Fora do teste, o Pro é liberado após a confirmação do pagamento.</p></html>'));
  app.get('/billing/cancel',async(_req,reply)=>reply.type('text/html; charset=utf-8').send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>LocalNeuron</title><h1>Você pode continuar com o Grátis</h1><p>Volte ao LocalNeuron para conversar com suas IAs.</p></html>'));
  await app.register(async scope=>{
    scope.removeContentTypeParser('application/json');scope.addContentTypeParser('application/json',{parseAs:'buffer'},(_req,body,done)=>done(null,body));
    scope.post('/billing/webhook',async(req,reply)=>{
      const event=verifyWebhook(req.body as Buffer,String(req.headers['stripe-signature']??''),config.webhookSecret,now());
      if(db.prepare('SELECT id FROM events WHERE id=?').get(event.id))return {received:true};
      const object=event.data.object;
      const device=event.type==='checkout.session.completed'?object.client_reference_id:object.metadata?.device;
      const invoiceSub=object.parent?.subscription_details?.subscription;
      const lookup=typeof device==='string'?row(device):typeof invoiceSub==='string'?db.prepare('SELECT * FROM devices WHERE subscription=?').get(invoiceSub) as any:null;
      if(lookup&&['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'].includes(event.type))await exclusive(lookup.id,async()=>{await subscription(lookup.id);});
      db.prepare('INSERT OR IGNORE INTO events(id,processed) VALUES(?,?)').run(event.id,now());
      db.prepare('DELETE FROM events WHERE processed<?').run(now()-90*86400_000);
      return {received:true};
    });
  });
  return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const env=z.object({LOCALNEURON_BILLING_DB:z.string().min(1),STRIPE_SECRET_KEY:z.string().min(1),STRIPE_WEBHOOK_SECRET:z.string().min(1),STRIPE_MONTHLY_PRICE_ID:z.string().min(1),STRIPE_YEARLY_PRICE_ID:z.string().min(1),LOCALNEURON_LICENSE_PRIVATE_KEY_FILE:z.string().min(1),LOCALNEURON_BILLING_PUBLIC_URL:z.string().url(),LOCALNEURON_BILLING_HOST:z.enum(['127.0.0.1','0.0.0.0']).default('127.0.0.1')}).parse(process.env);
  const app=await createBillingService({database:env.LOCALNEURON_BILLING_DB,secretKey:env.STRIPE_SECRET_KEY,webhookSecret:env.STRIPE_WEBHOOK_SECRET,monthlyPriceId:env.STRIPE_MONTHLY_PRICE_ID,yearlyPriceId:env.STRIPE_YEARLY_PRICE_ID,privateKey:readFileSync(env.LOCALNEURON_LICENSE_PRIVATE_KEY_FILE,'utf8'),publicUrl:env.LOCALNEURON_BILLING_PUBLIC_URL});
  await app.listen({host:env.LOCALNEURON_BILLING_HOST,port:Number(process.env.LOCALNEURON_BILLING_PORT||4330)});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.close().then(()=>process.exit(0)));
}
