import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
export const RELEASE_FEED='https://raw.githubusercontent.com/Arthur06311/localneuron/gh-pages/releases.json';
const version=z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);
export function newerVersion(candidate:string,current:string){const a=version.parse(candidate).split('.').map(Number),b=version.parse(current).split('.').map(Number);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
const manifestSchema=z.object({version,notes:z.string().max(3000).optional(),files:z.array(z.object({id:z.enum(['mac','windows','linux']),filename:z.string().max(100),bytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/),available:z.boolean(),href:z.string()})).max(3)});
export function releaseManifest(input:unknown){const r=manifestSchema.parse(input);const names={mac:'LocalNeuron-macOS-arm64.dmg',windows:'LocalNeuron-Windows-x64.zip',linux:'LocalNeuron-Linux-x64.tar.gz'};if(new Set(r.files.map(f=>f.id)).size!==r.files.length)throw Error('Manifesto com plataformas duplicadas.');for(const f of r.files){if(f.filename!==names[f.id]||f.href!==`https://github.com/Arthur06311/localneuron/releases/download/v${r.version}/${f.filename}`)throw Error('Link de atualização não reconhecido.');}return r;}
type Release=ReturnType<typeof releaseManifest>;
export class Updates{
 private file:string;private checking:Promise<unknown>|null=null;
 private saved:{automatic:boolean;checked_at:number;dismissed:string;release:Release|null}={automatic:true,checked_at:0,dismissed:'',release:null};private error='';
 constructor(directory:string,readonly current:string,private fetcher:typeof fetch=fetch){this.file=join(directory,'updates.json');version.parse(current);try{const v=JSON.parse(readFileSync(this.file,'utf8'));this.saved={automatic:typeof v.automatic==='boolean'?v.automatic:true,checked_at:Number.isFinite(v.checked_at)?v.checked_at:0,dismissed:typeof v.dismissed==='string'?v.dismissed:'',release:v.release?releaseManifest(v.release):null};}catch{}}
 private save(){writeFileSync(this.file+'.tmp',JSON.stringify(this.saved),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 status(){const r=this.saved.release;return {current:this.current,automatic:this.saved.automatic,checked_at:this.saved.checked_at,checking:Boolean(this.checking),error:this.error,available:Boolean(r&&newerVersion(r.version,this.current)&&r.files.some(f=>f.available)),dismissed:Boolean(r&&r.version===this.saved.dismissed),release:r?{...r,url:`https://github.com/Arthur06311/localneuron/releases/tag/v${r.version}`}:null};}
 preferences(input:unknown){const v=z.strictObject({automatic:z.boolean()}).parse(input);this.saved.automatic=v.automatic;this.save();return this.status();}
 dismiss(input:unknown){const v=z.strictObject({version}).parse(input);if(v.version!==this.saved.release?.version)throw Error('Versão não encontrada.');this.saved.dismissed=v.version;this.save();return this.status();}
 async check(force=false){if(this.checking){await this.checking;return this.status();}if(!force&&(!this.saved.automatic||Date.now()-this.saved.checked_at<6*3600_000))return this.status();
  this.checking=(async()=>{try{const response=await this.fetcher(RELEASE_FEED,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});if(!response.ok)throw Error('Servidor de versões indisponível.');const reader=response.body?.getReader();if(!reader)throw Error('Resposta vazia.');let bytes=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>128*1024)throw Error('Manifesto maior que o permitido.');chunks.push(value);}}finally{await reader.cancel();}const release=releaseManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')));this.saved.release=release;this.error='';}catch{this.error='Não foi possível consultar versões. Você pode continuar usando o app offline e tentar novamente.';}finally{this.saved.checked_at=Date.now();this.save();}})();try{await this.checking;}finally{this.checking=null;}return this.status();
 }
}
