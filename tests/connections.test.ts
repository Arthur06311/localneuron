import test from 'node:test';import assert from 'node:assert/strict';import{mkdtempSync,readFileSync,rmSync,writeFileSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{createServer,type Server}from'node:http';import{createServer as createHttps}from'node:https';import{execFileSync}from'node:child_process';import{createDecipheriv,createHash}from'node:crypto';import{Vault}from'../src/vault.js';import{Connections,decideOAuthOrigin}from'../src/connections.js';
test('MCP local negocia protocolo, cifra credenciais e respeita revogação',async()=>{const dir=mkdtempSync(join(tmpdir(),'neuron-mcp-')),vault=new Vault(dir);vault.initialize('senha-de-testes-mcp');const file=join(dir,'server.mjs');const sdk=resolve('node_modules/@modelcontextprotocol/sdk/dist/esm');writeFileSync(file,`import {McpServer} from ${JSON.stringify('file://'+sdk+'/server/mcp.js')};import {StdioServerTransport} from ${JSON.stringify('file://'+sdk+'/server/stdio.js')};const s=new McpServer({name:'fixture',version:'1'});s.registerTool('hello',{description:'Teste local',annotations:{readOnlyHint:true}},async()=>({content:[{type:'text',text:'Olá do servidor MCP'}]}));await s.connect(new StdioServerTransport());`);const c=new Connections(dir,vault);try{const row=await c.add({name:'Fixture',command:process.execPath,args:[file],token:'credencial-ficticia-secreta'});assert.equal(row?.connected,true);assert.equal(row?.tools.length,1);assert.ok(!readFileSync(join(dir,'connections.enc.json'),'utf8').includes('credencial-ficticia'));const defs=c.definitions([row!.id],true);assert.equal(defs.length,1);assert.equal(c.definitions([],false).length,0);const result=await c.call(defs[0].function.name,{},[row!.id],new AbortController().signal);assert.match(JSON.stringify(result),/Olá do servidor/);await c.remove(row!.id);await assert.rejects(c.call(defs[0].function.name,{},[row!.id],new AbortController().signal),/revogada/);vault.lock();assert.throws(()=>c.list(),/Cofre/);}finally{await c.close();rmSync(dir,{recursive:true,force:true});}});

test('decideOAuthOrigin permite a origem MCP e a origem fixada e recusa troca',()=>{
 const mcp='http://127.0.0.1:4317/mcp';
 assert.deepEqual(decideOAuthOrigin(new URL('http://127.0.0.1:4317/.well-known/oauth-authorization-server'),mcp),{});
 assert.deepEqual(decideOAuthOrigin(new URL('https://auth.example/authorize'),mcp),{pin:'https://auth.example'});
 assert.deepEqual(decideOAuthOrigin(new URL('https://auth.example/token'),mcp,'https://auth.example'),{});
 assert.deepEqual(decideOAuthOrigin(new URL('https://auth.example:443/token'),mcp,'https://auth.example'),{});
 assert.throws(()=>decideOAuthOrigin(new URL('https://outro.example/token'),mcp,'https://auth.example'),/Origem de autorização alterada \(outro\.example\)\./);
 assert.throws(()=>decideOAuthOrigin(new URL('http://outro.example/token'),mcp),/Origem MCP recusada/);
 assert.throws(()=>decideOAuthOrigin(new URL('https://user:segredo@auth.example/token'),mcp),/Origem MCP recusada/);
 assert.throws(()=>decideOAuthOrigin(new URL('https://evil.example/authorize'),mcp,'http://127.0.0.1:4317'),/Origem de autorização alterada/);
});

function listen(server:Server){return new Promise<number>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')reject(Error('sem porta'));else resolve(address.port);});});}
function stop(server:Server){return new Promise<void>(resolve=>server.close(()=>resolve()));}
function portOf(server:Server){const address=server.address();if(!address||typeof address==='string')throw Error('sem porta');return address.port;}
function storedAuth(dir:string,vault:Vault){const key=createHash('sha256').update(vault.key('service')).update('localneuron-mcp-v1').digest(),v=JSON.parse(readFileSync(join(dir,'connections.enc.json'),'utf8')),d=createDecipheriv('aes-256-gcm',key,Buffer.from(v.iv,'hex'));d.setAuthTag(Buffer.from(v.tag,'hex'));return JSON.parse(Buffer.concat([d.update(Buffer.from(v.data,'base64')),d.final()]).toString())[0].auth as {client?:{issuer?:string}}; }
function metadata(base:string,authorize=base+'/authorize'){return {issuer:base,authorization_endpoint:authorize,token_endpoint:base+'/token',registration_endpoint:base+'/register',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']};}
function registration(){return {client_id:'cliente-teste',redirect_uris:['http://127.0.0.1:4317/v1/connections/oauth/callback'],token_endpoint_auth_method:'none'};}

test('OAuth na origem do servidor MCP passa e uma origem alterada é recusada',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-oauth-')),vault=new Vault(dir);vault.initialize('senha-de-testes-oauth');
 const hits:string[]=[],state={authorize:''};
 const server=createServer((req,res)=>{const port=portOf(server),path=new URL(req.url??'/','http://127.0.0.1').pathname;hits.push(path);req.resume();
  if(path.includes('oauth-protected-resource')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({resource:`http://127.0.0.1:${port}/mcp`,authorization_servers:[`http://127.0.0.1:${port}`]}));return;}
  if(path.includes('oauth-authorization-server')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(metadata(`http://127.0.0.1:${port}`,state.authorize)));return;}
  if(path==='/register'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(registration()));return;}
  res.writeHead(401,{'WWW-Authenticate':`Bearer resource_metadata="http://127.0.0.1:${port}/.well-known/oauth-protected-resource"`});res.end('unauthorized');});
 const c=new Connections(dir,vault);
 try{const port=await listen(server);state.authorize=`http://127.0.0.1:${port}/authorize`;
  const row=await c.add({name:'Mesma origem',url:`http://127.0.0.1:${port}/mcp`,oauth:true});
  assert.ok(row);
  assert.equal(row.authorization_origin,`http://127.0.0.1:${port}`);
  assert.equal(new URL(row.authorization_url??'').host,`127.0.0.1:${port}`);
  assert.equal(new URL(storedAuth(dir,vault).client?.issuer??'').origin,`http://127.0.0.1:${port}`);
  assert.ok(hits.some(path=>path.includes('oauth-authorization-server')));
  state.authorize='https://127.0.0.1:1/authorize';
  const again=await c.test(row.id);
  assert.ok(again);
  assert.match(again.error??'',/Origem de autorização alterada/);
  assert.equal(again.authorization_url,undefined);
  assert.equal(again.authorization_origin,`http://127.0.0.1:${port}`);
 }finally{await c.close();await stop(server);rmSync(dir,{recursive:true,force:true});}
});

