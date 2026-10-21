import { t } from './i18n.js';

const MODEL_SUFFIXES = [
  [' · MLX integrado', 'chat.model.mlxBuiltin'],
  [' · integrado', 'chat.model.builtin'],
  [' · pasta externa', 'chat.model.externalFolder'],
  [' · Rede EXO', 'chat.model.exoNetwork'],
];

export function chatModelLabel(name) {
  const text = String(name ?? '');
  for (const [suffix, key] of MODEL_SUFFIXES) {
    if (text.endsWith(suffix)) return text.slice(0, -suffix.length) + ' · ' + t(key);
  }
  return text;
}

export function writeChatModelLabel(node, name) {
  const label = chatModelLabel(name);
  if (node.textContent === label) return label;
  const create = node.ownerDocument?.createTextNode?.bind(node.ownerDocument);
  if (typeof node.replaceChildren === 'function' && typeof create === 'function') {
    node.replaceChildren(create(label));
    return label;
  }
  node.textContent = label;
  return label;
}
