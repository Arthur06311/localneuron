import { docCopy } from './doc-copy.js';
let pref = 'pt';
try { pref = localStorage.getItem('localneuron-language') || 'pt'; } catch {}
const copy = docCopy[pref];
if (copy) {
  const lang = pref === 'zh' ? 'zh-CN' : pref;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const text = copy[el.dataset.i18n];
    if (!text) continue;
    el.innerHTML = text;
    el.lang = lang;
  }
}
