import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replySpeed, replySpeedText } from '../public/reply-speed.js';

test('Mostra tokens e tokens por segundo só quando os dados existem', () => {
  assert.equal(replySpeed(null), null);
  assert.equal(replySpeed({ elapsed_ms: 2000 }), null);
  assert.equal(replySpeed({ completion_tokens: 0, elapsed_ms: 2000 }), null);
  assert.equal(replySpeed({ completion_tokens: 12, prompt_tokens: 40 }), null);
  assert.equal(replySpeed({ completion_tokens: 12, elapsed_ms: 0 }), null);
  assert.equal(replySpeed({ completion_tokens: 12, elapsed_ms: 50, content: 'texto sem contagem real' }).perSecond, 240);
  const estimated = replySpeed({ completion_tokens: 20, elapsed_ms: 2000, prompt_tokens: 8 });
  assert.deepEqual(estimated, { tokens: 20, perSecond: 10 });
  assert.equal(replySpeedText(estimated && { completion_tokens: 20, elapsed_ms: 2000 }), '<p class="answer-stats">20 tokens · 10 tokens/s</p>');
  const measured = replySpeed({ completion_tokens: 20, elapsed_ms: 10000, tokens_per_second: 12.54 });
  assert.equal(measured.perSecond, 12.54);
  assert.equal(replySpeedText({ completion_tokens: 20, elapsed_ms: 10000, tokens_per_second: 12.54 }), '<p class="answer-stats">20 tokens · 12,5 tokens/s</p>');
  assert.equal(replySpeedText({ prompt_tokens: 10, elapsed_ms: 1000 }), '');
  assert.equal(replySpeed({ completion_tokens: 4, elapsed_ms: 1, tokens_per_second: 100001 }).perSecond, 4000);
  assert.equal(replySpeed({ completion_tokens: 4, tokens_per_second: 100001 }), null);
});

test('O chat só insere a linha quando a função devolve texto', () => {
  const chat = readFileSync(new URL('../public/chat.js', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(chat, /replySpeedText\(m\.stats\)/);
  assert.match(server, /\/reply-speed\.js/);
});
