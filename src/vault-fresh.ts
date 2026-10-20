import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Core } from './core.js';
import { abortVaultMigration } from './vault-migration.js';
import { Vault } from './vault.js';

const STAMP = /^[0-9]{8}T[0-9]{9}Z-[0-9a-f]{4}$/;
export const LEGACY_VAULT = /^vault\.enc\.json\.legacy-([0-9]{8}T[0-9]{9}Z-[0-9a-f]{4})$/;

export function datedStamp(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, '') + '-' + randomBytes(2).toString('hex');
}

function assertSecret(secret: string) {
  if (secret.length < 12 || secret.length > 1024) throw new Error('Chave do dispositivo inválida');
}

async function renameRetry(from: string, to: string) {
  let last: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try { renameSync(from, to); return; }
    catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1))); }
  }
  throw last instanceof Error ? last : new Error('Não foi possível guardar a cópia');
}

async function closeStore(core: Core) {
  try { await core.store.quiesce(); } catch { /* o fecho seguinte é o que libera a pasta */ }
  try { await core.store.close(); } catch { /* a pasta pode já estar fechada */ }
}

function sameDirectory(file: string, directory: string) {
  return dirname(file) === directory;
}

export function vaultAccepts(file: string, secret: string) {
  try { return Boolean(Vault.openSealed(file, secret).organization); }
  catch { return false; }
}

export function listLegacyBackups(directory: string) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap(name => {
    const match = LEGACY_VAULT.exec(name);
    if (!match) return [];
    const stamp = match[1];
    const postgres = join(directory, 'postgres.legacy-' + stamp);
    return [{ name, stamp, postgres: existsSync(postgres) && statSync(postgres).isDirectory() }];
  });
}

async function restoreParked(core: Core, stamp: string, vaultParked: boolean, postgresParked: boolean) {
  await closeStore(core);
  const postgres = join(core.directory, 'postgres');
  const postgresBackup = join(core.directory, 'postgres.legacy-' + stamp);
  const vaultBackup = core.vault.path + '.legacy-' + stamp;
  if (postgresParked && existsSync(postgres) && existsSync(postgresBackup)) await renameRetry(postgres, postgres + '.incomplete-' + stamp);
  if (postgresParked && existsSync(postgresBackup) && !existsSync(postgres)) await renameRetry(postgresBackup, postgres);
  if (vaultParked && existsSync(core.vault.path) && existsSync(vaultBackup)) await renameRetry(core.vault.path, core.vault.path + '.incomplete-' + stamp);
  if (vaultParked && existsSync(vaultBackup) && !existsSync(core.vault.path)) await renameRetry(vaultBackup, core.vault.path);
  core.vault.abandon();
  if (existsSync(postgres)) await core.reopenStore();
}

export async function beginFreshDeviceSpace(core: Core, secret: string, stamp = datedStamp()) {
  assertSecret(secret);
  if (!STAMP.test(stamp)) throw new Error('Data da cópia inválida');
  if (!core.vault.exists || !core.vault.locked) throw new Error('Não há cofre antigo para guardar');
  const vaultBackup = core.vault.path + '.legacy-' + stamp;
  const postgres = join(core.directory, 'postgres');
  const postgresBackup = join(core.directory, 'postgres.legacy-' + stamp);
  if (existsSync(vaultBackup) || existsSync(postgresBackup)) throw new Error('Já existe uma cópia desta data');
  const original = readFileSync(core.vault.path);
  abortVaultMigration(core.vault);
  if (!readFileSync(core.vault.path).equals(original)) throw new Error('O cofre original foi alterado');
  await closeStore(core);
  let vaultParked = false;
  let postgresParked = false;
  try {
    await renameRetry(core.vault.path, vaultBackup);
    vaultParked = true;
    if (!sameDirectory(vaultBackup, core.directory) || !readFileSync(vaultBackup).equals(original)) throw new Error('A cópia do cofre antigo não confere');
    if (existsSync(postgres)) {
      await renameRetry(postgres, postgresBackup);
      postgresParked = true;
    }
    core.vault.abandon();
    await core.reopenStore();
    await core.setup(secret);
    if (!Vault.openSealed(core.vault.path, secret).organization) throw new Error('O cofre novo não abriu');
    if (!readFileSync(vaultBackup).equals(original)) throw new Error('A cópia do cofre antigo foi alterada');
    return { stamp, vaultBackup };
  } catch (error) {
    await restoreParked(core, stamp, vaultParked, postgresParked);
    if (existsSync(core.vault.path) && !readFileSync(core.vault.path).equals(original)) throw new Error('O cofre original foi alterado');
    throw error;
  }
}

