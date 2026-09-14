import {testConfig, activateTestPro} from './subscription-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {validateWav} from '../src/aux-runtime.js';
import {prepareHFMetadata,validSavedModel,textModel} from '../src/huggingface.js';
import {complete,optionsSchema} from '../src/inference.js';
const {allowsMicrophone}=createRequire(import.meta.url)(resolve('desktop/permissions.cjs'));
test('Microfone somente áudio da janela local; câmera e origens externas recusadas',()=>{
 const origin='http://127.0.0.1:4318';assert.ok(allowsMicrophone('media',origin,origin,{mediaTypes:['audio']}));assert.ok(allowsMicrophone('media',origin,origin,{mediaType:'audio'}));
 for(const details of [{},{mediaTypes:['video']},{mediaTypes:['audio','video']},{mediaType:'audio',mediaTypes:['video']}])assert.equal(allowsMicrophone('media',origin,origin,details),false);
 assert.equal(allowsMicrophone('media','https://example.com',origin,{mediaType:'audio'}),false);assert.equal(allowsMicrophone('media',origin,'http://127.0.0.1:9999',{mediaType:'audio'}),false);
});
function wav(){const b=Buffer.alloc(32044);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
test('Transcrição rejeita WAV truncado, estéreo, amostragem errada e áudio excessivo',()=>{
 assert.equal(validateWav(wav()),1);for(const offset of [4,16,20,22,24,28,32,34,40]){const b=wav();b[offset]^=255;assert.throws(()=>validateWav(b));}assert.throws(()=>validateWav(wav().subarray(0,100)));assert.throws(()=>validateWav(Buffer.alloc(2880046)));
});
const metadata=()=>({id:'org/Qwen-GGUF',pipeline_tag:'text-generation',sha:'a'.repeat(40),gguf:{context_length:32768},cardData:{license:'apache-2.0'},siblings:[{rfilename:'Qwen-Q4_K_M.gguf',size:100,lfs:{sha256:'b'.repeat(64)}}]});
test('Hugging Face fixa revisão/hash e separa texto de difusão, acesso restrito e partes inválidas',()=>{
 const m=prepareHFMetadata('org/Qwen-GGUF',metadata());assert.equal(m.revision,'a'.repeat(40));assert.equal(m.parts?.length,1);assert.ok(validSavedModel(m));assert.equal(m.context_limit,32768);
 for(const broken of [{...metadata(),gated:'auto'},{...metadata(),pipeline_tag:'text-to-image'},{...metadata(),sha:'main'},{...metadata(),siblings:[{rfilename:'../Qwen-Q4_K_M.gguf',size:100,lfs:{sha256:'b'.repeat(64)}}]},{...metadata(),siblings:[{rfilename:'Qwen-Q4_K_M-00001-of-00002.gguf',size:100,lfs:{sha256:'b'.repeat(64)}}]}])assert.throws(()=>prepareHFMetadata('org/Qwen-GGUF',broken));
 assert.equal(textModel({gguf:{chat_template:'template',architecture:'flux'}}),false);assert.equal(validSavedModel({...m,bytes:101}),false);assert.equal(validSavedModel({...m,parts:[]}),false);assert.equal(validSavedModel({...m,parts:[{...m.parts![0],path:'../unsafe.gguf'}]}),false);
});
test('Esforço reserva espaço para resposta em contexto curto e desligado envia orçamento zero',async()=>{
 const original=globalThis.fetch;const sent:any[]=[];globalThis.fetch=async(_u,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response('data: '+JSON.stringify({choices:[{delta:{content:'Resposta'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');};
 const backend:any={integrated:true,nativeTools:true,endpoint:'http://127.0.0.1:9999',headers:{},status:async()=>({available:true,models:['test'],model_info:[{id:'test',context_length:2048}],available_memory_bytes:10*1024**3,pressure_free_percent:50})};
 try{for(const reasoning of ['off','low','medium','high'] as const)await complete('test',[{role:'user',content:'Olá'}],optionsSchema.parse({context:2048,max_tokens:1024,reasoning}),new AbortController().signal,()=>{},backend);assert.equal(sent[0].reasoning_budget,0);for(const request of sent.slice(1))assert.ok(request.reasoning_budget<=request.max_tokens/2);}finally{globalThis.fetch=original;}
});
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AuxRuntime} from '../src/aux-runtime.js';
import {Core} from '../src/core.js';
import {createApp} from '../src/server.js';
test('Encerrar motor cancela processo nativo e libera o slot',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-close-'));const aux=new AuxRuntime(dir,resolve('.'));try{const task=(aux as any).run(process.execPath,['-e','setInterval(()=>{},1000)'],60000);const rejected=assert.rejects(task,/cancelado/);assert.equal(aux.busy,true);await aux.close();await rejected;assert.equal(aux.busy,false);}finally{await aux.close();rmSync(dir,{recursive:true,force:true});}
});
test('Rotas de voz, modelos e mídia exigem sessão local e respeitam o bloqueio',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-http-'));const core=new Core(dir,resolve('.'));await core.init();await core.setup('senha-de-teste-neuron');const {app,subscription}=await createApp(core,'neuron-test-session',undefined,undefined,testConfig);activateTestPro(subscription);const headers={host:'127.0.0.1:4317',authorization:'Bearer neuron-test-session'};
 try{for(const url of ['/v1/huggingface/account','/v1/huggingface/brands','/v1/engines','/v1/local-engines','/v1/local-engines/gallery','/v1/local-engines/artifacts/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','/v1/huggingface','/v1/pro','/v1/pro/media','/v1/pro/backups','/v1/pro/diagnostics'])assert.equal((await app.inject({method:'GET',url,headers:{host:headers.host}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/v1/local-engines/download',headers:{...headers,origin:'https://example.com'},payload:{id:'whisper-tiny'}})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/local-engines/transcribe',headers,payload:{model:'whisper-tiny',audio:'YWJj'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/v1/local-engines/download',headers,payload:{id:'../../x'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/v1/huggingface/add',headers,payload:{repo:'https://example.com/x'}})).statusCode,400);
 for(const payload of [{model:'sd15',prompt:'test',seed:-1},{model:'sd15',prompt:'test',aspect:'bad'},{model:'sd15',prompt:'test',negative:'x'.repeat(2001)}])assert.equal((await app.inject({method:'POST',url:'/v1/local-engines/generate',headers,payload})).statusCode,400);
 assert.equal((await app.inject({method:'GET',url:'/v1/local-engines/gallery',headers})).statusCode,200);
 const project=await app.inject({method:'POST',url:'/v1/pro/projects',headers,payload:{name:'Projeto protegido'}});assert.equal(project.statusCode,200);
 assert.equal((await app.inject({method:'POST',url:'/v1/pro/projects',headers:{...headers,origin:'https://example.com'},payload:{name:'Invasor'}})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/pro/jobs',headers,payload:{project:project.json().id,prompt:'Pesquise',kind:'research',internet:false}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/v1/pro/media/inpaint',headers,payload:{prompt:'alterar',image:'YWJj',mask:'YWJj'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/v1/lock',headers,payload:{}})).statusCode,200);
 for(const url of ['/v1/pro','/v1/pro/media','/v1/pro/backups'])assert.equal((await app.inject({method:'GET',url,headers})).statusCode,423);
 assert.equal((await app.inject({method:'POST',url:'/v1/pro/projects',headers,payload:{name:'Bloqueado'}})).statusCode,423);
 assert.equal((await app.inject({method:'GET',url:'/v1/local-engines',headers})).statusCode,423);
 assert.equal((await app.inject({method:'GET',url:'/v1/local-engines/gallery',headers})).statusCode,423);
 }finally{await app.close();await core.close();rmSync(dir,{recursive:true,force:true});}
});
import {windowsRuntimeReady} from '../src/platform.js';
test('Windows identifica DLLs de runtime ausentes antes de iniciar motores',()=>{
 assert.equal(windowsRuntimeReady('darwin',()=>false),true);assert.equal(windowsRuntimeReady('win32',()=>false),false);assert.equal(windowsRuntimeReady('win32',p=>p.endsWith('msvcp140.dll')),false);assert.equal(windowsRuntimeReady('win32',()=>true),true);
});

import {voiceInput} from '../src/aux-runtime.js';
test('Voz prioriza português, rejeita silêncio e avisa sobre saturação',()=>{
 const silent=wav();assert.throws(()=>voiceInput(silent),/áudio suficiente/);
 const tone=wav();for(let i=44;i<tone.length;i+=2)tone.writeInt16LE(Math.round(4000*Math.sin(i/10)),i);
 assert.equal(voiceInput(tone).language,'pt');assert.equal(voiceInput(tone,'en').seconds,1);assert.deepEqual(voiceInput(tone).warnings,[]);assert.throws(()=>voiceInput(tone,'../../x'),/Idioma/);
 for(let i=44;i<tone.length;i+=2)tone.writeInt16LE(32767,i);assert.match(voiceInput(tone).warnings[0],/saturado/);
});
