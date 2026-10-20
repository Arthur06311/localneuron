import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { Vault } from './vault.js';

export function migrationPath(vaultPath: string) { return vaultPath + '.next'; }

export function prepareVaultMigration(vault: Vault, oldPassword: string, newSecret: string) {
  if (newSecret.length < 12 || newSecret.length > 1024) throw new Error('Chave do dispositivo inválida');
  if (!vault.exists) throw new Error('Cofre ausente');
  if (!vault.locked) throw new Error('O cofre já está aberto');
  const before = readFileSync(vault.path);
  const next = migrationPath(vault.path);
  try { vault.unlock(oldPassword); }
  catch (error) {
    vault.lock();
    if (!readFileSync(vault.path).equals(before)) throw new Error('O cofre original foi alterado');
    throw error;
  }
  try {
    vault.writeSealed(next, newSecret);
    const opened = Vault.openSealed(next, newSecret);
    if (JSON.stringify(opened) !== JSON.stringify(vault.keys)) throw new Error('A cópia migrada não confere');
  } catch (error) {
    rmSync(next, { force: true });
    rmSync(next + '.tmp', { force: true });
    vault.lock();
    if (!readFileSync(vault.path).equals(before)) throw new Error('O cofre original foi alterado');
    throw error;
  }
  vault.lock();
  if (!readFileSync(vault.path).equals(before)) {
    rmSync(next, { force: true });
    throw new Error('O cofre original foi alterado');
  }
}

export function commitVaultMigration(vault: Vault) {
  const next = migrationPath(vault.path);
  if (!existsSync(next) || !existsSync(vault.path)) throw new Error('Não há migração preparada');
  const tmp = vault.path + '.commit';
  writeFileSync(tmp, readFileSync(next), { mode: 0o600 });
  renameSync(tmp, vault.path);
  try { rmSync(next, { force: true }); } catch { /* a próxima abertura conclui a troca */ }
}

export function abortVaultMigration(vault: Vault) {
  const next = migrationPath(vault.path);
  rmSync(next, { force: true });
  rmSync(next + '.tmp', { force: true });
  rmSync(vault.path + '.commit', { force: true });
}

export function resumeVaultMigration(vault: Vault, secret: string) {
  const next = migrationPath(vault.path);
  if (!existsSync(next)) return false;
  try { Vault.openSealed(next, secret); }
  catch {
    if (existsSync(vault.path)) rmSync(next, { force: true });
    return false;
  }
  commitVaultMigration(vault);
  return true;
}

export function discardUnkeyedMigration(vault: Vault) {
  const next = migrationPath(vault.path);
  if (!existsSync(next) || !existsSync(vault.path)) return;
  rmSync(next, { force: true });
  rmSync(next + '.tmp', { force: true });
  rmSync(vault.path + '.commit', { force: true });
}
