import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
const { localSetting } = createRequire(import.meta.url)('./local-env.cjs');
const session = JSON.parse(readFileSync(join(localSetting(process.env, 'DATA_DIR') || '.data', 'session.json'),'utf8'));
const launcher = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
spawn(launcher, [session.url], { shell: false, stdio: 'ignore' }).unref();
