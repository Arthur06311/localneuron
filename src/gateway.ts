import Fastify, { type FastifyInstance } from 'fastify';
import { createHash, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { z } from 'zod';
import { complete, optionsSchema, type Message, type GenerationOptions, type Generation } from './inference.js';
export function networkAddresses() {
  return Object.entries(networkInterfaces()).flatMap(([name,values])=>(values||[]).filter(v=>v.family==='IPv4'&&!v.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(v.address)).map(v=>({name,address:v.address})));
}
const digest=(key:string)=>createHash('sha256').update(key).digest('hex');
const requestSchema=z.strictObject({model:z.string().min(1).max(512),messages:z.array(z.strictObject({role:z.enum(['system','user','assistant']),content:z.string().max(131072)})).min(1).max(1000),stream:z.boolean().default(false),max_tokens:z.number().int().min(1).max(32768).optional(),max_completion_tokens:z.number().int().min(1).max(32768).optional(),temperature:z.number().min(0).max(2).optional(),top_p:z.number().min(.01).max(1).optional(),reasoning_effort:z.enum(['none','low','medium','high']).optional(),stream_options:z.strictObject({include_usage:z.boolean()}).optional()});
type Runner=(model:string,messages:Message[],options:GenerationOptions,signal:AbortSignal,delta:(text:string,phase?:string)=>void)=>Promise<Generation>;
export class Gateway {
  server:FastifyInstance|null=null; private keyHash='';private keyPrefix='';private model='';private host='';private closing=false;
  private controllers=new Set<AbortController>();private pending=new Set<Promise<unknown>>();
  private keys:{id:string;name:string;hash:string;prefix:string;daily:number;max_tokens:number;used:number;day:string;paused?:boolean}[]=[];private queued=0;private reserved=false;
  private config:GenerationOptions=optionsSchema.parse({});private file:string;
  stats={requests:0,errors:0,last_request_at:0};
  constructor(directory:string,private canRun:()=>boolean,private runner:Runner=complete,private port=4320,private root=process.cwd(),private hasPro=()=>true){
    mkdirSync(directory,{recursive:true,mode:0o700});this.file=join(directory,'sharing.json');
    try{const saved=JSON.parse(readFileSync(this.file,'utf8'));if(/^[a-f0-9]{64}$/.test(saved.key_hash)){this.keyHash=saved.key_hash;this.keyPrefix=saved.prefix;}if(Array.isArray(saved.keys))this.keys=saved.keys.filter((v:any)=>typeof v.hash==='string'&&/^[a-f0-9]{64}$/.test(v.hash)&&Number.isInteger(v.daily)&&v.daily>0).slice(0,100);}catch{}
  }
  get busy(){return this.controllers.size>0;}
  status(){return {enabled:Boolean(this.server)&&!this.closing,busy:this.busy,has_key:Boolean(this.keyHash),key_prefix:this.keyPrefix,base_url:this.server?`http://${this.host}:${this.port}/v1`:null,model:'local',local_model:this.model,addresses:networkAddresses(),port:this.port,stats:this.stats,keys:this.keys.map(({hash,...v})=>({...v,used:v.day===new Date().toISOString().slice(0,10)?v.used:0})),queued:this.queued,remote_url:this.server?`http://${this.host}:${this.port}/remote`:null};}
  private saveKeys(){writeFileSync(this.file+'.tmp',JSON.stringify({key_hash:this.keyHash,prefix:this.keyPrefix,keys:this.keys}),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
  addKey(value:unknown){const v=z.object({name:z.string().trim().min(1).max(80),daily:z.number().int().min(1).max(100000),max_tokens:z.number().int().min(128).max(32768)}).parse(value);if(this.keys.length>=100)throw Error('Limite de 100 chaves.');const key='lnp_'+randomBytes(32).toString('base64url');this.keys.push({...v,id:randomUUID(),hash:digest(key),prefix:key.slice(0,10)+'…',used:0,day:new Date().toISOString().slice(0,10)});this.saveKeys();return {key};}
  updateKey(id:string,value:unknown){const v=z.strictObject({name:z.string().trim().min(1).max(80),daily:z.number().int().min(1).max(100000),max_tokens:z.number().int().min(128).max(32768),paused:z.boolean()}).parse(value);const key=this.keys.find(k=>k.id===id);if(!key)throw Error('Chave não encontrada.');Object.assign(key,v);this.saveKeys();return {ok:true};}
  async removeKey(id:string){await this.stop();this.keys=this.keys.filter(k=>k.id!==id);this.saveKeys();return {ok:true};}
  private async slot(disconnected:()=>boolean){if(this.queued>=20)throw Error('Fila cheia. Tente novamente.');this.queued++;const deadline=Date.now()+30000;try{while(true){if(this.closing||disconnected())throw Error('Chamada cancelada.');if(!this.busy&&!this.reserved&&this.canRun()){this.reserved=true;return;}if(Date.now()>deadline)throw Error('Tempo na fila excedido.');await new Promise(r=>setTimeout(r,50));}}finally{this.queued--;}}
  async rotate(){await this.stop();const key='clm_'+randomBytes(32).toString('base64url');this.keyHash=digest(key);this.keyPrefix=key.slice(0,10)+'…';this.saveKeys();return {key};}
  async revoke(){await this.stop();this.keyHash='';this.keyPrefix='';this.keys=[];this.saveKeys();return {ok:true};}
  async start(host:string,model:string,options:GenerationOptions){
    if(this.server)throw new Error('Desligue a API antes de mudar o computador ou modelo.');
    if(!this.keyHash&&!this.keys.length)throw new Error('Gere uma chave de API primeiro.');
    if(host!=='127.0.0.1'&&!networkAddresses().some(v=>v.address===host))throw new Error('Escolha um endereço da rede privada deste computador.');
    this.host=host;this.model=model;this.config=options;this.closing=false;
    const app=Fastify({logger:false,bodyLimit:1024*1024,requestTimeout:30000});
    const failures=new Map<string,{at:number,count:number}>();
    app.addHook('onRequest',async(req,reply)=>{
      reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      if(req.method==='GET'&&['/remote','/remote.js','/remote.css'].includes(req.url))return;
      if(this.closing)return reply.code(503).send({error:{message:'API desligando.',type:'unavailable'}});
      // No cookies or dashboard session accepted; only the independently revocable API key.
      const key=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/)?.[1]||'';
      const incoming=Buffer.from(digest(key));const record=this.keys.find(k=>timingSafeEqual(Buffer.from(k.hash),incoming));(req as any).proKey=record;const expected=Buffer.from(this.keyHash);
      if(!key||(!record&&(incoming.length!==expected.length||!timingSafeEqual(incoming,expected)))){
        const now=Date.now(),previous=failures.get(req.ip);const entry=previous&&now-previous.at<60000?previous:{at:now,count:0};entry.count++;if(failures.size>1000)failures.clear();failures.set(req.ip,entry);
        return reply.code(entry.count>30?429:401).send({error:{message:'Chave de API inválida.',type:'authentication_error'}});
      }
      if(req.headers.origin&&req.headers.origin!==`http://${this.host}:${this.port}`)return reply.code(403).send({error:{message:'Use a API no cliente ou backend do seu aplicativo; acesso direto pelo navegador não está habilitado.',type:'origin_error'}});
    });
    app.setErrorHandler((error,_request,reply)=>reply.code(400).send({error:{message:error instanceof z.ZodError?'Parâmetros inválidos ou não suportados. Aceita apenas mensagens de texto.':(error as Error).message,type:'invalid_request_error'}}));
    app.get('/v1/models',async()=>({object:'list',data:[{id:'local',object:'model',created:0,owned_by:'colmeia'}]}));
    app.post('/v1/chat/completions',async(req,reply)=>{
      const input=requestSchema.parse(req.body);if(input.model!=='local'&&input.model!==this.model)return reply.code(404).send({error:{message:'Use o modelo local informado pela página Minha API.',type:'model_not_found'}});
      const proKey=(req as any).proKey;if(proKey?.paused)return reply.code(403).send({error:{message:'Esta chave está pausada.'}});if(proKey&&!this.hasPro())return reply.code(402).send({error:{message:'A assinatura Pro deste servidor está inativa. Use a chave básica ou atualize a assinatura.'}});if(proKey){const day=new Date().toISOString().slice(0,10);if(proKey.day!==day){proKey.day=day;proKey.used=0;}if(proKey.used>=proKey.daily)return reply.code(429).send({error:{message:'Cota diária desta chave atingida.'}});}
      if(!proKey&&(this.busy||this.reserved||!this.canRun()))return reply.code(503).header('Retry-After','3').send({error:{message:'A IA está ocupada ou o aplicativo está bloqueado. Tente novamente em instantes.',type:'model_busy'}});
      if(!input.messages.some(m=>m.role==='user'))throw new Error('Envie pelo menos uma mensagem de usuário.');
      if(proKey){await this.slot(()=>reply.raw.destroyed);if(!this.hasPro()){this.reserved=false;return reply.code(402).send({error:{message:'Assinatura Pro inativa.'}});}if(proKey.paused||proKey.used>=proKey.daily||!this.keys.some(k=>k.id===proKey.id)){this.reserved=false;return reply.code(429).send({error:{message:'Cota diária atingida ou chave revogada.'}});}}
      const controller=new AbortController();this.controllers.add(controller);this.reserved=false;if(proKey){proKey.used++;this.saveKeys();}this.stats.requests++;this.stats.last_request_at=Date.now();
      const id='chatcmpl-'+randomUUID(),created=Math.floor(Date.now()/1000);let sent='',streamStarted=false;
      const emit=(data:unknown)=>{if(!reply.raw.destroyed)reply.raw.write('data: '+JSON.stringify(data)+'\n\n');};
      const begin=()=>{if(streamStarted)return;streamStarted=true;reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});emit({id,object:'chat.completion.chunk',created,model:'local',choices:[{index:0,delta:{role:'assistant'},finish_reason:null}]});};
      const disconnected=()=>{if(!reply.raw.writableEnded)controller.abort();};reply.raw.on('close',disconnected);
      const options=optionsSchema.parse({...this.config,max_tokens:Math.min(input.max_completion_tokens??input.max_tokens??this.config.max_tokens,proKey?.max_tokens??32768),temperature:input.temperature??this.config.temperature,top_p:input.top_p??this.config.top_p,reasoning:input.reasoning_effort==='none'?'off':input.reasoning_effort??this.config.reasoning});
      const run=(async()=>{
        try{
          const result=await this.runner(this.model,input.messages,options,controller.signal,text=>{if(!input.stream)return;begin();const addition=text.slice(sent.length);sent=text;if(addition)emit({id,object:'chat.completion.chunk',created,model:'local',choices:[{index:0,delta:{content:addition},finish_reason:null}]});});
          const usage=Number.isFinite(result.prompt_tokens)&&Number.isFinite(result.completion_tokens)?{prompt_tokens:result.prompt_tokens!,completion_tokens:result.completion_tokens!,total_tokens:result.prompt_tokens!+result.completion_tokens!}:undefined;
          if(input.stream){begin();if(result.text.length>sent.length)emit({id,object:'chat.completion.chunk',created,model:'local',choices:[{index:0,delta:{content:result.text.slice(sent.length)},finish_reason:null}]});emit({id,object:'chat.completion.chunk',created,model:'local',choices:[{index:0,delta:{},finish_reason:result.finish_reason}]});if(input.stream_options?.include_usage&&usage)emit({id,object:'chat.completion.chunk',created,model:'local',choices:[],usage});reply.raw.end('data: [DONE]\n\n');}
          else return reply.send({id,object:'chat.completion',created,model:'local',choices:[{index:0,message:{role:'assistant',content:result.text},finish_reason:result.finish_reason}],usage});
        }catch(error){this.stats.errors++;const message=controller.signal.aborted?'Requisição interrompida.':(error as Error).message;if(streamStarted){emit({error:{message,type:'generation_error'}});reply.raw.end();}else if(!reply.raw.destroyed)return reply.code(502).send({error:{message,type:'generation_error'}});}
        finally{reply.raw.off('close',disconnected);this.controllers.delete(controller);}
      })();
      this.pending.add(run);try{await run;}finally{this.pending.delete(run);}return reply;
    });
    app.get('/remote',async(_req,reply)=>reply.type('text/html').send(readFileSync(join(this.root,'public/remote.html'))));
    app.get('/remote.js',async(_req,reply)=>reply.type('application/javascript').send(readFileSync(join(this.root,'public/remote.js'))));
    app.get('/remote.css',async(_req,reply)=>reply.type('text/css').send(readFileSync(join(this.root,'public/remote.css'))));
    this.server=app;
    try{await app.listen({host,port:this.port});const address=app.server.address();if(address&&typeof address==='object')this.port=address.port;return this.status();}
    catch(error){this.server=null;await app.close().catch(()=>{});throw error;}
  }
  async stop(){this.closing=true;for(const controller of this.controllers)controller.abort();await Promise.allSettled([...this.pending]);const app=this.server;this.server=null;if(app)await app.close();this.closing=false;return {ok:true};}
}
