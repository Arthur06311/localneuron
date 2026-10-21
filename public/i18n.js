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

export function resolveLocale({ query = '', storage = '', env = '', system = '', desktopLocale = '' } = {}) {
  const fromQuery = normalizeChoice(queryLang(query));
  if (fromQuery === 'pt-BR' || fromQuery === 'en') return fromQuery;
  const fromEnv = normalizeChoice(env);
  if (fromEnv === 'pt-BR' || fromEnv === 'en') return fromEnv;
  const saved = normalizeChoice(storage);
  if (saved === 'pt-BR' || saved === 'en') return saved;
  return localeFromLanguage(desktopLocale || system);
}

export function useLocale(locale) {
  active = locale === 'en' ? 'en' : 'pt-BR';
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

export function t(key, vars) {
  const translated = catalogs[active]?.[key];
  let text = translated ?? catalogs['pt-BR'][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
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
  doc.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.getAttribute('data-i18n')); });
  doc.querySelectorAll('[data-i18n-strong]').forEach(node => {
    const strong = node.querySelector('strong');
    if (strong) strong.textContent = t(node.getAttribute('data-i18n-strong'));
  });
  doc.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria'))); });
  doc.querySelectorAll('[data-i18n-title]').forEach(node => { node.setAttribute('title', t(node.getAttribute('data-i18n-title'))); });
  doc.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder'))); });
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
