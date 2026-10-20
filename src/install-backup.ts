import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const VAULT = 'vault.enc.json';
const DATABASE = 'postgres';
const LOCK = 'server.lock';

function sameTree(parent: string, child: string) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function installationBundleReady(directory: string) {
  const vault = join(directory, VAULT);
  const database = join(directory, DATABASE);
  return existsSync(vault) && statSync(vault).isFile() && existsSync(database) && statSync(database).isDirectory();
}

function lockState(directory: string): 'absent' | 'stale' | 'held' | 'invalid' {
  const path = join(directory, LOCK);
  if (!existsSync(path)) return 'absent';
  let text: string;
  try { text = readFileSync(path, 'utf8').trim(); }
  catch { return 'invalid'; }
  const pid = Number(text);
  if (!Number.isSafeInteger(pid) || pid < 1 || String(pid) !== text) return 'invalid';
  try { process.kill(pid, 0); return 'held'; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' ? 'stale' : 'held'; }
}

function assertBundle(directory: string) {
  if (!installationBundleReady(directory)) throw new Error('O cofre e o banco precisam ser copiados juntos.');
}

function copyTree(source: string, destination: string) {
  cpSync(source, destination, {
    recursive: true,
    verbatimSymlinks: true,
    filter: src => {
      if (resolve(src) === join(source, LOCK)) return false;
      if (lstatSync(src).isSymbolicLink()) throw new Error('A pasta contém um link simbólico e não foi copiada.');
      return true;
    },
  });
}

function copyBundle(source: string, destination: string) {
  try {
    copyTree(source, destination);
    rmSync(join(destination, LOCK), { force: true });
    assertBundle(destination);
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

export function backupInstallation(source: string, destination: string) {
  const from = resolve(source);
  const to = resolve(destination);
  if (sameTree(from, to) || sameTree(to, from)) throw new Error('A pasta de backup precisa ser diferente do espaço em uso.');
  assertBundle(from);
  const lock = lockState(from);
  if (lock === 'held') throw new Error('Feche o aplicativo antes de copiar este espaço.');
  if (lock === 'invalid') throw new Error('Trava de processo inválida. Verifique o manual de recuperação.');
  if (existsSync(to)) throw new Error('A pasta de destino do backup já existe.');
  copyBundle(from, to);
}

export function restoreInstallation(backup: string, destination: string) {
  const from = resolve(backup);
  const to = resolve(destination);
  if (sameTree(from, to) || sameTree(to, from)) throw new Error('Restaure em uma pasta nova.');
  assertBundle(from);
  if (existsSync(to)) {
    const lock = lockState(to);
    if (lock === 'held' || lock === 'invalid' || existsSync(join(to, DATABASE)) || existsSync(join(to, VAULT)) || readdirSync(to).length > 0) {
      throw new Error('Não sobreponha um banco em uso. Restaure em uma pasta nova.');
    }
  }
  copyBundle(from, to);
}
