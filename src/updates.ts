import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {arch,platform} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';

export const RELEASE_FEED='https://raw.githubusercontent.com/Arthur06311/localneuron/gh-pages/releases.json';
const DOWNLOAD_HOST='https://github.com/Arthur06311/localneuron/releases/download/';
const version=z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);

// Names produced by the release workflow, plus the installers already published.
export const RELEASE_ARTIFACTS=[
 {id:'mac',arch:'arm64',filename:'LocalNeuron-macOS-arm64.dmg'},
 {id:'mac',arch:'arm64',filename:'LocalNeuron-macOS-arm64.zip'},
 {id:'windows',arch:'x64',filename:'LocalNeuron-Windows-x64-Setup.exe'},
 {id:'windows',arch:'x64',filename:'LocalNeuron-Windows-x64.zip'},
 {id:'linux',arch:'x64',filename:'LocalNeuron-Linux-x64.AppImage'},
 {id:'linux',arch:'x64',filename:'LocalNeuron-Linux-x64.deb'},
 {id:'linux',arch:'x64',filename:'LocalNeuron-Linux-x64.pkg.tar.gz'},
 {id:'linux',arch:'x64',filename:'LocalNeuron-Linux-x64.tar.gz'},
] as const;

const PREFERENCE:Record<string,readonly string[]>={
 mac:['LocalNeuron-macOS-arm64.dmg','LocalNeuron-macOS-arm64.zip'],
 windows:['LocalNeuron-Windows-x64-Setup.exe','LocalNeuron-Windows-x64.zip'],
 linux:['LocalNeuron-Linux-x64.AppImage','LocalNeuron-Linux-x64.deb','LocalNeuron-Linux-x64.pkg.tar.gz','LocalNeuron-Linux-x64.tar.gz'],
};

export type ReleaseTarget={id:'mac'|'windows'|'linux';arch:'x64'|'arm64'};

export function currentTarget(hostPlatform=platform(),hostArch=arch()):ReleaseTarget|null{
 if(hostPlatform==='darwin'&&hostArch==='arm64')return {id:'mac',arch:'arm64'};
 if(hostPlatform==='win32'&&hostArch==='x64')return {id:'windows',arch:'x64'};
 if(hostPlatform==='linux'&&hostArch==='x64')return {id:'linux',arch:'x64'};
 return null;
}

export function newerVersion(candidate:string,current:string){const a=version.parse(candidate).split('.').map(Number),b=version.parse(current).split('.').map(Number);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}

const fileSchema=z.object({id:z.enum(['mac','windows','linux']),arch:z.enum(['x64','arm64']).optional(),filename:z.string().max(140),bytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/),available:z.boolean(),href:z.string(),version:version.optional(),releaseTag:z.string().max(80).optional(),format:z.string().max(80).optional()});
const manifestSchema=z.object({version,notes:z.string().max(3000).optional(),files:z.array(fileSchema).max(12)});

function acceptedTag(fileVersion:string,id:string,releaseTag:string){
 if(releaseTag===`v${fileVersion}`)return true;
 // Historical Linux tags such as v0.27.0-linux.3. Mac and Windows stay on vX.Y.Z.
 return id==='linux'&&new RegExp(`^v${fileVersion.replaceAll('.','\\.')}-linux\\.\\d+$`).test(releaseTag);
}

export function releaseManifest(input:unknown){
 const parsed=manifestSchema.parse(input);
 const files=parsed.files.map(file=>{
  const known=RELEASE_ARTIFACTS.find(item=>item.filename===file.filename);
  if(!known||known.id!==file.id)throw Error('Link de atualização não reconhecido.');
  const fileVersion=file.version??parsed.version;
  const releaseTag=file.releaseTag??`v${fileVersion}`;
  const fileArch=file.arch??known.arch;
  if(fileArch!==known.arch||!acceptedTag(fileVersion,file.id,releaseTag))throw Error('Link de atualização não reconhecido.');
  const href=`${DOWNLOAD_HOST}${releaseTag}/${file.filename}`;
  if(file.href!==href)throw Error('Link de atualização não reconhecido.');
  return {...file,arch:fileArch,version:fileVersion,releaseTag,href};
 });
 if(new Set(files.map(file=>file.filename)).size!==files.length)throw Error('Manifesto com plataformas duplicadas.');
 return {...parsed,files};
}
type Release=ReturnType<typeof releaseManifest>;
type ReleaseFile=Release['files'][number];

