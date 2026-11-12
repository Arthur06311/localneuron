import { setText, t } from './i18n.js';

/** Counts user sends in this browser. Hidden once it reaches the limit. */
export const CHAT_SENDS_KEY = 'localneuron-chat-sends';
export const CHAT_INPUT_HINT_LIMIT = 3;
export const CHAT_INPUT_HINT_ID = 'chat-input-hint';

export function sentCount(raw) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/** The shortcut hint stays off the empty welcome card and after three sends. */
export function inputHintVisible({ welcome = false, sent = 0 } = {}) {
  return welcome !== true && sentCount(sent) < CHAT_INPUT_HINT_LIMIT;
}

export function readStoredSends(storage) {
  try {
    return sentCount(storage?.getItem?.(CHAT_SENDS_KEY));
  } catch {
    return 0;
  }
}

export function recordSentMessage(storage) {
  const next = Math.min(readStoredSends(storage) + 1, CHAT_INPUT_HINT_LIMIT);
  try {
    storage?.setItem?.(CHAT_SENDS_KEY, String(next));
  } catch {
    /* Private mode can reject writes. The next draw reads whatever remains. */
  }
  return next;
}

function describedBy(input) {
  return String(input?.getAttribute?.('aria-describedby') || '');
}

/**
 * Shows the hint and points the input at it only while it is on screen.
 * A hidden hint is not a description, so screen readers are not sent to it.
 */
export function syncChatInputHint(input, hint, state = {}) {
  const visible = Boolean(hint) && inputHintVisible(state);
  if (hint) {
    hint.hidden = !visible;
    if (visible) {
      const next = t('chat.input.hint');
      if (hint.textContent !== next) setText(hint, 'chat.input.hint');
    } else if (hint.textContent) hint.textContent = '';
  }
  if (input && typeof input.setAttribute === 'function' && typeof input.removeAttribute === 'function') {
    const ids = describedBy(input)
      .split(/\s+/)
      .filter((id) => id && id !== CHAT_INPUT_HINT_ID);
    if (visible) ids.push(CHAT_INPUT_HINT_ID);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }
  return visible;
}
