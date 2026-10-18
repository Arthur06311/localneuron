// Generate website/downloads.json and website/releases.json from one catalog.
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourcePath=resolve(root,'website/release-source.json');
const downloadsPath=resolve(root,'website/downloads.json');
const releasesPath=resolve(root,'website/releases.json');
const HOST='https://github.com/Arthur06311/localneuron/releases/download/';
const WORKFLOW_FILES={
 'LocalNeuron-Linux-x64.AppImage':{id:'linux',arch:'x64',format:'AppImage'},
 'LocalNeuron-Windows-x64-Setup.exe':{id:'windows',arch:'x64',format:'NSIS'},
};

function stable(value){return JSON.stringify(value,null,2)+'\n';}

function href(tag,filename){return `${HOST}${tag}/${filename}`;}

function readSource(path=sourcePath){
 const source=JSON.parse(readFileSync(path,'utf8'));
 if(!source||!Array.isArray(source.files))throw new Error('Catálogo de release inválido.');
 return source;
}

function feedFile(file){
 const item={id:file.id,arch:file.arch,filename:file.filename,bytes:file.bytes,sha256:file.sha256,available:file.available,href:href(file.releaseTag,file.filename),version:file.version,releaseTag:file.releaseTag};
 if(file.format)item.format=file.format;
 return item;
}

export function manifestsFromSource(source){
 const primaries=new Map();
 const downloads=[];
 for(const file of source.files){
  if(!file.releaseTag||!file.filename)throw new Error('Arquivo de release sem tag ou nome.');
  if(file.role==='alternative'){
   const primary=primaries.get(file.id);
   if(!primary)throw new Error(`Alternativa sem arquivo principal: ${file.filename}`);
   primary.alternatives??=[];
   primary.alternatives.push({filename:file.filename,bytes:file.bytes,sha256:file.sha256,available:file.available,version:file.version,releaseTag:file.releaseTag,href:href(file.releaseTag,file.filename),label:file.label});
   continue;
  }
  const card={id:file.id,filename:file.filename,bytes:file.bytes,sha256:file.sha256,available:file.available,href:href(file.releaseTag,file.filename),version:file.version,releaseTag:file.releaseTag};
  if(file.format)card.format=file.format;
  downloads.push(card);
  primaries.set(file.id,card);
 }
 return {
  downloads:{version:source.version,files:downloads},
  releases:{version:source.version,notes:source.notes,files:source.files.map(feedFile)},
 };
}

function readSums(path){
 const folder=dirname(resolve(path));
 const entries=[];
 for(const line of readFileSync(path,'utf8').split(/\r?\n/)){
  if(!line.trim())continue;
  const match=/^([a-f0-9]{64})  (\S+)$/.exec(line);
  if(!match)throw new Error('Linha inválida em SHA256SUMS.txt.');
  const filename=match[2];
  const file=resolve(folder,filename);
  const bytes=statSync(file).size;
  const digest=createHash('sha256').update(readFileSync(file)).digest('hex');
  if(digest!==match[1]||bytes===0)throw new Error(`SHA-256 não confere: ${filename}`);
  entries.push({filename,sha256:digest,bytes});
 }
 if(!entries.length)throw new Error('SHA256SUMS.txt está vazio.');
 return entries;
}

export function mergeWorkflowSums(source,{sums,tag,version,notes}){
 if(tag!==`v${version}`)throw new Error(`A tag ${tag} não bate com a versão ${version}.`);
 const summed=readSums(sums);
 const files=source.files.filter(file=>!summed.some(item=>item.filename===file.filename));
 for(const item of summed){
  const known=WORKFLOW_FILES[item.filename];
  if(!known)throw new Error(`Artefato fora do fluxo de release: ${item.filename}`);
  files.push({id:known.id,arch:known.arch,filename:item.filename,bytes:item.bytes,sha256:item.sha256,available:false,version,releaseTag:tag,format:known.format,role:'primary'});
 }
 return {...source,version,notes:notes??source.notes,files};
}

function parseArgs(argv){
 const args={check:false,sums:null,tag:null,version:null,notesFile:null,output:null};
 for(let index=0;index<argv.length;index+=1){
  const arg=argv[index];
  if(arg==='--check')args.check=true;
  else if(arg==='--sums')args.sums=argv[++index];
  else if(arg==='--tag')args.tag=argv[++index];
  else if(arg==='--version')args.version=argv[++index];
  else if(arg==='--notes-file')args.notesFile=argv[++index];
  else if(arg==='--output')args.output=argv[++index];
  else throw new Error(`Argumento desconhecido: ${arg}`);
 }
 return args;
}

function writeOrCheck(path,contents,check){
 if(!check){writeFileSync(path,contents);return;}
 const current=readFileSync(path,'utf8');
 if(current!==contents)throw new Error(`${path} não bate com website/release-source.json. Rode node scripts/build-release-manifest.mjs.`);
}

function main(){
 const args=parseArgs(process.argv.slice(2));
 const source=readSource();
 if(args.sums){
  if(!args.tag||!args.version||!args.output)throw new Error('Informe --tag, --version e --output junto com --sums.');
  const notes=args.notesFile?readFileSync(args.notesFile,'utf8').trim():source.notes;
  const merged=mergeWorkflowSums(source,{sums:args.sums,tag:args.tag,version:args.version,notes});
  writeFileSync(args.output,stable(manifestsFromSource(merged).releases));
  console.log(`Feed candidato gravado em ${args.output}. Os arquivos novos ficam com available false até a conferência.`);
  return;
 }
 const built=manifestsFromSource(source);
 writeOrCheck(downloadsPath,stable(built.downloads),args.check);
 writeOrCheck(releasesPath,stable(built.releases),args.check);
 console.log(args.check?'downloads.json e releases.json batem com o catálogo.':'Manifestos de release gerados a partir de website/release-source.json.');
}

const invokedDirectly=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invokedDirectly){
 try{main();}
 catch(error){console.error(error instanceof Error?error.message:error);process.exit(1);}
}
