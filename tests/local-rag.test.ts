import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { chatContext, type ChatAttachment } from '../src/chat-context.js';
import { optionsSchema } from '../src/inference.js';
import { NO_EMBEDDING_MODEL, chunkPages, hasEmbeddingModel, hashEmbed, indexLocalAttachments, isIndexableAttachment } from '../src/local-rag.js';

function attachment(name: string, pages: { location: string; text: string }[]): ChatAttachment {
  return { id: crypto.randomUUID(), name, bytes: 32, pages, truncated: false };
}

test('Trechos de texto e PDF ficam no PGlite e a busca local não chama a rede', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rag-'));
  const store = new Store(dir);
  try {
    await store.init();
    const notes = attachment('notas.txt', [{ location: 'linhas 1–4', text: 'A feijoada do domingo leva feijão preto e laranja.' }]);
    const paper = attachment('artigo.pdf', [{ location: 'página 2', text: 'O telescópio apontou para a nebulosa de Órion.' }]);
    const image = attachment('foto.png', [{ location: 'imagem', text: 'isto não entra no índice' }]);
    assert.equal(isIndexableAttachment(image.name), false);
    assert.equal(hasEmbeddingModel([{ key: 'gguf:qwen' }]), false);
    assert.equal(hasEmbeddingModel([{ repo: 'org/nomic-embed-text' }]), true);
    const without = await indexLocalAttachments(store, 'chat-1', [notes, paper, image], [], 'feijoada');
    assert.equal(without.warning, NO_EMBEDDING_MODEL);
    assert.deepEqual(without.chunks, []);
    const stored = await store.db.query<{ name: string; embedding: unknown }>('SELECT name, embedding FROM attachment_chunks ORDER BY name');
    assert.deepEqual(stored.rows.map(row => row.name), ['artigo.pdf', 'notas.txt']);
    assert.equal(stored.rows.every(row => row.embedding === null), true);
    const withModel = await indexLocalAttachments(store, 'chat-1', [notes, paper], [{ display_name: 'embedding local' }], 'Conte a feijoada');
    assert.equal(withModel.warning, null);
    assert.equal(withModel.chunks[0].name, 'notas.txt');
    assert.match(withModel.chunks[0].text, /feijoada/);
    const options = optionsSchema.parse({});
    const message = { id: 'm', role: 'user' as const, content: 'Conte a feijoada', at: 0, status: 'complete' as const, attachments: [notes] };
    const context = chatContext([message], '', options, withModel);
    assert.match(context.messages[0].content, /\[fonte: notas\.txt — linhas 1–4\]/);
    assert.match(context.messages[0].content, /feijoada/);
    const unchanged = chatContext([{ ...message, content: 'Conte a feijoada' }], '', options);
    assert.equal(unchanged.messages[0].content.includes('TRECHOS LOCAIS'), false);
    assert.equal(/fetch\s*\(/.test(readFileSync('src/local-rag.ts', 'utf8')), false);
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => { calls += 1; return original(...args); }) as typeof fetch;
    try { hashEmbed('feijoada e telescópio'); } finally { globalThis.fetch = original; }
    assert.equal(calls, 0);
    assert.equal(hashEmbed('feijoada').length, 32);
    assert.ok(chunkPages([{ location: 'p', text: 'a'.repeat(1000) }]).length > 1);
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
