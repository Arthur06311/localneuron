const BUSY = new Set(['downloading', 'verifying', 'importing', 'indexing', 'downloaded']);
const READY = new Set(['downloaded', 'installed']);

export const USUAL_READY_TOAST = 'Pronto.';

export function isLocalInstalled(model) {
  const key = model?.key;
  return typeof key === 'string' && key !== '' && !key.startsWith('exo:');
}

function previousState(beforeJobs, id) {
  if (!beforeJobs) return '';
  if (typeof beforeJobs.get === 'function') return beforeJobs.get(id) || '';
  return beforeJobs[id] || '';
}

/** Um download acabou de deixar um modelo local instalado. Vazio se nada mudou, ou se mais de um terminou junto. */
export function planLocalInstallArrival({ beforeInstalled, afterInstalled, beforeJobs, afterCatalog, page } = {}) {
  const beforeLocal = new Set((beforeInstalled || []).filter(isLocalInstalled).map(model => model.key));
  const afterByKey = new Map((afterInstalled || []).filter(isLocalInstalled).map(model => [model.key, model]));
  const ready = [];
  for (const card of afterCatalog || []) {
    const previous = previousState(beforeJobs, card?.id);
    const next = card?.job?.state || '';
    if (!previous || previous === next || !BUSY.has(previous) || !READY.has(next)) continue;
    const key = card.local_key;
    if (!key || !afterByKey.has(key) || beforeLocal.has(key)) continue;
    const installed = afterByKey.get(key);
    ready.push({ key, name: installed.display_name || card.name || key });
  }
  if (ready.length !== 1) return null;
  const model = ready[0];
  if (beforeLocal.size > 0) return { kind: 'toast', modelKey: model.key };
  const onLibrary = page === 'models';
  const onChat = page === 'chat';
  return {
    kind: 'first',
    modelKey: model.key,
    modelName: model.name,
    openChat: onLibrary,
    focus: onLibrary || onChat,
  };
}

export function localInstallEffects(plan, effects) {
  if (!plan || !effects) return;
  if (plan.kind === 'toast') {
    effects.toast(USUAL_READY_TOAST);
    return;
  }
  if (plan.kind !== 'first') return;
  effects.selectModel(plan.modelKey, plan.modelName);
  if (plan.openChat) effects.openChat(plan.modelKey, plan.modelName);
  if (plan.focus) effects.focusComposer();
  effects.toast(effects.readyMessage());
}
