export function editButton({ message, lastUserId, busy, pressed, label, icon }) {
  if (!message?.content || message.role !== 'user' || message.id !== lastUserId) return '';
  return `<button class="quiet" data-chat-edit="${message.id}"${busy ? ' disabled' : ''}${pressed ? ' aria-pressed="true"' : ''}>${icon}${label}</button>`;
}

export function beginMessageEdit(draft, message) {
  return { id: message.id, draft: String(draft ?? '') };
}

export function messageEditOnInput(editing, value) {
  if (!editing) return null;
  if (!String(value ?? '').trim()) return null;
  return editing;
}

export function messageEditDraft(editing) {
  return editing?.draft ?? '';
}
