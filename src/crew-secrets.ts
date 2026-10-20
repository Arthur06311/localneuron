import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Vault } from './vault.js';

function parseSecrets(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
  const secrets: Record<string, string> = {};
  for (const [id, token] of Object.entries(value)) {
    if (!/^[0-9a-f-]{36}$/.test(id) || typeof token !== 'string' || token.length < 1 || token.length > 500) throw new Error('invalid');
    secrets[id] = token;
  }
  return secrets;
}

/** Chaves de provedor cifradas com a chave de serviço do cofre. O texto limpo não vai para a base nem para o registo. */
export class CrewSecrets {
  private file: string;
  constructor(directory: string, private vault: Vault) {
    this.file = join(directory, 'crew-providers.enc.json');
  }
  private key() {
    return createHash('sha256').update(this.vault.key('service')).update('localneuron-crew-credentials-v1').digest();
  }
  private read() {
    if (!existsSync(this.file)) return {};
    try {
      const envelope = JSON.parse(readFileSync(this.file, 'utf8')) as { iv: string; tag: string; data: string };
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(envelope.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
      return parseSecrets(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8')));
    } catch (error) {
      if ((error as Error).message === 'Cofre bloqueado') throw error;
      throw new Error('Não foi possível abrir a chave deste provedor. Volte a guardá-la no cofre.');
    }
  }
  private write(secrets: Record<string, string>) {
    if (!Object.keys(secrets).length) {
      rmSync(this.file, { force: true });
      return;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(secrets)), cipher.final()]);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('base64') }), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
  has(id: string) {
    return Boolean(this.read()[id]);
  }
  /** null mantém; string vazia apaga. */
  put(id: string, token: string | null) {
    if (token === null) return;
    const secrets = this.read();
    if (!token) delete secrets[id];
    else secrets[id] = token;
    this.write(secrets);
  }
  remove(id: string) {
    const secrets = this.read();
    if (!secrets[id]) return;
    delete secrets[id];
    this.write(secrets);
  }
}
