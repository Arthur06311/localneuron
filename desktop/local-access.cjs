const {existsSync,readFileSync,writeFileSync,renameSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {randomBytes}=require('node:crypto');
function registerLocalAccess({ipcMain,safeStorage,dialog,getWindow,origin,dataDirectory,token}){
 const file=join(dataDirectory,'device-access.bin'),preferences=join(dataDirectory,'device-access-settings.json');let pending=false,manualLocked=false;
 const automatic=()=>{try{return JSON.parse(readFileSync(preferences,'utf8')).automatic===true;}catch{return false;}};
 const setAutomatic=value=>{writeFileSync(preferences+'.tmp',JSON.stringify({automatic:value}),{mode:0o600});renameSync(preferences+'.tmp',preferences);};
 const secure=()=>safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');
 const request=async(route,body)=>{const r=await fetch(origin+'/v1/'+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error||'Não foi possível abrir o espaço.');return result;};
 ipcMain.handle('localneuron:local-access',async(event,input)=>{
  const action=typeof input==='string'?input:input?.action;
  const data=typeof input==='object'&&input?input:{};
  const window=getWindow();if(!window||event.senderFrame!==window.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Origem recusada');
  if(action==='suspend'){manualLocked=true;return {ok:true};}
  if(action==='status')return {available:secure(),configured:existsSync(file),automatic:existsSync(file)&&automatic()};
  if(!['create','unlock','auto-unlock','remember','automatic'].includes(action))throw Error('Ação inválida');
  if(pending)throw Error('Aguarde a operação atual.');if(!secure())throw Error('O armazenamento seguro do sistema não está disponível. Use uma senha local.');
  pending=true;try{
   const state=await request('status');
   if(action==='automatic'){
    if(state.locked)throw Error('Desbloqueie o aplicativo primeiro.');
    if(typeof data.enabled!=='boolean')throw Error('Preferência inválida.');
    if(data.enabled&&!existsSync(file))throw Error('Entre com sua senha e marque Lembrar neste computador.');
    setAutomatic(data.enabled);return {ok:true};
   }
   if(action==='auto-unlock'&&(!automatic()||manualLocked))return {cancelled:true};
   if(action==='remember'){
    if(typeof data.password!=='string'||!data.password.length||data.password.length>1024)throw Error('Senha inválida.');
    if(!state.initialized)throw Error('Configure o espaço primeiro.');
    await request('unlock',{password:data.password});
    writeFileSync(file+'.tmp',safeStorage.encryptString(data.password),{mode:0o600});renameSync(file+'.tmp',file);setAutomatic(true);manualLocked=false;return {ok:true};
   }
   if(action==='create'){
    if(state.initialized||state.vault_exists)throw Error('Já existe um cofre. Use a proteção original para preservar seus dados.');
    const confirmation=await dialog.showMessageBox(window,{type:'info',title:'Proteção neste computador',message:'Usar a proteção do sistema?',detail:'Quem tiver acesso à sua sessão do computador poderá abrir o LocalNeuron. A chave fica no armazenamento seguro deste sistema; preserve uma cópia dos seus dados e não apague esta credencial.',buttons:['Usar proteção do sistema','Voltar'],defaultId:0,cancelId:1});if(confirmation.response!==0)return {cancelled:true};
    const password=randomBytes(48).toString('base64url');writeFileSync(file+'.tmp',safeStorage.encryptString(password),{mode:0o600});renameSync(file+'.tmp',file);
    try{await request('setup',{password});}catch(e){const next=await request('status').catch(()=>null);if(next&&!next.vault_exists)rmSync(file,{force:true});throw e;}
   }else{
    if(!existsSync(file))throw Error('Este espaço usa senha local.');const password=safeStorage.decryptString(readFileSync(file));await request(state.initialized?'unlock':'setup',{password});
   }
   manualLocked=false;return {ok:true};
  }finally{pending=false;}
 });
}
module.exports={registerLocalAccess};
