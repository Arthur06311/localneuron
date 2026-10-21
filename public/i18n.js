import ptBR from './i18n/pt-BR.js';
import en from './i18n/en.js';

export const LANGUAGE_KEY = 'localneuron-language';
const catalogs = { 'pt-BR': ptBR, en };
let active = 'pt-BR';

export function localeFromLanguage(language) {
  return String(language || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function normalizeChoice(value) {
  const raw = String(value || '').trim().toLowerCase().replaceAll('_', '-');
  if (raw === 'auto') return 'auto';
  if (raw === 'pt' || raw.startsWith('pt-')) return 'pt-BR';
  if (raw === 'en' || raw.startsWith('en-')) return 'en';
  return '';
}

function queryLang(query) {
  const text = String(query || '');
  const params = new URLSearchParams(text.startsWith('?') ? text.slice(1) : text);
  return params.get('lang') || '';
}

function chosenLocale(value) {
  const choice = normalizeChoice(value);
  if (choice === 'en') return 'en';
  if (choice === 'pt-BR') return 'pt-BR';
  return '';
}

export function resolveLocale({ query = '', storage = '', env = '', system = '', desktopLocale = '' } = {}) {
  const fromQuery = chosenLocale(queryLang(query));
  if (fromQuery === 'en') return 'en';
  if (fromQuery === 'pt-BR') return 'pt-BR';
  const fromEnv = chosenLocale(env);
  if (fromEnv === 'en') return 'en';
  if (fromEnv === 'pt-BR') return 'pt-BR';
  const saved = chosenLocale(storage);
  if (saved === 'en') return 'en';
  if (saved === 'pt-BR') return 'pt-BR';
  return localeFromLanguage(desktopLocale || system);
}

export function useLocale(locale) {
  if (locale === 'en') active = 'en';
  else active = 'pt-BR';
  return active;
}

export function currentLocale() {
  return active;
}

export function textLocale() {
  return active === 'en' ? 'en' : 'pt-BR';
}

export function languagePreference(storage) {
  const value = storage ?? (typeof localStorage === 'undefined' ? '' : localStorage.getItem(LANGUAGE_KEY) || '');
  const choice = normalizeChoice(value);
  return choice === 'pt-BR' || choice === 'en' || choice === 'auto' ? choice : 'auto';
}

export function saveLanguagePreference(value) {
  const stored = languagePreference(value);
  localStorage.setItem(LANGUAGE_KEY, stored);
  return stored;
}

function bundle() {
  if (active === 'en') return catalogs.en;
  return catalogs['pt-BR'];
}

function catalogText(key) {
  const primary = bundle()[key];
  if (typeof primary === 'string') return primary;
  const fallback = catalogs['pt-BR'][key];
  return typeof fallback === 'string' ? fallback : '';
}

export function t(key, vars) {
  let text = catalogText(key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value ?? ''));
  }
  return text;
}

export function applyDocument(doc = typeof document === 'undefined' ? undefined : document) {
  if (!doc?.documentElement) return active;
  doc.documentElement.lang = active;
  const title = doc.querySelector('title');
  if (title) title.textContent = t('meta.title');
  const description = doc.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t('meta.description'));
  const write = (node, attr, apply) => {
    const name = node.getAttribute(attr);
    if (typeof name !== 'string' || !Object.hasOwn(catalogs['pt-BR'], name)) return;
    const primary = bundle()[name];
    const text = typeof primary === 'string' ? primary : catalogs['pt-BR'][name];
    if (typeof text === 'string') apply(text);
  };
  doc.querySelectorAll('[data-i18n]').forEach(node => { write(node, 'data-i18n', text => { node.textContent = text; }); });
  doc.querySelectorAll('[data-i18n-strong]').forEach(node => {
    const strong = node.querySelector('strong');
    if (strong) write(node, 'data-i18n-strong', text => { strong.textContent = text; });
  });
  doc.querySelectorAll('[data-i18n-aria]').forEach(node => { write(node, 'data-i18n-aria', text => { node.setAttribute('aria-label', text); }); });
  doc.querySelectorAll('[data-i18n-title]').forEach(node => { write(node, 'data-i18n-title', text => { node.setAttribute('title', text); }); });
  doc.querySelectorAll('[data-i18n-placeholder]').forEach(node => { write(node, 'data-i18n-placeholder', text => { node.setAttribute('placeholder', text); }); });
  return active;
}

function browserSources() {
  if (typeof window === 'undefined') return null;
  return {
    query: window.location?.search || '',
    storage: window.localStorage?.getItem(LANGUAGE_KEY) || '',
    env: window.colmeiaDesktop?.lang || '',
    system: window.navigator?.language || '',
    desktopLocale: window.colmeiaDesktop?.locale || '',
  };
}

const browser = browserSources();
if (browser) useLocale(resolveLocale(browser));
