// Portable folders for Windows and Linux. Run on the target OS for release validation.
import { packager } from '@electron/packager';
import { cpSync, mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
// Ignore only numbered sync conflicts that have a canonical runtime counterpart.
const runtimeFilter=path=>{const canonical=path.replace(/ \d+(?=\.[^/]*$|$)/g,'');return canonical===path||!existsSync(canonical);};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const platform=process.argv[2]||process.platform, arch=process.argv[3]||process.arch;
if(!['win32','linux','darwin'].includes(platform)||!['x64','arm64'].includes(arch))throw new Error('Use darwin, win32 ou linux; arquitetura x64 ou arm64');
execFileSync('node',[join(root,'scripts/validate-subscription.mjs')],{cwd:root,stdio:'inherit'});
const scratch=mkdtempSync(join(tmpdir(),'colmeia-build-')),source=join(scratch,'source');
mkdirSync(source);
execFileSync(process.platform==='win32'?'python':'python3',[join(root,'scripts/fetch-runtime.py'),platform+'-'+arch],{cwd:root,stdio:'inherit'});
execFileSync(process.platform==='win32'?'python':'python3',[join(root,'scripts/fetch-tools.py'),platform+'-'+arch],{cwd:root,stdio:'inherit'});
execFileSync(process.platform==='win32'?'python':'python3',[join(root,'scripts/fetch-voice-node.py'),platform+'-'+arch],{cwd:root,stdio:'inherit'});
try {
  // Explicit inclusion avoids packaging vaults, sessions, model weights or workspace data.
  for(const file of ['package.json','package-lock.json','subscription-config.json','dist','desktop','public','workflows','THIRD_PARTY.md','licenses']) cpSync(join(root,file),join(source,file),{recursive:true,...(file==='public'?{filter:runtimeFilter}:{})});
  mkdirSync(join(source,'runtime'),{recursive:true});
  for(const file of ['manifest.json','LICENSE.llama.cpp','tools-manifest.json','LICENSE.whisper.cpp'])cpSync(join(root,'runtime',file),join(source,'runtime',file));
  cpSync(join(root,'runtime','tools-'+platform+'-'+arch),join(source,'runtime','tools-'+platform+'-'+arch),{recursive:true,verbatimSymlinks:true,filter:runtimeFilter});
  cpSync(join(root,'runtime','voice-node-manifest.json'),join(source,'runtime','voice-node-manifest.json'));
  cpSync(join(root,'runtime','voice-node-'+platform+'-'+arch),join(source,'runtime','voice-node-'+platform+'-'+arch),{recursive:true});
  cpSync(join(root,'runtime',platform+'-'+arch),join(source,'runtime',platform+'-'+arch),{recursive:true,verbatimSymlinks:true});
  execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--os='+platform,'--cpu='+arch,'--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:source,stdio:'inherit',shell:process.platform==='win32'});
  if(platform==='darwin'&&arch==='arm64'){execFileSync('python3',[join(root,'scripts/fetch-mlx.py')],{cwd:root,stdio:'inherit'});for(const file of ['mlx-manifest.json','mlx_server.py','mlx_protocol.py'])cpSync(join(root,'runtime',file),join(source,'runtime',file));cpSync(join(root,'runtime/mlx-darwin-arm64'),join(source,'runtime/mlx-darwin-arm64'),{recursive:true,verbatimSymlinks:true});}
  const config=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  const paths=await packager({dir:source,tmpdir:join(scratch,'packager'),name:'LocalNeuron',executableName:'LocalNeuron',platform,arch,electronVersion:config.devDependencies.electron,appVersion:config.version,appBundleId:'dev.colmeia.local',extendInfo:{NSMicrophoneUsageDescription:'O LocalNeuron usa o microfone para transcrever sua fala localmente com Whisper.'},out:join(root,'releases'),overwrite:false,asar:false,prune:false});
  for(const path of paths){if(platform==='win32')writeFileSync(join(path,'LEIA-ME.txt'),'LocalNeuron 0.24 - Windows x64\n\nExtraia a pasta inteira e abra LocalNeuron.exe.\nOs motores locais requerem Microsoft Visual C++ v14 x64 atualizado.\nDownload oficial: https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist\n\nModelos são baixados no aplicativo. A execução depois do download é local.\nEste pacote foi montado no Mac; a execução nativa em Windows ainda precisa de validação.\n');console.log('Pacote criado: '+path);}
} finally {rmSync(scratch,{recursive:true,force:true});}
