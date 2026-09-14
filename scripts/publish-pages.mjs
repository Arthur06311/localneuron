import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
function run(command,args){const result=spawnSync(command,args,{cwd,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
run(process.execPath,['scripts/build-website.mjs']);
run(process.execPath,['--test','tests/website.test.mjs']);
const status=spawnSync('git',['status','--porcelain','--','website'],{cwd,encoding:'utf8'});
if(status.status!==0||status.stdout.trim()){console.error('Commit website changes before publishing; only committed content is deployed.');process.exit(1);}
run('git',['subtree','push','--prefix','website','origin','gh-pages']);
console.log('Site branch pushed. Check the GitHub Pages build before sharing the live URL.');