test('OAuth fixa a origem HTTPS do primeiro registro e recusa outra origem',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-oauth-https-')),certDir=mkdtempSync(join(tmpdir(),'neuron-oauth-cert-')),vault=new Vault(dir);vault.initialize('senha-de-testes-oauth');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-keyout',join(certDir,'key.pem'),'-out',join(certDir,'cert.pem'),'-days','1','-nodes','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
 const previous=process.env.NODE_TLS_REJECT_UNAUTHORIZED;process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
 const httpsHits:string[]=[],state:{servers:string[]}={servers:[]};
 const httpsServer=createHttps({key:readFileSync(join(certDir,'key.pem')),cert:readFileSync(join(certDir,'cert.pem'))},(req,res)=>{const path=new URL(req.url??'/','https://127.0.0.1').pathname;httpsHits.push(path);req.resume();const base=state.servers[0];if(!base){res.writeHead(500);res.end();return;}
  if(path.includes('oauth-authorization-server')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(metadata(base)));return;}
  if(path==='/register'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(registration()));return;}
  res.writeHead(404);res.end();});
 const mcp=createServer((req,res)=>{const port=portOf(mcp),path=new URL(req.url??'/','http://127.0.0.1').pathname;req.resume();
  if(path.includes('oauth-protected-resource')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({resource:`http://127.0.0.1:${port}/mcp`,authorization_servers:state.servers}));return;}
  res.writeHead(401,{'WWW-Authenticate':`Bearer resource_metadata="http://127.0.0.1:${port}/.well-known/oauth-protected-resource"`});res.end('unauthorized');});
 const c=new Connections(dir,vault);
 try{const asPort=await listen(httpsServer),mcpPort=await listen(mcp),allowed=`https://127.0.0.1:${asPort}`;state.servers=[allowed];
  const row=await c.add({name:'HTTPS',url:`http://127.0.0.1:${mcpPort}/mcp`,oauth:true});
  assert.ok(row);
  assert.equal(row.authorization_origin,allowed);
  assert.equal(new URL(row.authorization_url??'').origin,allowed);
  assert.ok(httpsHits.some(path=>path.includes('oauth-authorization-server')));
  assert.ok(httpsHits.includes('/register'));
  const before=httpsHits.length;
  state.servers=['https://127.0.0.1:1'];
  const changed=await c.test(row.id);
  assert.ok(changed);
  assert.match(changed.error??'',/Origem de autorização alterada \(127\.0\.0\.1:1\)\./);
  assert.doesNotMatch(changed.error??'',/ECONNREFUSED|fetch failed|certificate/i);
  assert.equal(changed.authorization_url,undefined);
  assert.equal(changed.authorization_origin,allowed);
  assert.equal(httpsHits.length,before);
  const outsider:string[]=[];
  const other=createServer((req,res)=>{outsider.push(req.url??'');req.resume();res.writeHead(500);res.end();});
  const otherPort=await listen(other);
  try{state.servers=[`http://127.0.0.1:${otherPort}`];
   const refused=await c.test(row.id);
   assert.ok(refused);
   assert.match(refused.error??'',/Origem de autorização alterada|Origem MCP recusada/);
   assert.equal(outsider.length,0);
   assert.equal(refused.authorization_origin,allowed);
  }finally{await stop(other);}
 }finally{process.env.NODE_TLS_REJECT_UNAUTHORIZED=previous;await c.close();await stop(httpsServer);await stop(mcp);rmSync(dir,{recursive:true,force:true});rmSync(certDir,{recursive:true,force:true});}
});