async function restoreImport(core: Core, secret: string, moved: { vault: boolean; postgres: boolean; legacy: boolean; stamp: string; replaced: string }) {
  await closeStore(core);
  const postgres = join(core.directory, 'postgres');
  const postgresBackup = join(core.directory, 'postgres.legacy-' + moved.stamp);
  const parkedPostgres = join(core.directory, 'postgres.replaced-' + moved.replaced);
  const parkedVault = core.vault.path + '.replaced-' + moved.replaced;
  if (moved.legacy && existsSync(postgres) && existsSync(postgresBackup)) await renameRetry(postgres, postgres + '.incomplete-' + moved.replaced);
  if (moved.postgres && existsSync(parkedPostgres)) {
    if (existsSync(postgres)) await renameRetry(postgres, postgres + '.incomplete-' + moved.replaced);
    await renameRetry(parkedPostgres, postgres);
  }
  if (moved.vault && existsSync(core.vault.path) && existsSync(parkedVault)) await renameRetry(core.vault.path, core.vault.path + '.import-incomplete-' + moved.replaced);
  if (moved.vault && existsSync(parkedVault) && !existsSync(core.vault.path)) await renameRetry(parkedVault, core.vault.path);
  core.vault.abandon();
  if (existsSync(postgres)) {
    await core.reopenStore();
    if (existsSync(core.vault.path)) await core.unlock(secret);
  }
}

export async function importLegacyVault(core: Core, secret: string, name: string, password: string) {
  assertSecret(secret);
  const match = LEGACY_VAULT.exec(name);
  if (!match || name.includes('/') || name.includes('\\')) throw new Error('Cópia inválida');
  if (core.vault.locked || !core.vault.exists) throw new Error('Cofre bloqueado');
  const backup = join(core.directory, name);
  if (!existsSync(backup)) throw new Error('Cópia não encontrada');
  const stamp = match[1];
  const postgresBackup = join(core.directory, 'postgres.legacy-' + stamp);
  if (!existsSync(postgresBackup)) throw new Error('A cópia do espaço antigo não está completa');
  const backupBytes = readFileSync(backup);
  const currentBytes = readFileSync(core.vault.path);
  Vault.openSealed(backup, password);
  Vault.openSealed(core.vault.path, secret);
  if (!readFileSync(backup).equals(backupBytes) || !readFileSync(core.vault.path).equals(currentBytes)) throw new Error('A cópia foi alterada');
  const replaced = datedStamp();
  const postgres = join(core.directory, 'postgres');
  const moved = { vault: false, postgres: false, legacy: false, stamp, replaced };
  await closeStore(core);
  try {
    await renameRetry(core.vault.path, core.vault.path + '.replaced-' + replaced);
    moved.vault = true;
    await renameRetry(postgres, join(core.directory, 'postgres.replaced-' + replaced));
    moved.postgres = true;
    writeFileSync(core.vault.path, backupBytes, { mode: 0o600 });
    cpSync(postgresBackup, postgres, { recursive: true });
    moved.legacy = true;
    core.vault.abandon();
    await core.reopenStore();
    await core.unlock(password);
    core.vault.save(secret);
    if (!readFileSync(backup).equals(backupBytes)) throw new Error('A cópia foi alterada');
    if (!Vault.openSealed(core.vault.path, secret).organization) throw new Error('O cofre importado não abriu');
    if (!readFileSync(backup).equals(backupBytes)) throw new Error('A cópia foi alterada');
  } catch (error) {
    try { await restoreImport(core, secret, moved); }
    catch { /* a cópia em disco continua no perfil */ }
    throw error;
  }
}
