// Run against an actual installed/released binary on its target OS.
// No model downloads, credentials, personal workspace or sandbox-disabling flags.
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const binary=resolve(process.argv[2]);
const report=resolve(process.argv[3]||'desktop-smoke.json');
const directory=mkdtempSync(join(tmpdir(),'localneuron-native-'));
const debugPort=19327,started=Date.now();
let stderr='',stdout='',child,error='',result={platform:process.platform,arch:process.arch,renderer:false};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try {
 child=spawn(binary,[`--remote-debugging-port=${debugPort}`],{env:{...process.env,COLMEIA_DESKTOP_DATA_DIR:directory,LOCALNEURON_TEST_PORT:'14318'},stdio:['ignore','pipe','pipe']});
 child.on('error',e=>{error=e.message;});
 child.stderr.on('data',c=>stderr=(stderr+c).slice(-12000));
 child.stdout.on('data',c=>stdout=(stdout+c).slice(-12000));
 let target;
 for(let i=0;i<180;i++){
   if(error||child.exitCode!==null)throw Error(error||`Desktop exited with ${child.exitCode}`);
   try{const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(500)}).then(r=>r.json());target=pages.find(p=>p.type==='page'&&p.url?.startsWith('http://127.0.0.1:14318/'));if(target)break;}catch{}
   await pause(250);
 }
 if(!target)throw Error('No LocalNeuron window appeared within 45 seconds');
 const ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=()=>fail(Error('CDP connection failed'));});
 let nextId=0;const pending=new Map();
 ws.onmessage=event=>{const value=JSON.parse(event.data);const p=pending.get(value.id);if(p){pending.delete(value.id);clearTimeout(p.timer);value.error?p.fail(Error(JSON.stringify(value.error))):p.ok(value.result);}};
 const cdp=(method,params)=>new Promise((ok,fail)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);fail(Error('CDP timeout'));},10000);pending.set(id,{ok,fail,timer});ws.send(JSON.stringify({id,method,params}));});
 let state;
 for(let i=0;i<80;i++){
  state=(await cdp('Runtime.evaluate',{expression:'({title:document.title,ready:document.readyState,body:document.body?.innerText.slice(0,8000)||""})',returnByValue:true})).result.value;
  if(state.ready==='complete'&&state.body.includes('LocalNeuron'))break;
  await pause(250);
 }
 ws.close();
 if(!state?.body.includes('LocalNeuron'))throw Error('Window loaded but application UI was not visible');
 result={...result,renderer:true,title:state.title,bodyPreview:state.body.slice(0,1500),startupMs:Date.now()-started};
 const sessionFile=join(directory,'workspace/session.json');
 if(existsSync(sessionFile)){
   const session=JSON.parse(readFileSync(sessionFile,'utf8'));
   result.backend=(await fetch(session.url.split('#')[0])).status;
 }
} catch(e){result.error=e.message;process.exitCode=1;}
finally{
 if(child?.pid){if(process.platform==='win32')await new Promise(r=>{const killer=spawn('taskkill',['/pid',String(child.pid),'/T','/F']);killer.on('exit',r);killer.on('error',r);});else child.kill('SIGTERM');}
 result.stderr=stderr.replace(/#session=[^\s"']+/g,'#session=[redacted]');result.stdout=stdout;
 writeFileSync(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 setTimeout(()=>process.exit(process.exitCode||0),1000).unref();
}
