import {readFileSync,existsSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {catalogFiles,modelUrl,type CatalogModel} from './catalog.js';
import {hfJSON} from './huggingface.js';
import {hfHeaders,hfError} from './hf-access.js';
import {LLAMA_ARCHITECTURES} from './engine-architectures.js';
import bundled from './catalog-access.json' with {type:'json'};
export type ModelAccess={id:string;revision:string;access:string;checked_at:string;metadata_verified:boolean;files_total:number;files_accessible:number;architecture:string|null;task:string|null;error?:string};
const nonChat=(model:CatalogModel)=>/(?:^|[-_/])(embed(?:ding)?s?|reranker)(?:[-_/]|$)/i.test(model.repo);
export function modelSupport(model:CatalogModel,check?:ModelAccess){const arch=model.architecture||check?.architecture;return {engine:'llama.cpp',architecture:arch||null,status:nonChat(model)?'unsupported':arch?LLAMA_ARCHITECTURES.has(arch)?'declared':'unsupported':'unknown',reason:nonChat(model)?'Modelo de embeddings ou classificação; não é um chat.':arch&&!LLAMA_ARCHITECTURES.has(arch)?'A arquitetura não está declarada pelo motor integrado desta versão.':arch?'Arquitetura declarada pelo motor. Execução e RAM ainda precisam de validação para este modelo.':'Arquitetura não confirmada. Confira o modelo antes de baixar.'};}
export class CatalogAccess {
 private file:string;private checks=new Map<string,ModelAccess>();private pending=new Map<string,Promise<ModelAccess>>();
 constructor(directory:string,private token:()=>string|undefined=()=>undefined){this.file=join(directory,'access-checks.json');for(const row of bundled.models)this.checks.set(row.id,row as ModelAccess);if(existsSync(this.file)){try{for(const row of JSON.parse(readFileSync(this.file,'utf8')).slice(0,4000))if(typeof row.id==='string'&&typeof row.revision==='string'&&typeof row.checked_at==='string')this.checks.set(row.id,row);}catch{/* Online checks can be repeated. */}}}
 get(model:CatalogModel){const row=this.checks.get(model.id);const check=row?.revision===model.revision?row:undefined;return {access:check?.access||(model.requires_auth?'restricted':'unknown'),checked_at:check?.checked_at||null,files_accessible:check?.files_accessible||0,files_total:catalogFiles(model).length,metadata_verified:check?.metadata_verified||false,error:check?.error,architecture:check?.architecture||model.architecture||null,support:modelSupport(model,check)};}
 summary(models:CatalogModel[]){return {checked_at:bundled.checked_at,total:models.length,public:models.filter(m=>this.get(m).access==='public').length,restricted:models.filter(m=>this.get(m).access==='restricted').length,unsupported:models.filter(m=>this.get(m).support.status==='unsupported').length,method:bundled.method};}
 async check(model:CatalogModel,signal?:AbortSignal):Promise<ModelAccess>{const previous=this.pending.get(model.id);if(previous)return previous;const p=this.inspect(model,signal).finally(()=>this.pending.delete(model.id));this.pending.set(model.id,p);return p;}
 private async inspect(model:CatalogModel,signal?:AbortSignal){
  const token=this.token(),row:ModelAccess={id:model.id,revision:model.revision,access:'unknown',checked_at:new Date().toISOString(),metadata_verified:false,files_total:catalogFiles(model).length,files_accessible:0,architecture:null,task:null};
  try{signal?.throwIfAborted();const {data:m}=await hfJSON('/'+model.repo+'/revision/'+model.revision+'?blobs=true',token);row.architecture=m.gguf?.architecture||null;row.task=m.pipeline_tag||m.cardData?.pipeline_tag||null;
   if(m.sha!==model.revision)throw Error('A revisão do modelo mudou. Atualize a ficha.');const files=new Map((m.siblings||[]).map((f:any)=>[f.rfilename,f]));
   for(const part of catalogFiles(model)){const file=files.get(part.path||part.file) as any;if(!file||file.size!==part.bytes||file.lfs?.sha256!==part.sha256)throw Error('Arquivo, tamanho ou hash mudou na origem. Atualize a ficha antes de baixar.');}row.metadata_verified=true;signal?.throwIfAborted();
   let next=0;const parts=catalogFiles(model);const results=await Promise.allSettled(Array.from({length:Math.min(3,parts.length)},async()=>{while(next<parts.length){signal?.throwIfAborted();const part=parts[next++],url=modelUrl(model,part);const r=await fetch(url,{method:'HEAD',redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:hfHeaders(url,token)});await r.body?.cancel();if(!(r.ok||[301,302,303,307,308].includes(r.status)&&r.headers.has('location'))){if([401,403].includes(r.status))row.access='restricted';else if(r.status===404)row.access='missing';throw Error(hfError(r.status));}row.files_accessible++;}}));const failure=results.find(r=>r.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
   row.access=m.gated?'authorized':'public';
  }catch(e){row.error=(e as Error).message;}
  this.checks.set(model.id,row);writeFileSync(this.file+'.tmp',JSON.stringify([...this.checks.values()]),{mode:0o600});renameSync(this.file+'.tmp',this.file);return row;
 }
}
