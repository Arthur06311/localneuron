import type { ChatAttachment } from './chat-context.js';
import type { Store } from './store.js';

export const NO_EMBEDDING_MODEL = 'Não há um modelo de embeddings instalado neste computador. Os trechos do anexo foram guardados localmente, mas a busca semântica não está disponível.';

export type EmbeddingModelRef = { key?: string; display_name?: string; repo?: string };
export type LocalChunk = { name: string; location: string; text: string };
export type LocalRagContext = { chunks: LocalChunk[]; warning: string | null };

const DIMENSIONS = 32;

export function isIndexableAttachment(name: string) {
  return /\.(txt|md|markdown|pdf)$/i.test(name);
}

export function hasEmbeddingModel(models: EmbeddingModelRef[]) {
  return models.some(model => /embed/i.test(`${model.key || ''} ${model.display_name || ''} ${model.repo || ''}`));
}

export function hashEmbed(text: string) {
  const vector = Array.from({ length: DIMENSIONS }, () => 0);
  for (const token of text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) || []) {
    let hash = 2166136261;
    for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    vector[Math.abs(hash) % DIMENSIONS] += hash & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map(value => value / norm);
}

export function chunkPages(pages: { location: string; text: string }[], size = 800, overlap = 120) {
  const chunks: { location: string; text: string }[] = [];
  for (const page of pages) {
    if (!page.text) continue;
    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(page.text.length, start + size);
      chunks.push({ location: page.location, text: page.text.slice(start, end) });
      if (end === page.text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  return chunks;
}

function cosine(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index++) score += left[index] * right[index];
  return score;
}

async function withStore<T>(store: Store, operation: (db: Store['db']) => Promise<T>) {
  const next = store.queue.then(() => operation(store.db));
  store.queue = next.then(() => {}, () => {});
  return next;
}

export async function indexLocalAttachments(store: Store, chatId: string, attachments: ChatAttachment[], models: EmbeddingModelRef[], question: string): Promise<LocalRagContext> {
  const indexable = attachments.filter(attachment => isIndexableAttachment(attachment.name));
  if (!indexable.length) return { chunks: [], warning: null };
  const embed = hasEmbeddingModel(models);
  await withStore(store, db => db.transaction(async tx => {
    for (const attachment of indexable) {
      await tx.query('DELETE FROM attachment_chunks WHERE attachment_id = $1', [attachment.id]);
      const pieces = chunkPages(attachment.pages);
      for (const [index, piece] of pieces.entries()) {
        await tx.query(
          'INSERT INTO attachment_chunks (id, chat_id, attachment_id, name, location, chunk_index, text, embedding) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)',
          [`${attachment.id}:${index}`, chatId, attachment.id, attachment.name, piece.location, index, piece.text, embed ? JSON.stringify(hashEmbed(piece.text)) : null],
        );
      }
    }
  }));
  if (!embed) return { chunks: [], warning: NO_EMBEDDING_MODEL };
  const stored = await withStore(store, db => db.query<{ name: string; location: string; text: string; embedding: number[] | string }>('SELECT name, location, text, embedding FROM attachment_chunks WHERE chat_id = $1 AND embedding IS NOT NULL', [chatId]));
  const query = hashEmbed(question);
  const ranked = stored.rows.map(row => {
    const embedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) as number[] : row.embedding;
    return { name: row.name, location: row.location, text: row.text, score: cosine(query, embedding) };
  }).sort((left, right) => right.score - left.score);
  return { chunks: ranked.filter(row => row.score > 0.05).slice(0, 4).map(({ name, location, text }) => ({ name, location, text })), warning: null };
}
