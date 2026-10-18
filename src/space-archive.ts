import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { strToU8, unzipSync, zipSync } from 'fflate';
import type { Core } from './core.js';

const names = new Set(['manifest.json', 'vault.enc.json', 'pglite.tar', 'workspace/workspace.json']);

export async function exportSpace(core: Core, destination: string, prepare: () => Promise<void>) {
  await prepare();
  await core.store.quiesce();
  const dump = await core.store.db.dumpDataDir('none');
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify({ format: 'localneuron-space', version: 1 })),
    'vault.enc.json': readFileSync(core.vault.path),
    'pglite.tar': new Uint8Array(await dump.arrayBuffer()),
  };
  const workspace = join(core.directory, 'pro', 'workspace.json');
  if (existsSync(workspace) && statSync(workspace).isFile()) files['workspace/workspace.json'] = readFileSync(workspace);
  writeFileSync(destination, zipSync(files), { mode: 0o600 });
}

export async function importSpace(archive: string, directory: string) {
  const packed = unzipSync(new Uint8Array(readFileSync(archive)));
  const entries = Object.keys(packed);
  if (!entries.length || entries.some(name => !names.has(name))) throw new Error('Arquivo de espaço recusado.');
  if (!packed['manifest.json'] || !packed['vault.enc.json'] || !packed['pglite.tar']) throw new Error('Arquivo de espaço incompleto.');
  const manifest = JSON.parse(new TextDecoder().decode(packed['manifest.json'])) as { format?: string; version?: number };
  if (manifest.format !== 'localneuron-space' || manifest.version !== 1) throw new Error('Arquivo de espaço recusado.');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (readdirSync(directory).length) throw new Error('Escolha uma pasta vazia para abrir este espaço.');
  writeFileSync(join(directory, 'vault.enc.json'), packed['vault.enc.json'], { mode: 0o600 });
  if (packed['workspace/workspace.json']) {
    mkdirSync(join(directory, 'pro'), { recursive: true, mode: 0o700 });
    writeFileSync(join(directory, 'pro', 'workspace.json'), packed['workspace/workspace.json'], { mode: 0o600 });
  }
  const db = new PGlite(join(directory, 'postgres'), { loadDataDir: new Blob([packed['pglite.tar']]) });
  await db.waitReady;
  await db.close();
}
