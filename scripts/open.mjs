import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const { legacyEnv } = createRequire(import.meta.url)('../desktop/env.cjs');
const session = JSON.parse(readFileSync(join(legacyEnv('DATA_DIR') || '.data', 'session.json'),'utf8'));
const launcher = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
spawn(launcher, [session.url], { shell: false, stdio: 'ignore' }).unref();
