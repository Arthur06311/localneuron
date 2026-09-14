const {BrowserWindow,systemPreferences}=require('electron');
const {execFile}=require('node:child_process');
function registerComputer(backend){
 let browser=null,version=0;
 const script=(source,args=[])=>new Promise((resolve,reject)=>execFile('/usr/bin/osascript',['-e',source,'--',...args],{timeout:15000,maxBuffer:100000},(error,stdout)=>error?reject(new Error('O macOS não permitiu esta ação. Confira Acessibilidade e Automação nos Ajustes do Sistema.')):resolve(stdout.trim())));
 const ensureBrowser=()=>{if(!browser||browser.isDestroyed()){browser=new BrowserWindow({width:1100,height:780,title:'LocalNeuron · Navegador controlado pela IA',webPreferences:{partition:'persist:localneuron-agent-browser',sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}});browser.webContents.setWindowOpenHandler(()=>({action:'deny'}));browser.webContents.session.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));browser.webContents.on('did-navigate',()=>version++);browser.webContents.on('did-navigate-in-page',()=>version++);}return browser;};
 const address=value=>{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Use uma página HTTP/HTTPS pública, sem credenciais na URL.');return url.href;};
 async function run(name,args){
  if(name==='browser_open'){const w=ensureBrowser();await w.loadURL(address(args.url));return {url:w.webContents.getURL(),title:w.webContents.getTitle(),note:'Use browser_snapshot para ler a página e obter referências atuais.'};}
  if(name==='browser_snapshot'){const w=ensureBrowser(),data=await w.webContents.executeJavaScript(`(()=>{const elements=[...document.querySelectorAll('a,button,input,textarea,select,[role="button"]')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).slice(0,120);window.__localNeuronControls=elements;return {title:document.title,url:location.href,text:document.body.innerText.slice(0,14000),controls:elements.map((e,i)=>({ref:i,tag:e.tagName,type:e.type||'',label:(e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||e.name||'').slice(0,160)}))};})()`);return {...data,version};}
  if(name==='browser_action'){const w=ensureBrowser();if(args.version!==version)throw Error('A página mudou. Leia a página novamente.');if(!Number.isInteger(args.ref)||args.ref<0||args.ref>119||!['click','type','select'].includes(args.action))throw Error('Ação inválida.');return w.webContents.executeJavaScript(`(()=>{const args=${JSON.stringify(args)},e=window.__localNeuronControls?.[args.ref];if(!e||!e.isConnected)throw Error('Elemento mudou; leia a página novamente.');if(e.type==='password'||e.type==='file')throw Error('Preencha senhas e arquivos manualmente.');if(args.action==='click')e.click();else{if(args.action==='type'&&!['INPUT','TEXTAREA'].includes(e.tagName))throw Error('Escolha um campo de texto.');if(args.action==='select'&&e.tagName!=='SELECT')throw Error('Escolha uma lista.');const prototype=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,args.text);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}return {ok:true,url:location.href};})()`);}
  if(name==='desktop_apps')return {apps:await script('tell application "System Events" to get name of every process whose background only is false'),accessibility:systemPreferences.isTrustedAccessibilityClient(false)};
  if(name==='desktop_action'){
   if(!systemPreferences.isTrustedAccessibilityClient(false))throw Error('Habilite o LocalNeuron em Ajustes do Sistema → Privacidade e Segurança → Acessibilidade.');
   if(args.action==='activate')return {result:await script('on run argv\ntell application "System Events" to set frontmost of process (item 1 of argv) to true\nend run',[String(args.text)])};
   if(args.action==='type')return {result:await script('on run argv\ntell application "System Events" to keystroke (item 1 of argv)\nend run',[String(args.text)])};
   if(args.action==='key'){const keys={enter:36,escape:53,tab:48,backspace:51,up:126,down:125,left:123,right:124};if(!(args.text in keys))throw Error('Tecla não suportada.');return {result:await script('tell application "System Events" to key code '+keys[args.text])};}
   throw Error('Ação não suportada.');
  }
  if(name==='computer_stop'){if(browser&&!browser.isDestroyed())browser.close();browser=null;version++;return {ok:true};}
  throw Error('Ferramenta indisponível neste computador.');
 }
 backend.on('message',async message=>{if(!message||message.type!=='computer'||typeof message.id!=='string')return;try{const result=await run(message.name,message.args);if(backend.connected)backend.send({type:'computer-result',id:message.id,result});}catch(e){if(backend.connected)backend.send({type:'computer-result',id:message.id,error:e.message});}});
 backend.on('exit',()=>{if(browser&&!browser.isDestroyed())browser.close();});
}
module.exports={registerComputer};
