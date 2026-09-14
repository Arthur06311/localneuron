const { app, BrowserWindow, dialog, session, shell, ipcMain, safeStorage } = require('electron');
const { spawn } = require('node:child_process');
const { registerComputer } = require('./computer.cjs');
const { registerLocalAccess } = require('./local-access.cjs');
const { registerFolderPicker } = require('./folders.cjs');
const { allowsClipboard, allowsMicrophone } = require('./permissions.cjs');
const { join, resolve } = require('node:path');
const { mkdirSync, existsSync, readFileSync,writeFileSync } = require('node:fs');
const root = resolve(__dirname, '..');
const bundled = root === join(process.resourcesPath, 'app');
// Keep the first Mac alpha's existing vault in place. New installations use OS app data.
const legacy = process.platform === 'darwin' ? resolve(root,'../../../..','Colmeia-data') : '';
const pointer=join(app.getPath('appData'),'LocalNeuron','workspace-location.json');
let restored=null;try{const saved=JSON.parse(readFileSync(pointer,'utf8'));if(typeof saved.runtime==='string'&&existsSync(join(saved.runtime,'workspace','vault.enc.json')))restored=saved.runtime;}catch{}
const runtime = process.env.COLMEIA_DESKTOP_DATA_DIR || restored || (bundled ? (legacy && existsSync(legacy) ? legacy : join(app.getPath('appData'), 'Colmeia')) : join(root, '.desktop'));
mkdirSync(runtime, { recursive: true, mode: 0o700 });
app.setPath('userData', join(runtime, 'browser'));
app.setPath('sessionData', join(runtime, 'session'));
app.setPath('logs', join(runtime, 'logs'));
app.setName('LocalNeuron');
let backend, window;
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  const port = process.env.LOCALNEURON_TEST_PORT?Number(process.env.LOCALNEURON_TEST_PORT):4318, origin = `http://127.0.0.1:${port}`;
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(allowsClipboard(permission, details.requestingUrl, contents?.getURL(), origin)||allowsMicrophone(permission,details.requestingUrl,contents?.getURL(),details)));
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => details.isMainFrame !== false && (allowsClipboard(permission, requestingOrigin, contents?.getURL(), origin)||allowsMicrophone(permission,requestingOrigin,contents?.getURL(),details)));
  registerFolderPicker({ipcMain,dialog,getWindow:()=>window,origin});
  ipcMain.handle('localneuron:restore-workspace',async event=>{if(!window||event.senderFrame!==window.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Origem recusada');const result=await dialog.showOpenDialog(window,{title:'Abra a pasta de dados existente (contém workspace)',properties:['openDirectory']});if(result.canceled)return {cancelled:true};const target=result.filePaths[0];if(!existsSync(join(target,'workspace','vault.enc.json')))throw Error('Escolha a pasta que contém workspace/vault.enc.json. Nenhum dado foi alterado.');const confirm=await dialog.showMessageBox(window,{type:'question',message:'Reabrir o LocalNeuron com este espaço?',detail:target+'\nA senha ou a proteção original será necessária. A pasta atual permanece intacta.',buttons:['Reabrir','Cancelar'],cancelId:1});if(confirm.response!==0)return {cancelled:true};mkdirSync(join(app.getPath('appData'),'LocalNeuron'),{recursive:true,mode:0o700});writeFileSync(pointer,JSON.stringify({runtime:target}),{mode:0o600});app.relaunch();app.quit();return {ok:true};});
  const dataDirectory = join(runtime, 'workspace');
  const sessionFile = join(dataDirectory, 'session.json');
  const started = Date.now();
  backend = spawn(process.execPath, [join(root,'dist/src/server.js')], { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', COLMEIA_DATA_DIR: dataDirectory, COLMEIA_PORT: String(port) }, stdio: ['ignore','pipe','pipe','ipc'] });
  registerComputer(backend);
  let output = '';
  backend.stderr.on('data', chunk => { output = (output + chunk.toString()).slice(-3000); });
  const localSession = await new Promise((resolveSession, reject) => {
    const interval = setInterval(() => {
      if (backend.exitCode !== null) { clearInterval(interval); reject(new Error('O serviço local encerrou: ' + output)); return; }
      if (Date.now()-started > 20000) {clearInterval(interval);reject(new Error('O serviço local não iniciou em 20 segundos.'));return;}
      if (existsSync(sessionFile)) {
        try { const value=JSON.parse(readFileSync(sessionFile,'utf8'));if(value.started_at>=started){clearInterval(interval);resolveSession(value);}}catch{}
      }
    },100);
  });
  window = new BrowserWindow({width:1320,height:900,minWidth:760,minHeight:640,title:'LocalNeuron',backgroundColor:'#f6f5f0',autoHideMenuBar:true,webPreferences:{preload:join(root,'desktop/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,spellcheck:false}});
  window.webContents.setWindowOpenHandler(({url})=>{
    try { const target=new URL(url); if(['https:','http:'].includes(target.protocol)&&!target.username&&!target.password&&(!target.port||['80','443'].includes(target.port))&&!['localhost','127.0.0.1','[::1]'].includes(target.hostname)) shell.openExternal(target.href).catch(()=>{}); } catch {}
    return {action:'deny'};
  });
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{callback({cancel:!(details.url.startsWith(origin+'/')||details.url.startsWith('blob:'+origin+'/'))});});
  const localToken=new URL(localSession.url).hash.slice(1);
  registerLocalAccess({ipcMain,safeStorage,dialog,getWindow:()=>window,origin,dataDirectory,token:new URLSearchParams(localToken).get('session')});
  await window.loadURL(localSession.url);
}).catch(error=>{dialog.showErrorBox('LocalNeuron não iniciou',error.message);app.quit();});
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(backend&&!backend.killed)backend.kill('SIGTERM');});
