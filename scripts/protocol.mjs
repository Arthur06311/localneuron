import { createHash, sign, verify, createPublicKey } from 'node:crypto';

export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  throw new Error('Valor não canônico');
}
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const signature = (value, key) => sign(null, Buffer.from(canonical(value)), key).toString('base64');
export function validSignature(value, sig, key) {
  try { return verify(null, Buffer.from(canonical(value)), key, Buffer.from(sig, 'base64')); } catch { return false; }
}
export const fingerprint = pem => hash(createPublicKey(pem).export({ type: 'spki', format: 'der' }).toString('base64'));

export function verifyPackage(bundle, trustedFingerprint) {
  let seq = 0;
  const fail = reason => ({ valid: false, seq: seq + 1, reason });
  try {
    if (!trustedFingerprint) return fail('Informe a impressão digital obtida por canal independente.');
    if (bundle.format !== 'colmeia.audit.v1') return fail('Formato desconhecido');
    if (fingerprint(bundle.root_public_key) !== trustedFingerprint) return fail('Raiz não confiável');
    if (!validSignature(bundle.manifest, bundle.manifest_signature, bundle.root_public_key)) return fail('Manifesto inválido');
    if (hash(bundle.identities) !== bundle.manifest.identities_hash) return fail('Identidades alteradas');
    let previous = '0'.repeat(64);
    let time = 0;
    for (const entry of bundle.entries) {
      const { entry_hash, author_signature, ...body } = entry;
      if (body.seq !== seq + 1 || body.prev_hash !== previous) return fail('Lacuna ou ordem divergente');
      if (body.log_id !== bundle.manifest.log_id) return fail('Espaço de trabalho divergente');
      if (!Number.isSafeInteger(body.at) || body.at < time) return fail('Tempo inválido');
      if (hash(body) !== entry_hash) return fail('Hash divergente');
      const actor = bundle.identities.find(i => i.id === body.author_id);
      if (!actor || (actor.revoked_seq !== null && body.seq >= actor.revoked_seq)) return fail('Autor ausente ou revogado');
      if (!validSignature(body, author_signature, actor.public_key)) return fail('Assinatura inválida');
      if (actor.kind === 'agent') {
        const grant = body.authorization;
        const human = bundle.identities.find(i => i.id === grant?.body?.human_id);
        if (!human || human.kind !== 'human' || human.id !== actor.owner_id) return fail('Responsável inválido');
        if (human.revoked_seq !== null && body.seq >= human.revoked_seq) return fail('Responsável revogado');
        if (!validSignature(grant.body, grant.signature, human.public_key)) return fail('Cossinatura inválida');
        if (grant.body.agent_id !== actor.id || grant.body.log_id !== body.log_id || grant.body.action_hash !== body.action_hash || grant.body.expires_at < body.at || grant.body.issued_at > body.at) return fail('Autorização fora do escopo');
      }
      previous = entry_hash; time = body.at; seq++;
    }
    if (seq !== bundle.manifest.head_seq || previous !== bundle.manifest.head_hash) return fail('Cabeça divergente: possível truncamento');
    return { valid: true, entries: seq, head_hash: previous, fingerprint: trustedFingerprint };
  } catch { return fail('Pacote malformado'); }
}
