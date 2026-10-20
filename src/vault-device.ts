import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Core } from './core.js';
import { abortVaultMigration, discardUnkeyedMigration, migrationPath, resumeVaultMigration } from './vault-migration.js';
import { beginFreshDeviceSpace, vaultAccepts } from './vault-fresh.js';

type Warn = (message: string) => void;
type VaultKeyModule = {
  hasKey: (directory: string) => boolean;
  createSecret: () => string;
  storeKey: (input: { directory: string; secret: string; safeStorage: null; warn?: Warn }) => string;
  loadKey: (input: { directory: string; safeStorage: null }) => string | null;
  removeKey: (directory: string) => void;
  removeLegacyAccess: (directory: string) => void;
};

const vaultKey = createRequire(import.meta.url)('../../desktop/vault-key.cjs') as VaultKeyModule;

export async function openCoreWithSecret(core: Core, secret: string) {
  if (!(await core.status()).initialized) await core.setup(secret);
  else if (core.vault.locked) await core.unlock(secret);
}

async function openFreshSpace(core: Core, directory: string, warn: Warn) {
  const secret = vaultKey.createSecret();
  vaultKey.storeKey({ directory, secret, safeStorage: null, warn });
  try { await beginFreshDeviceSpace(core, secret); }
  catch (error) {
    if (!vaultAccepts(core.vault.path, secret)) vaultKey.removeKey(directory);
    throw error;
  }
}

export async function adoptDeviceVault(core: Core, warn: Warn = console.warn) {
  const directory = core.directory;
  if (!vaultKey.hasKey(directory)) discardUnkeyedMigration(core.vault);
  if (!core.vault.exists && !vaultKey.hasKey(directory)) {
    const secret = vaultKey.createSecret();
    vaultKey.storeKey({ directory, secret, safeStorage: null, warn });
    try { await openCoreWithSecret(core, secret); }
    catch (error) { vaultKey.removeKey(directory); throw error; }
    return;
  }
  if (!vaultKey.hasKey(directory)) {
    if (core.vault.exists && core.vault.locked) await openFreshSpace(core, directory, warn);
    return;
  }
  let secret: string | null;
  try { secret = vaultKey.loadKey({ directory, safeStorage: null }); }
  catch { return; }
  if (!secret) return;
  if (existsSync(migrationPath(core.vault.path)) && !resumeVaultMigration(core.vault, secret)) abortVaultMigration(core.vault);
  await openCoreWithSecret(core, secret);
  vaultKey.removeLegacyAccess(directory);
}
