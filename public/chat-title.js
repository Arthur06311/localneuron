import { format, t } from './i18n.js';

export function conversationWindowTitle(name) {
  const title = String(name ?? '').trim();
  if (!title) return t('chat.title.app');
  return format('chat.title.conversation', { name: title });
}

export function pendingReplyIds(chats) {
  const ids = new Set();
  for (const chat of chats || []) {
    for (const message of chat?.messages || []) {
      if (message?.status === 'pending' && message.id) ids.add(message.id);
    }
  }
  return ids;
}

export function replyFinished(previousIds, chats, { focused = true } = {}) {
  const pendingIds = pendingReplyIds(chats);
  let finished = false;
  for (const id of previousIds || []) {
    if (!pendingIds.has(id)) finished = true;
  }
  return { pendingIds, finished, justFinishedUnfocused: finished && focused === false };
}

export function displayTitle({ conversationTitle = '', responseReady = false } = {}) {
  if (responseReady) return t('chat.title.ready');
  return conversationWindowTitle(conversationTitle);
}

export function createWindowTitle() {
  let pendingIds = new Set();
  let responseReady = false;
  let titledId;
  let titledName = '';

  function currentTitle() {
    return displayTitle({ conversationTitle: titledName, responseReady });
  }

  return {
    update({ chats, conversation, focused }) {
      const step = replyFinished(pendingIds, chats, { focused });
      pendingIds = step.pendingIds;
      const id = conversation?.id ?? null;
      const name = String(conversation?.title ?? '');
      const changed = titledId !== undefined && (id !== titledId || name !== titledName);
      if (changed) responseReady = false;
      else if (step.justFinishedUnfocused) responseReady = true;
      else if (focused) responseReady = false;
      titledId = id;
      titledName = name;
      return { title: currentTitle(), responseReady };
    },
    clearReady() {
      responseReady = false;
      return { title: currentTitle(), responseReady };
    },
  };
}