test('OAuth sem origem fixada recusa HTTP fora do servidor MCP e não o contacta',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuron-oauth-http-')),vault=new Vault(dir);vault.initialize('senha-de-testes-oauth');
 const outsider:string[]=[];
 const other=createServer((req,res)=>{outsider.push(req.url??'');req.resume();res.writeHead(500);res.end('no');});
 const mcp=createServer((req,res)=>{const port=portOf(mcp),otherPort=portOf(other),path=new URL(req.url??'/','http://127.0.0.1').pathname;req.resume();
  if(path.includes('oauth-protected-resource')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({resource:`http://127.0.0.1:${port}/mcp`,authorization_servers:[`http://127.0.0.1:${otherPort}`]}));return;}
  res.writeHead(401,{'WWW-Authenticate':`Bearer resource_metadata="http://127.0.0.1:${port}/.well-known/oauth-protected-resource"`});res.end('unauthorized');});
 const c=new Connections(dir,vault);
 try{await listen(other);const port=await listen(mcp);
  const row=await c.add({name:'HTTP externo',url:`http://127.0.0.1:${port}/mcp`,oauth:true});
  assert.ok(row);
  assert.match(row.error??'',/Origem MCP recusada/);
  assert.equal(row.authorization_origin,undefined);
  assert.equal(row.authorization_url,undefined);
  assert.equal(outsider.length,0);
 }finally{await c.close();await stop(other);await stop(mcp);rmSync(dir,{recursive:true,force:true});}
});
