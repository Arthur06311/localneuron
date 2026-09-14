import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
const session = JSON.parse(readFileSync(join(process.env.COLMEIA_DATA_DIR || '.data', 'session.json'),'utf8'));
const launcher = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
spawn(launcher, [session.url], { shell: false, stdio: 'ignore' }).unref();
