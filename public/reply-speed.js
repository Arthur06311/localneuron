function formatRate(value) {
  const text = (Math.round(value * 10) / 10).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text.replace('.', ',');
}

export function replySpeed(stats) {
  if (!stats) return null;
  const tokens = Number.isSafeInteger(stats.completion_tokens) && stats.completion_tokens > 0 ? stats.completion_tokens : null;
  if (!tokens) return null;
  const engine = typeof stats.tokens_per_second === 'number' && Number.isFinite(stats.tokens_per_second) && stats.tokens_per_second > 0 && stats.tokens_per_second <= 100000 ? stats.tokens_per_second : null;
  const elapsed = typeof stats.elapsed_ms === 'number' && Number.isFinite(stats.elapsed_ms) && stats.elapsed_ms > 0 ? stats.elapsed_ms : null;
  const perSecond = engine ?? (elapsed ? tokens / (elapsed / 1000) : null);
  if (!perSecond || !Number.isFinite(perSecond) || perSecond <= 0 || perSecond > 100000) return null;
  return { tokens, perSecond };
}

export function replySpeedText(stats) {
  const speed = replySpeed(stats);
  if (!speed) return '';
  return `<p class="answer-stats">${speed.tokens} tokens · ${formatRate(speed.perSecond)} tokens/s</p>`;
}
