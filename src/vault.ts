import { createCipheriv, createDecipheriv, randomBytes, scryptSync, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export class Vault {
  path: string;
  keys: Record<string, string> | null = null;
  constructor(dir: string) { mkdirSync(dir, { recursive: true, mode: 0o700 }); this.path = join(dir, 'vault.enc.json'); }
  get exists() { return existsSync(this.path); }
  get locked() { return this.keys === null; }
  initialize(password: string) {
    if (this.exists) throw new Error('Cofre já existe');
    if (password.length < 12) throw new Error('Use uma senha de pelo menos 12 caracteres');
    this.keys = {};
    const publics: Record<string, string> = {};
    for (const id of ['organization', 'human', 'agent', 'service']) {
      const pair = generateKeyPairSync('ed25519');
      this.keys[id] = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      publics[id] = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    }
    this.save(password); return publics;
  }
  unlock(password: string) {
    const envelope = JSON.parse(readFileSync(this.path, 'utf8'));
    const key = scryptSync(password, Buffer.from(envelope.salt, 'hex'), 32);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
    try { this.keys = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString()); }
    catch { throw new Error('Senha incorreta ou cofre danificado'); }
  }
  save(password: string) {
    const salt = randomBytes(16), iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(this.keys)), cipher.final()]);
    writeFileSync(this.path + '.tmp', JSON.stringify({ version: 1, salt: salt.toString('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('base64') }), { mode: 0o600 });
    renameSync(this.path + '.tmp', this.path);
  }
  key(id: string) { const key = this.keys?.[id]; if (!key) throw new Error('Cofre bloqueado'); return key; }
  lock() { this.keys = null; }
}
