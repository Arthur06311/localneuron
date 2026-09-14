// Read-only HF audit: pinned metadata and HEAD requests; never downloads model weights.
import {CATALOG,catalogFiles,modelUrl} from '../dist/src/catalog.js';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve(process.argv[2]||'docs/catalog-access.json');const cache=resolve(process.argv[3]||'.audit-cache');mkdirSync(cache,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,method='GET'){
 for(let attempt=0;attempt<4;attempt++){
  const response=await fetch(url,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'user-agent':'LocalNeuron-catalog-audit/0.15'}});
  if([429,502,503,504].includes(response.status)&&attempt<3){await response.body?.cancel();await sleep(Math.min(30,Number(response.headers.get('retry-after'))||2**(attempt+1))*1000);continue;}
  return response;
 }
}
async function inspect(m){
 const result={id:m.id,repo:m.repo,revision:m.revision,checked_at:new Date().toISOString(),access:'unknown',metadata_verified:false,files_total:catalogFiles(m).length,files_accessible:0,architecture:null,task:null};
 try{
  const key=createHash('sha256').update(m.repo+'@'+m.revision).digest('hex'),file=resolve(cache,key+'.json');let metadata;
  if(existsSync(file))metadata=JSON.parse(readFileSync(file,'utf8'));else{const r=await request(`https://huggingface.co/api/models/${m.repo}/revision/${m.revision}?blobs=true`);if(!r.ok){result.access=[401,403].includes(r.status)?'restricted':r.status===404?'missing':'unknown';result.http_status=r.status;await r.body?.cancel();return result;}metadata=await r.json();writeFileSync(file,JSON.stringify(metadata));}
  result.architecture=metadata.gguf?.architecture||metadata.config?.model_type||null;result.task=metadata.pipeline_tag||metadata.cardData?.pipeline_tag||null;
  const files=new Map((metadata.siblings||[]).map(f=>[f.rfilename,f]));
  if(metadata.sha!==m.revision)throw Error('revision_mismatch');
  for(const p of catalogFiles(m)){const f=files.get(p.path||p.file);if(!f||f.size!==p.bytes||f.lfs?.sha256!==p.sha256)throw Error('metadata_mismatch:'+p.file);}
  result.metadata_verified=true;
  for(const p of catalogFiles(m)){
   const url=modelUrl({...m,...p});const r=await request(url,'HEAD');const ok=r.ok||[301,302,303,307,308].includes(r.status)&&r.headers.has('location');
   if(!ok){result.access=[401,403].includes(r.status)?'restricted':r.status===404?'missing':'unknown';result.http_status=r.status;await r.body?.cancel();return result;}
   const size=Number(r.headers.get('x-linked-size')||r.headers.get('content-length'));const hash=(r.headers.get('x-linked-etag')||'').replaceAll('"','');
   if((hash&&hash!==p.sha256)||(Number.isFinite(size)&&size>0&&r.headers.has('x-linked-size')&&size!==p.bytes))throw Error('head_mismatch:'+p.file);
   result.files_accessible++;await r.body?.cancel();
  }
  result.access=metadata.gated?'restricted':'public';
 }catch(e){result.error=e.message;}
 return result;
}
const results=[];let next=0;
await Promise.all(Array.from({length:4},async()=>{for(;;){const i=next++;if(i>=CATALOG.length)return;const row=await inspect(CATALOG[i]);results.push(row);if(results.length%25===0)console.log(`${results.length}/${CATALOG.length}`,JSON.stringify(results.reduce((n,r)=>(n[r.access]=(n[r.access]||0)+1,n),{})));}}));
results.sort((a,b)=>a.id.localeCompare(b.id));const report={version:1,checked_at:new Date().toISOString(),method:'Pinned HF metadata + unauthenticated HEAD of every part at huggingface.co; redirects accepted as accessible source links; binaries not downloaded',total:results.length,summary:results.reduce((n,r)=>(n[r.access]=(n[r.access]||0)+1,n),{}),models:results};writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,total:report.total,summary:report.summary}));
