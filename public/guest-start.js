import { t } from './i18n.js';
import { isAdvancedModel } from './crew-mascots.js';

export const GUEST_START_KEY = 'localneuron-guest-start';

const PROMPTS = {
  summarize: () => ({
    label: t('guest.start.summarize.label'),
    hint: t('guest.start.summarize.hint'),
    prompt: t('guest.start.summarize.prompt'),
  }),
  email: () => ({
    label: t('guest.start.email.label'),
    hint: t('guest.start.email.hint'),
    prompt: t('guest.start.email.prompt'),
  }),
  explain: () => ({
    label: t('guest.start.explain.label'),
    hint: t('guest.start.explain.hint'),
    prompt: t('guest.start.explain.prompt'),
  }),
};

export function guestStartState(value) {
  return value === 'dismissed' || value === 'used' ? value : '';
}

export function conversationStarted(chats) {
  return Array.isArray(chats) && chats.some((chat) => Array.isArray(chat?.messages) && chat.messages.length > 0);
}

export function showGuestStart({ state = '', messages = [], chats = [] } = {}) {
  if (guestStartState(state)) return false;
  if (conversationStarted(chats)) return false;
  if (Array.isArray(messages) && messages.length > 0) return false;
  return true;
}

export function guestStartNext(state, { chats = [], dismiss = false } = {}) {
  const current = guestStartState(state);
  if (current) return current;
  if (dismiss) return 'dismissed';
  if (conversationStarted(chats)) return 'used';
  return '';
}

function rankSmallLocal(installed, catalog) {
  const rows = [];
  for (const model of installed || []) {
    if (!model?.key) continue;
    const card = (catalog || []).find((item) => item.local_key === model.key || item.id === model.key);
    const parameters = card?.parameters_b ?? null;
    if (isAdvancedModel(model.key, parameters)) continue;
    const known = parameters != null && Number.isFinite(Number(parameters));
    rows.push({
      key: model.key,
      name: String(model.display_name || card?.name || model.key),
      parameters_b: known ? Number(parameters) : Number.POSITIVE_INFINITY,
      size_bytes: Number(model.size_bytes) || Number.MAX_SAFE_INTEGER,
    });
  }
  rows.sort(
    (a, b) =>
      a.parameters_b - b.parameters_b ||
      a.size_bytes - b.size_bytes ||
      a.name.localeCompare(b.name, 'pt-BR'),
  );
  return rows;
}

/** Menor modelo local. Rede distribuída e modelos de 70B ou mais ficam de fora. */
export function modelForGuestStart({ installed = [], catalog = [] } = {}) {
  const small = rankSmallLocal(installed, catalog);
  if (small[0]?.key) return small[0].key;
  const locals = (installed || []).filter((model) => model?.key && !String(model.key).startsWith('exo:'));
  locals.sort(
    (a, b) =>
      (Number(a.size_bytes) || Number.MAX_SAFE_INTEGER) - (Number(b.size_bytes) || Number.MAX_SAFE_INTEGER) ||
      String(a.display_name || a.key).localeCompare(String(b.display_name || b.key), 'pt-BR'),
  );
  return locals[0]?.key || '';
}

export function guestStartPrompt(id) {
  const read = PROMPTS[id];
  return read ? read().prompt : '';
}

export function guestStartHtml(escape) {
  const enc = typeof escape === 'function' ? escape : (value) => String(value ?? '');
  const prompts = Object.keys(PROMPTS)
    .map((id) => {
      const copy = PROMPTS[id]();
      return `<button type="button" class="guest-start-prompt" data-guest-start="${id}" aria-describedby="guest-start-${id}-hint"><strong>${enc(copy.label)}</strong><small id="guest-start-${id}-hint">${enc(copy.hint)}</small></button>`;
    })
    .join('');
  return `<section class="guest-start" role="region" aria-labelledby="guest-start-title"><div class="guest-start-head"><div><span class="eyebrow">${enc(t('guest.start.eyebrow'))}</span><h3 id="guest-start-title">${enc(t('guest.start.title'))}</h3><p>${enc(t('guest.start.body'))}</p></div><button type="button" class="guest-start-close" data-guest-start-close aria-label="${enc(t('guest.start.close'))}">×</button></div><div class="guest-start-prompts">${prompts}</div><p class="guest-start-note">${enc(t('guest.start.note'))}</p></section>`;
}
