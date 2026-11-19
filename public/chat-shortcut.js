import { format } from './i18n.js';

export function usesCommandKey(nav = globalThis.navigator) {
  const platform = String(nav?.platform || '');
  const agent = String(nav?.userAgent || '');
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Macintosh|Mac OS X/.test(agent);
}

export function newConversationShortcutLabel(nav) {
  return usesCommandKey(nav) ? '⌘N' : 'Ctrl+N';
}

export function newConversationShortcutTitle(nav) {
  return format('chat.new.title', { shortcut: newConversationShortcutLabel(nav) });
}

export function isNewConversationShortcut(event, nav = globalThis.navigator) {
  if (!event || event.altKey || event.shiftKey) return false;
  if (String(event.key || '').toLowerCase() !== 'n') return false;
  if (usesCommandKey(nav)) return Boolean(event.metaKey) && !event.ctrlKey;
  return Boolean(event.ctrlKey) && !event.metaKey;
}

/** The palette is a div, not a <dialog>. Open means the root is shown. */
export function commandPaletteOpen(doc) {
  const palette = doc?.getElementById?.('command-palette');
  return Boolean(palette && palette.hidden === false);
}

export function newConversationShortcutBlocked(doc) {
  if (doc?.querySelector?.('dialog[open]')) return true;
  return commandPaletteOpen(doc);
}

export function runNewConversationShortcut(event, doc = globalThis.document, nav = globalThis.navigator) {
  if (!isNewConversationShortcut(event, nav) || newConversationShortcutBlocked(doc)) return false;
  const button = doc?.querySelector?.('[data-chat-new]');
  if (!button) return false;
  event.preventDefault();
  button.click();
  doc.querySelector('#chat-input')?.focus();
  return true;
}
