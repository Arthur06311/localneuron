import { t } from './i18n.js';

export function dragCarriesFiles(transfer) {
  const types = transfer && transfer.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i += 1) if (types[i] === 'Files') return true;
  return false;
}

export function createChatDrop({
  doc = globalThis.document,
  isActive,
  isBlocked,
  onFiles,
}) {
  let depth = 0;
  let tracking = false;
  let dismissed = false;
  let overlay = null;
  let label = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = doc.createElement('div');
    overlay.id = 'chat-drop-overlay';
    overlay.className = 'chat-drop-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'status');
    label = doc.createElement('p');
    overlay.append(label);
    doc.body.append(overlay);
  }

  function paint() {
    const show = depth > 0 && !dismissed && Boolean(isActive()) && !isBlocked();
    if (!show) {
      if (overlay) overlay.hidden = true;
      return;
    }
    ensureOverlay();
    overlay.hidden = false;
    const text = t('assist.drop');
    if (label.textContent !== text) label.textContent = text;
  }

  function reset() {
    depth = 0;
    tracking = false;
    dismissed = false;
    paint();
  }

  function onEnter(event) {
    if (!isActive()) {
      reset();
      return;
    }
    const files = dragCarriesFiles(event.dataTransfer);
    if (!tracking && !files) return;
    tracking = true;
    event.preventDefault();
    depth += 1;
    paint();
  }

  function onOver(event) {
    if (!isActive()) {
      reset();
      return;
    }
    if (!tracking && !dragCarriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = isBlocked() ? 'none' : 'copy';
    paint();
  }

  function onLeave() {
    if (!isActive()) {
      reset();
      return;
    }
    if (!tracking) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      tracking = false;
      dismissed = false;
    }
    paint();
  }

  function onDrop(event) {
    if (!isActive()) {
      reset();
      return;
    }
    if (!tracking && !dragCarriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    const ignore = dismissed || isBlocked() || files.length === 0;
    reset();
    if (ignore) return;
    return onFiles(files);
  }

  function onKey(event) {
    if (event.key !== 'Escape' || depth === 0 || dismissed) return;
    dismissed = true;
    paint();
  }

  function onEnd() {
    reset();
  }

  doc.addEventListener('dragenter', onEnter, true);
  doc.addEventListener('dragover', onOver, true);
  doc.addEventListener('dragleave', onLeave, true);
  doc.addEventListener('drop', onDrop, true);
  doc.addEventListener('dragend', onEnd, true);
  doc.addEventListener('keydown', onKey);
}
