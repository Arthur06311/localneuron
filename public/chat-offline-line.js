import { setText, t } from './i18n.js';

export function writeChatOfflineLine(node) {
  if (!node) return '';
  const next = t('chat.welcome.offline');
  if (node.textContent !== next) setText(node, 'chat.welcome.offline');
  return next;
}
