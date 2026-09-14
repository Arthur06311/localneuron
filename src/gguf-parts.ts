import { join } from 'node:path';
import { lstatSync } from 'node:fs';
/** A split GGUF is loadable only through shard 1 and with every sibling present. */
export function ggufSetBytes(directory: string, filename: string): number | null {
  if (!/\.gguf$/i.test(filename) || /^mmproj/i.test(filename)) return null;
  const split = /^(.*)-([0-9]{5})-of-([0-9]{5})\.gguf$/i.exec(filename);
  if (split && (Number(split[2]) !== 1 || Number(split[3]) < 2 || Number(split[3]) > 999)) return null;
  const names = split ? Array.from({length:Number(split[3])},(_,i)=>`${split[1]}-${String(i+1).padStart(5,'0')}-of-${split[3]}.gguf`) : [filename];
  let bytes = 0;
  try { for (const name of names) { const stat=lstatSync(join(directory,name));if(!stat.isFile() || stat.isSymbolicLink() || !stat.size)return null;bytes+=stat.size; } } catch { return null; }
  return bytes;
}
