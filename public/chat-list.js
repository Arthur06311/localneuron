export function conversationGroups(chats, query = '', noModel = '') {
  const needle = String(query || '').toLocaleLowerCase();
  const filtered = (Array.isArray(chats) ? chats : []).filter((chat) =>
    String(chat?.title || '').toLocaleLowerCase().includes(needle),
  );
  const byRecent = (a, b) => (b.at || 0) - (a.at || 0);
  const groups = [];
  const pinned = filtered.filter((chat) => chat.pinned).sort(byRecent);
  if (pinned.length) groups.push({ id: 'pinned', pinned: true, items: pinned });
  const models = new Map();
  for (const chat of filtered.filter((item) => !item.pinned).sort(byRecent)) {
    const key =
      chat.preferred_model ||
      chat.messages?.findLast?.((message) => message.model)?.model ||
      noModel;
    if (!models.has(key)) models.set(key, []);
    models.get(key).push(chat);
  }
  for (const [id, items] of models) groups.push({ id, pinned: false, items });
  return groups;
}
