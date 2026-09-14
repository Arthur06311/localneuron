import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {HFAccount,hfHeaders} from '../src/hf-access.js';
import {Vault} from '../src/vault.js';
import {ggufVariants,prepareHFMetadata,textModel,validSavedModel} from '../src/huggingface.js';
import {downloadVerified,downloadParts} from '../src/model-library.js';
import {CATALOG} from '../src/catalog.js';
import {modelSupport} from '../src/catalog-access.js';
const token='hf_'+'a'.repeat(24),signal=()=>new AbortController().signal;
test('Credencial HF fica criptografada, exige cofre e não muda após validação falha',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hf-account-')),vault=new Vault(dir);vault.initialize('senha-fixture-segura');let fail=false;
 const account=new HFAccount(dir,vault,(async(url:any,init:any)=>{assert.equal(url,'https://huggingface.co/api/whoami-v2');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer '+token);return fail?new Response(null,{status:401}):Response.json({name:'fixture'});}) as any);
 try{assert.equal(account.status().connected,false);await account.connect(token);assert.equal(account.token(),token);assert.deepEqual(account.status(),{connected:true,name:'fixture'});assert.ok(!readFileSync(join(dir,'huggingface.enc.json'),'utf8').includes(token));fail=true;await assert.rejects(account.connect(token),/autorizada/);assert.equal(account.token(),token);vault.lock();assert.throws(()=>account.token());await assert.rejects(account.connect(token));vault.unlock('senha-fixture-segura');assert.equal(account.token(),token);account.disconnect();assert.equal(account.token(),undefined);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Bearer nunca vai para CDN, subdomínio ou porta diferente do Hugging Face',()=>{
 assert.equal(hfHeaders('https://huggingface.co/file',token).Authorization,'Bearer '+token);
 for(const url of ['https://cdn.hf.co/file','https://sub.huggingface.co/file','https://huggingface.co:444/file','https://example.com'])assert.equal(hfHeaders(url,token).Authorization,undefined);
});
const file=(name:string,size=10)=>({rfilename:name,size,lfs:{sha256:'b'.repeat(64)}});
const meta=()=>({id:'test/model',sha:'a'.repeat(40),pipeline_tag:'text-generation',gguf:{architecture:'qwen3'},cardData:{license:'apache-2.0'},siblings:[file('model-Q4_K_M.gguf'),file('model-Q8_0.gguf',20),file('BF16/model-BF16-00001-of-00002.gguf',100),file('BF16/model-BF16-00002-of-00002.gguf',100),file('mmproj-model-Q8_0.gguf'),file('dspark-model-Q4_K_M.gguf'),file('model-MTP-Q4_K_M.gguf')]});
test('Variantes completas Q4, Q8 e BF16 excluem projetores e modelos auxiliares',()=>{
 const m=meta(),variants=ggufVariants(m);assert.deepEqual(variants.map(v=>v.quantization),['Q4_K_M','Q8_0','BF16']);const bf=variants[2];assert.equal(bf.bytes,200);assert.equal(bf.files.length,2);
 const prepared=prepareHFMetadata(m.id,m,{variant:bf.id});assert.equal(prepared.bytes,200);assert.ok(validSavedModel(prepared));assert.equal(validSavedModel({...prepared,requires_auth:'yes'}),false);assert.equal(validSavedModel({...prepared,architecture:{}}),false);
 const gated={...m,gated:'manual'};assert.throws(()=>prepareHFMetadata(m.id,gated),/acesso/);assert.equal(prepareHFMetadata(m.id,gated,{allowGated:true}).requires_auth,true);assert.throws(()=>prepareHFMetadata(m.id,{...m,private:true},{allowGated:true}));
 m.siblings=m.siblings.filter(f=>!f.rfilename.includes('00002'));assert.ok(!ggufVariants(m).some(v=>v.quantization==='BF16'));
 assert.equal(textModel({...meta(),pipeline_tag:'any-to-any',gguf:{architecture:'gemma4'}}),true);assert.equal(textModel({...meta(),id:'org/nomic-embed-code'}),false);
 assert.equal(modelSupport({...CATALOG[0],architecture:'imaginary-engine'}).status,'unsupported');
});
const payload=Buffer.from('GGUF downloaded content'),fixture={...CATALOG[0],parts:undefined,bytes:payload.length,sha256:createHash('sha256').update(payload).digest('hex')};
test('Retomada preserva prefixo, remove bearer no redirecionamento e verifica SHA final',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hf-resume-')),path=join(dir,'model');writeFileSync(path,payload.subarray(0,5));let calls=0;
 try{await downloadVerified(fixture,path,signal(),()=>{},(async(url:any,init:any)=>{assert.equal(init.headers.Range,'bytes=5-');if(++calls===1){assert.equal(init.headers.Authorization,'Bearer '+token);return new Response(null,{status:302,headers:{location:'https://cdn.hf.co/model'}});}assert.equal(init.headers.Authorization,undefined);return new Response(payload.subarray(5),{status:206,headers:{'content-range':`bytes 5-${payload.length-1}/${payload.length}`}});}) as any,{resume:true,token});assert.equal(calls,2);assert.deepEqual(readFileSync(path),payload);
 await downloadVerified(fixture,path,signal(),()=>{},(async()=>{throw Error('Não deveria baixar de novo');}) as any,{resume:true});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Servidor que ignora Range reinicia; intervalo inválido e hash adulterado são recusados',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hf-range-')),path=join(dir,'model');
 try{writeFileSync(path,payload.subarray(0,5));await downloadVerified(fixture,path,signal(),()=>{},(async()=>new Response(payload)) as any,{resume:true});assert.deepEqual(readFileSync(path),payload);
 writeFileSync(path,payload.subarray(0,5));await assert.rejects(downloadVerified(fixture,path,signal(),()=>{},(async()=>new Response(payload.subarray(5),{status:206,headers:{'content-range':'bytes 0-2/3'}})) as any,{resume:true}),/Intervalo/);assert.equal(readFileSync(path).length,5);
 await assert.rejects(downloadVerified({...fixture,sha256:'0'.repeat(64)},path,signal(),()=>{},(async()=>new Response(payload)) as any,{resume:true}),/SHA-256/);assert.equal(existsSync(path),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Retomada multipart não repete partes completas',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hf-parts-')),parts=[{file:'part1.gguf',bytes:payload.length,sha256:fixture.sha256},{file:'part2.gguf',bytes:payload.length,sha256:fixture.sha256}];writeFileSync(join(dir,parts[0].file),payload);let calls=0;
 try{await downloadParts({...fixture,parts,bytes:payload.length*2},dir,signal(),()=>{},(async()=>{calls++;return new Response(payload);}) as any,{resume:true});assert.equal(calls,1);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Desconectar durante a validação impede que a credencial reapareça',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hf-disconnect-')),vault=new Vault(dir);vault.initialize('senha-fixture-segura');let respond!:(r:Response)=>void;const account=new HFAccount(dir,vault,(()=>new Promise(r=>{respond=r;})) as any);
 try{const pending=account.connect(token);account.disconnect();respond(Response.json({name:'fixture'}));await assert.rejects(pending,/cancelada/);assert.equal(account.status().connected,false);assert.ok(!existsSync(join(dir,'huggingface.enc.json')));}finally{rmSync(dir,{recursive:true,force:true});}
});
import {Core} from '../src/core.js';
import {createApp} from '../src/server.js';
import {resolve} from 'node:path';
test('Conta e motores são gratuitos, exigem sessão e respeitam o cofre bloqueado',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hf-http-')),core=new Core(dir,resolve('.'));await core.init();await core.setup('senha-fixture-segura');const {app}=await createApp(core,'hf-fixture-session');const headers={host:'127.0.0.1:4317',authorization:'Bearer hf-fixture-session'};
 try{assert.deepEqual((await app.inject({method:'GET',url:'/v1/huggingface/account',headers})).json(),{connected:false,name:null});const r=await app.inject({method:'GET',url:'/v1/engines',headers});assert.equal(r.statusCode,200);assert.equal(r.json().engines.length,6);assert.equal((await app.inject({method:'POST',url:'/v1/huggingface/account',headers,payload:{token:'bad'}})).statusCode,400);assert.equal((await app.inject({method:'DELETE',url:'/v1/huggingface/account',headers:{host:headers.host}})).statusCode,401);await app.inject({method:'POST',url:'/v1/lock',headers,payload:{}});for(const url of ['/v1/huggingface/account','/v1/engines','/v1/exo','/v1/huggingface/brands'])assert.equal((await app.inject({method:'GET',url,headers})).statusCode,423);assert.equal((await app.inject({method:'POST',url:'/v1/model-library/check',headers,payload:{id:CATALOG[0].id}})).statusCode,423);}finally{await app.close();await core.close();rmSync(dir,{recursive:true,force:true});}
});