export function platformOffer(release:Release|null,target:ReleaseTarget|null){
 if(!release||!target)return null;
 const candidates=release.files.filter(file=>file.id===target.id&&file.arch===target.arch&&file.available);
 for(const name of PREFERENCE[target.id]??[]){const found=candidates.find(file=>file.filename===name);if(found)return found;}
 return null;
}

function publicOffer(file:ReleaseFile){return {id:file.id,arch:file.arch,filename:file.filename,version:file.version,releaseTag:file.releaseTag,href:file.href,sha256:file.sha256,bytes:file.bytes,available:file.available};}

export class Updates{
 private file:string;private checking:Promise<unknown>|null=null;
 private saved:{automatic:boolean;checked_at:number;dismissed:string;release:Release|null}={automatic:false,checked_at:0,dismissed:'',release:null};private error='';
 constructor(directory:string,readonly current:string,private fetcher:typeof fetch=fetch,private target:ReleaseTarget|null=currentTarget()){this.file=join(directory,'updates.json');version.parse(current);try{const stored=JSON.parse(readFileSync(this.file,'utf8'));let release:Release|null=null;if(stored.release){try{release=releaseManifest(stored.release);}catch{release=null;}}this.saved={automatic:typeof stored.automatic==='boolean'?stored.automatic:false,checked_at:Number.isFinite(stored.checked_at)?stored.checked_at:0,dismissed:typeof stored.dismissed==='string'?stored.dismissed:'',release};}catch{}}
 private save(){writeFileSync(this.file+'.tmp',JSON.stringify(this.saved),{mode:0o600});renameSync(this.file+'.tmp',this.file);}
 status(){const release=this.saved.release;const offer=platformOffer(release,this.target);const available=Boolean(offer&&newerVersion(offer.version,this.current));return {current:this.current,automatic:this.saved.automatic,checked_at:this.saved.checked_at,checking:Boolean(this.checking),error:this.error,available,dismissed:Boolean(offer&&offer.version===this.saved.dismissed),offer:offer?publicOffer(offer):null,release:release?{...release,url:`https://github.com/Arthur06311/localneuron/releases/tag/${offer?.releaseTag??'v'+release.version}`}:null};}
 preferences(input:unknown){const value=z.strictObject({automatic:z.boolean()}).parse(input);this.saved.automatic=value.automatic;this.save();return this.status();}
 dismiss(input:unknown){const requested=z.strictObject({version}).parse(input);const offer=platformOffer(this.saved.release,this.target);const known=new Set([this.saved.release?.version,offer?.version].filter((item):item is string=>Boolean(item)));if(!known.has(requested.version))throw Error('Versão não encontrada.');this.saved.dismissed=offer?.version??requested.version;this.save();return this.status();}
 async check(force=false){if(this.checking){await this.checking;return this.status();}if(!force&&(!this.saved.automatic||Date.now()-this.saved.checked_at<6*3600_000))return this.status();
  this.checking=(async()=>{try{const response=await this.fetcher(RELEASE_FEED,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{accept:'application/json','user-agent':'LocalNeuron'}});if(!response.ok)throw Error('Servidor de versões indisponível.');const reader=response.body?.getReader();if(!reader)throw Error('Resposta vazia.');let bytes=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>128*1024)throw Error('Manifesto maior que o permitido.');chunks.push(value);}}finally{await reader.cancel();}const release=releaseManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')));this.saved.release=release;this.error='';}catch{this.error='Não foi possível verificar atualizações. Verifique sua conexão.';}finally{this.saved.checked_at=Date.now();this.save();}})();try{await this.checking;}finally{this.checking=null;}return this.status();
 }
}
