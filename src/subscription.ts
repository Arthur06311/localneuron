import { createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const premiumFeatures = {
  projects: 'Projetos, documentos e assistentes',
  jobs: 'Tarefas em lote e pesquisa com fontes',
  performance: 'Ajuste automático e perfis por modelo',
  studio: 'Ferramentas avançadas do Estúdio',
  api: 'Chaves individuais e fila da API',
} as const;
export type PremiumFeature = keyof typeof premiumFeatures;
export const leaseSchema = z.strictObject({
  version: z.literal(1), audience: z.literal('localneuron-pro'), device: z.string().uuid(),
  subscription: z.string().min(1).max(200), status: z.enum(['active','past_due','canceled']),
  issued_at: z.number().int().positive(), expires_at: z.number().int().positive(),
  period_end: z.number().int().positive(), cancel_at_period_end: z.boolean(),
});
export type Lease = z.infer<typeof leaseSchema>;
export type SubscriptionConfig = { publicKey?: string; serviceUrl?: string };
export class ProRequired extends Error {
  constructor(readonly feature: PremiumFeature) { super(`${premiumFeatures[feature]} faz parte da assinatura LocalNeuron Pro.`); }
}
export function verifyLease(token: string, publicKey: string, device: string): Lease {
  if (token.length > 8192) throw Error('Licença inválida.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !/^[\w-]+$/.test(payload+signature)) throw Error('Licença inválida.');
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519' || !verify(null, Buffer.from(payload), key, Buffer.from(signature,'base64url'))) throw Error('Assinatura da licença inválida.');
  const lease = leaseSchema.parse(JSON.parse(Buffer.from(payload,'base64url').toString('utf8')));
  if (lease.device !== device || (lease.status === 'active' && (lease.expires_at > lease.period_end || lease.expires_at <= lease.issued_at || lease.expires_at - lease.issued_at > 7*86400_000))) throw Error('Prazo ou dispositivo da licença inválido.');
  return lease;
}
export function subscriptionConfig(root: string): SubscriptionConfig {
  const path = join(root, 'subscription-config.json');
  const config = existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : {};
  return { publicKey: process.env.LOCALNEURON_LICENSE_PUBLIC_KEY || config.publicKey, serviceUrl: process.env.LOCALNEURON_BILLING_URL || config.serviceUrl };
}
export class Subscription {
  private file: string;
  private state: { device: string; secret: string; token?: string; last_seen: number; checked_at?: number };
  private lease?: Lease;
  private error = '';
  private refreshing?: Promise<unknown>;
  constructor(directory: string, private config: SubscriptionConfig = {}, private now = Date.now) {
    mkdirSync(directory,{recursive:true,mode:0o700}); this.file = join(directory,'subscription.json');
    this.state = {device:randomUUID(),secret:randomBytes(32).toString('hex'),last_seen:now()};
    if (existsSync(this.file)) {
      try { this.state = z.object({ device:z.string().uuid(),secret:z.string().regex(/^[a-f0-9]{64}$/),token:z.string().max(8192).optional(),last_seen:z.number().finite(),checked_at:z.number().finite().optional() }).parse(JSON.parse(readFileSync(this.file,'utf8'))); }
      catch { renameSync(this.file,this.file+'.invalid-'+randomUUID()); this.error='Os dados da assinatura precisam de recuperação. O arquivo anterior foi preservado; o Grátis continua disponível.'; }
    }
    if (this.state.token && config.publicKey) { try { this.lease = verifyLease(this.state.token,config.publicKey,this.state.device); } catch { this.error = 'Licença inválida. Atualize a assinatura.'; } }
    this.save();
  }
  private save() { writeFileSync(this.file+'.tmp',JSON.stringify(this.state),{mode:0o600}); renameSync(this.file+'.tmp',this.file); }
  snapshot() {
    const now = this.now(), rollback = now < this.state.last_seen - 300_000;
    if (now > this.state.last_seen + 60_000) { this.state.last_seen=now; this.save(); }
    const active = !rollback && Boolean(this.lease?.status==='active' && now >= this.lease.issued_at-300_000 && now < this.lease.expires_at);
    return {plan:active?'pro':'free',active,license_kind:this.lease?.subscription==='local-owner-test'?'test':'subscription',configured:Boolean(this.config.publicKey&&this.config.serviceUrl),device:this.state.device,status:rollback?'clock_error':active?(this.lease!.cancel_at_period_end?'canceling':'active'):this.lease?.status==='past_due'?'past_due':this.lease?.status==='canceled'?'canceled':this.lease?'expired':'free',period_end:this.lease?.period_end??null,offline_until:this.lease?.expires_at??null,checked_at:this.state.checked_at??null,error:rollback?'Confira a data e a hora do computador.':this.error,features:premiumFeatures};
  }
  get active() { return this.snapshot().active; }
  require(feature: PremiumFeature) { if (!this.active) throw new ProRequired(feature); }
  install(token: string) {
    if (!this.config.publicKey) throw Error('A verificação de assinaturas ainda não foi configurada nesta versão.');
    const lease = verifyLease(token,this.config.publicKey,this.state.device);
    if (lease.issued_at > this.now()+300_000 || lease.issued_at < (this.lease?.issued_at??0)) throw Error('Licença antiga ou com data futura.');
    this.lease=lease; this.state.token=token; this.state.checked_at=this.now(); this.error=''; this.save(); return this.snapshot();
  }
  private async request(path: string) {
    if (!this.config.serviceUrl || !this.config.publicKey) throw Error('Assinaturas em preparação. Nenhuma cobrança está habilitada.');
    const url=new URL(this.config.serviceUrl);
    if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw Error('Endereço de assinatura inválido.');
    const response=await fetch(new URL(path,url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json',authorization:'Bearer '+this.state.secret},body:JSON.stringify({device:this.state.device})});
    if(!response.ok) throw Error(response.status===429?'Aguarde um minuto e tente novamente.':'Não foi possível consultar sua assinatura. Tente novamente.');
    const text=await response.text(); if(text.length>16000)throw Error('Resposta de assinatura inválida.'); return JSON.parse(text);
  }
  async checkout() { return this.external('/billing/checkout','checkout.stripe.com'); }
  async portal() { return this.external('/billing/portal','billing.stripe.com'); }
  private async external(path: string, host: string) { const value=await this.request(path);const url=new URL(value.url);if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.port)throw Error('Endereço de pagamento inválido.');return {url:url.href}; }
  async refresh() {
    if(this.refreshing)return this.refreshing;
    this.refreshing=(async()=>{try{const value=await this.request('/billing/refresh');if(typeof value.token==='string')return this.install(value.token);if(value.status==='free'){this.lease=undefined;delete this.state.token;this.state.checked_at=this.now();this.error='';this.save();return this.snapshot();}throw Error('Resposta de assinatura inválida.');}catch(e){this.error=(e as Error).message;throw e;}finally{this.refreshing=undefined;}})();return this.refreshing;
  }
}

// Reading, editing/exporting existing work, cancellation, revocation and backups stay available.
export function requiredFeature(method: string, path: string, body?: unknown): PremiumFeature | undefined {
  if(method!=='POST')return;
  if(path==='/v1/pro/jobs'||path==='/v1/pro/queue'||path==='/v1/pro/jobs/:id/priority')return 'jobs';
  if(path==='/v1/pro/templates')return 'projects';
  if(['/v1/pro/assistants','/v1/pro/documents','/v1/pro/automations'].includes(path))return 'projects';
  if(path==='/v1/pro/projects' && !(body as {id?:unknown})?.id)return 'projects';
  if(/^\/v1\/chats\/[^/]+\/to-pro$/.test(path))return 'projects';
  if(path==='/v1/pro/profiles'||path==='/v1/pro/optimize')return 'performance';
  if(path==='/v1/sharing/keys'||path==='/v1/sharing/keys/:id')return 'api';
  if(['/v1/pro/media/speak','/v1/pro/media/inpaint','/v1/subscription/studio'].includes(path))return 'studio';
}
