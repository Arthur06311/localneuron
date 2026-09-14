import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import type {Vault} from './vault.js';
export const hfTokenSchema=z.string().trim().regex(/^hf_[A-Za-z0-9]{20,200}$/,'Use um token de leitura do Hugging Face.');
export function hfHeaders(url:URL|string,token?:string):Record<string,string>{const u=new URL(url);return {'User-Agent':'LocalNeuron/0.15',...(token&&u.origin==='https://huggingface.co'?{Authorization:'Bearer '+token}:{})};}
export function hfError(status:number){return status===401?'O Hugging Face exige uma conta autorizada. Conecte um token de leitura em Acesso ao Hugging Face.':status===403?'Acesso ainda não autorizado. Aceite a licença e aguarde a aprovação na página oficial do modelo.':status===404?'O arquivo ou a revisão não está disponível no Hugging Face. Atualize a ficha do modelo.':status===429?'O Hugging Face limitou as consultas. Aguarde um pouco e tente novamente.':`Hugging Face indisponível (HTTP ${status}). Tente novamente.`;}
export class HFAccount {
 private file:string;private generation=0;
 constructor(directory:string,private vault:Vault,private fetcher=fetch){this.file=join(directory,'huggingface.enc.json');}
 private key(){return createHash('sha256').update(this.vault.key('service')).update('localneuron-hf-credentials-v1').digest();}
 private read():{token:string;name:string}|null{
  if(!existsSync(this.file))return null;
  const e=JSON.parse(readFileSync(this.file,'utf8'));const cipher=createDecipheriv('aes-256-gcm',this.key(),Buffer.from(e.iv,'hex'));cipher.setAuthTag(Buffer.from(e.tag,'hex'));return z.object({token:hfTokenSchema,name:z.string().max(120)}).parse(JSON.parse(Buffer.concat([cipher.update(Buffer.from(e.data,'base64')),cipher.final()]).toString('utf8')));
 }
 token(){return this.read()?.token;}
 status(){try{const value=this.read();return {connected:Boolean(value),name:value?.name??null};}catch{return {connected:false,name:null,error:'Reconecte sua conta do Hugging Face. A credencial não pôde ser aberta.'};}}
 async connect(value:unknown){
  const token=hfTokenSchema.parse(value),generation=++this.generation;this.key();const url='https://huggingface.co/api/whoami-v2';const response=await this.fetcher(url,{headers:hfHeaders(url,token),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(hfError(response.status));let size=0;const chunks:Uint8Array[]=[];if(!response.body)throw Error('Resposta da conta vazia.');for await(const chunk of response.body as any as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>128*1024)throw Error('Resposta da conta inválida.');chunks.push(chunk);}const text=Buffer.concat(chunks).toString();const profile=z.object({name:z.string().min(1).max(120)}).parse(JSON.parse(text));
  // Re-check the vault after the network call; locking during validation never saves a credential.
  if(generation!==this.generation)throw Error('Conexão cancelada ou substituída.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key(),iv),data=Buffer.concat([cipher.update(JSON.stringify({token,name:profile.name})),cipher.final()]);
  writeFileSync(this.file+'.tmp',JSON.stringify({version:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('base64')}),{mode:0o600});renameSync(this.file+'.tmp',this.file);return this.status();
 }
 disconnect(){this.generation++;rmSync(this.file,{force:true});return {connected:false,name:null};}
}
