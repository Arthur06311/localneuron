import {createPublicKey} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const config=JSON.parse(readFileSync(resolve('subscription-config.json'),'utf8'));
if(Object.keys(config).some(k=>!['serviceUrl','publicKey'].includes(k)))throw Error('subscription-config.json aceita apenas serviceUrl e publicKey; mantenha segredos fora do aplicativo.');
if(Boolean(config.serviceUrl)!==Boolean(config.publicKey))throw Error('Configure juntos o serviço de assinatura e a chave pública.');
if(config.publicKey){const key=createPublicKey(config.publicKey);if(key.asymmetricKeyType!=='ed25519'||config.publicKey.includes('PRIVATE KEY'))throw Error('Use somente uma chave pública Ed25519.');const url=new URL(config.serviceUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use a origem HTTPS do serviço de assinatura.');}
console.log(config.publicKey?'Configuração pública da assinatura válida.':'Cobrança desativada: versão sem configuração comercial.');
