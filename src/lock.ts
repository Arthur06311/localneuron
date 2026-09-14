import { openSync, writeFileSync, readFileSync, unlinkSync, closeSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function acquireProcessLock(directory: string) {
  const path = join(directory, 'server.lock');
  const create = () => { const fd = openSync(path,'wx',0o600); try { writeFileSync(fd,String(process.pid)); } finally {closeSync(fd);} };
  try { create(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const pid = Number(readFileSync(path,'utf8'));
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Trava de processo inválida. Verifique o manual de recuperação.');
    try { process.kill(pid,0); throw new Error('Este espaço já está aberto em outro processo'); }
    catch (check) { if ((check as NodeJS.ErrnoException).code !== 'ESRCH') throw check; }
    unlinkSync(path); create();
  }
  return () => { if (existsSync(path) && readFileSync(path,'utf8') === String(process.pid)) unlinkSync(path); };
}
