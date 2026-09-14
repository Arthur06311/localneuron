import { cpus,platform,arch,totalmem } from 'node:os';
import { statfsSync } from 'node:fs';
import { memoryStatus } from './model.js';
import type { ModelLibrary } from './model-library.js';
import type { AuxRuntime } from './aux-runtime.js';
const GiB=1024**3;
export function hardware(directory:string){const disk=statfsSync(directory),memory=memoryStatus();return {platform:platform(),architecture:arch(),cpu:cpus()[0]?.model??'CPU',cores:cpus().length,total_memory_bytes:totalmem(),available_memory_bytes:memory.available_memory_bytes,disk_free_bytes:disk.bavail*disk.bsize,at:Date.now(),evidence:'estimated' as const};}
export async function recommendations(library:ModelLibrary,aux:AuxRuntime,directory:string,kind:'chat'|'image'|'video',objective=''){
 const machine=hardware(directory),limit=Math.max(0,machine.available_memory_bytes/GiB-1.5),disk=machine.disk_free_bytes;
 if(kind!=='chat')return {hardware:machine,kind,models:aux.snapshot().models.filter(m=>m.kind===kind&&m.available&&m.ram_gib<=limit&&(m.installed||m.bytes+GiB<disk)).sort((a,b)=>Number(b.installed)-Number(a.installed)||a.ram_gib-b.ram_gib).map(m=>({id:m.id,name:m.name,description:m.description,ram_gib:m.ram_gib,bytes:m.bytes,installed:m.installed,key:m.id,engine:'stable-diffusion.cpp',reason:m.installed?'Já instalado e compatível com o motor disponível.':'Perfil integrado compatível com a memória livre estimada.',limitation:kind==='video'?'Prévia experimental: 17 quadros, 256 × 256. Não gera um vídeo longo em uma única etapa.':m.requirement,evidence:'estimated',license:m.license}))};
 const snapshot=await library.snapshot();
 const candidates=snapshot.catalog.filter(m=>m.availability.support.status==='declared'&&['public','authorized'].includes(m.availability.access)&&m.ram_gib<=limit&&(m.local_key||m.bytes+GiB<disk));
 const score=(m:typeof candidates[number])=>Number(Boolean(m.local_key))*100+(objective&&new RegExp('código|codigo|program|code','i').test(objective)&&/coder|code/i.test(m.name)?30:0)-Math.abs(m.ram_gib-Math.min(8,limit*.55));
 candidates.sort((a,b)=>score(b)-score(a));
 const selected=candidates.slice(0,8);const fastest=[...candidates].sort((a,b)=>a.ram_gib-b.ram_gib)[0];if(fastest&&!selected.includes(fastest))selected.push(fastest);
 const extras=snapshot.installed.filter(m=>!selected.some(c=>c.local_key===m.key)&&m.size_bytes&&m.size_bytes*1.4/GiB+1.5<limit).slice(0,4).map(m=>({id:m.key,name:m.display_name||m.key,description:"Modelo já disponível neste computador.",ram_gib:Math.ceil((m.size_bytes||0)*1.4/GiB+1),bytes:m.size_bytes||0,key:m.key,installed:true,engine:m.format==='MLX'?'MLX':'llama.cpp',reason:"Já instalado. Use Testar velocidade para verificar a execução real.",limitation:"Estimativa pelo tamanho dos arquivos. A compatibilidade precisa ser confirmada pelo teste.",evidence:'estimated',license:'Consulte a ficha do modelo importado'}));
 return {hardware:machine,kind,models:[...extras,...selected.map(m=>({id:m.id,name:m.name,description:m.description,ram_gib:m.ram_gib,bytes:m.bytes,key:m.local_key,installed:Boolean(m.local_key),engine:'llama.cpp',reason:m===fastest?'Menor consumo estimado entre os candidatos.':m.local_key?'Já instalado; evita outro download.':'Arquitetura declarada pelo motor e memória livre estimada suficiente.',limitation:m.limitation,evidence:'estimated',license:m.license}))]};
}
