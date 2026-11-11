import { t } from './i18n.js';

/** True when Chat has no model selected to load. */
export function noModelLoaded(key) {
  return !String(key ?? '').trim();
}

function knownBytes(value) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : null;
}

/** Byte size already stored on the model or its catalog card. Missing size stays unknown. */
export function modelByteSize(model, catalog = []) {
  const direct = knownBytes(model?.size_bytes) ?? knownBytes(model?.bytes);
  if (direct) return direct;
  const part = knownBytes(model?.files?.[0]?.bytes);
  if (part) return part;
  const key = model?.key || model?.local_key || model?.id;
  const card = (catalog || []).find(
    (item) => item && (item.local_key === key || item.id === key || item.job?.model_key === key),
  );
  return knownBytes(card?.bytes) ?? knownBytes(card?.files?.[0]?.bytes);
}

function modelGroup(model) {
  const key = String(model?.key || model?.local_key || '');
  if (key.startsWith('exo:') || model?.external) return 2;
  if (model?.local_key || key.startsWith('gguf:') || key.startsWith('mlx:') || knownBytes(model?.size_bytes) != null)
    return 0;
  return 1;
}

/**
 * Local models already on this computer come first, smallest real size first.
 * Entries that are not on this computer yet follow. Network entries stay last. Unknown sizes stay at the end of their group.
 */
export function sortSmallLocalFirst(models, catalog = []) {
  const rows = Array.isArray(models) ? [...models] : [];
  const name = (model) => String(model?.display_name || model?.name || model?.key || model?.id || '');
  rows.sort((a, b) => {
    const group = modelGroup(a) - modelGroup(b);
    if (group) return group;
    const size =
      (modelByteSize(a, catalog) ?? Number.MAX_SAFE_INTEGER) -
      (modelByteSize(b, catalog) ?? Number.MAX_SAFE_INTEGER);
    if (size) return size;
    return name(a).localeCompare(name(b), 'pt-BR');
  });
  return rows;
}

export function noModelLoadedHtml(escapeHtml, { hidden = false } = {}) {
  const enc = typeof escapeHtml === 'function' ? escapeHtml : (value) => String(value ?? '');
  return `<div id="chat-no-model" class="notice warn chat-no-model" role="status"${hidden ? ' hidden' : ''}><p>${enc(t('chat.noModelLoaded'))}</p><button type="button" class="secondary" data-chat-choose-model>${enc(t('chat.chooseModel'))}</button></div>`;
}
