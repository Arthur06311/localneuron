// Public publishable key (not a JWT). The neuralgames_waitlist table is insert-only via RLS.
// These constants are set for the live table. Send only the apikey header — do not send Authorization: Bearer.
const SUPABASE_URL = 'https://hifnfveklpskbtxyeqza.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0H8d0YjfQ42TqlYKMlxkGQ_wZYy22Nm';
const WAITLIST_TABLE = 'neuralgames_waitlist';

const SITE_LANGS = ['pt', 'en', 'es', 'fr', 'de', 'ja', 'zh'];

const copy = {
  pt: {
    skip: 'Ir ao conteúdo',
    navLabel: 'Navegação',
    navHome: 'Início',
    language: 'Idioma',
    languageAuto: 'Automático',
    title: 'NeuralGames: um motor de jogos feito para IAs — LocalNeuron',
    description: 'O NeuralGames é um motor onde a IA cria jogos 2D e 3D chamando ferramentas, e você vê o jogo nascer na prévia.',
    eyebrow: 'Novo · em teste',
    headline: 'Dê à sua IA um motor de jogos.',
    sub: 'O NeuralGames é um motor onde a IA cria jogos 2D e 3D chamando ferramentas, e você vê o jogo nascer na prévia.',
    previewLabel: 'Prévia',
    previewStatus: '✓ prévia atualizada',
    previewCode: '› create_entity(papel="inimigo", x=13, y=3)',
    howTitle: 'Como funciona',
    step1: 'Conecte sua IA. O NeuralGames fala MCP, o protocolo que as IAs usam para chamar ferramentas.',
    step2: 'A IA monta o jogo. Mapa, jogador, inimigos, itens, som e efeitos, peça por peça, num documento de jogo.',
    step3: 'Você joga. A prévia mostra o resultado na hora, e cada jogo fica salvo na sua biblioteca.',
    featuresTitle: 'O que já dá pra fazer',
    feature1: 'Jogos 2D e 3D no mesmo motor.',
    feature2: 'Três controles: de lado (plataforma), 8 direções e volante (corrida).',
    feature3: 'Física, pulo, colisão e dano.',
    feature4: 'Inimigos que contornam paredes.',
    feature5: 'Biblioteca com seus jogos e link para jogar.',
    whyTitle: 'Por que um motor para IA',
    why: 'Em vez de a IA escrever um jogo inteiro do zero, ela usa ferramentas prontas, e por isso consegue ir mais longe sem se perder.',
    waitTitle: 'Quer testar primeiro? Entre na lista e avisamos quando abrir.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'seu@email.com',
    submit: 'Entrar na lista',
    consent: 'Usamos seu e-mail só para avisar sobre o NeuralGames.',
    success: 'Pronto! Você está na lista. Avisamos quando abrir.',
    duplicate: 'Esse e-mail já está na lista.',
    invalid: 'Confira o e-mail e tente de novo.',
    error: 'Não deu certo agora. Tente de novo em instantes.',
    note: 'Em teste. Recursos podem mudar.',
    brand: 'NeuralGames é o primeiro produto da LocalNeuron para dar mais poder às IAs.',
    privacy: 'Idioma e privacidade'
  },
  en: {
    skip: 'Skip to content',
    navLabel: 'Navigation',
    navHome: 'Home',
    language: 'Language',
    languageAuto: 'Automatic',
    title: 'NeuralGames: a game engine made for AIs — LocalNeuron',
    description: 'NeuralGames is an engine where AI builds 2D and 3D games by calling tools, and you watch the game come to life in the preview.',
    eyebrow: 'New · in testing',
    headline: 'Give your AI a game engine.',
    sub: 'NeuralGames is an engine where AI builds 2D and 3D games by calling tools, and you watch the game come to life in the preview.',
    previewLabel: 'Preview',
    previewStatus: '✓ preview updated',
    previewCode: '› create_entity(papel="inimigo", x=13, y=3)',
    howTitle: 'How it works',
    step1: 'Connect your AI. NeuralGames speaks MCP, the protocol AIs use to call tools.',
    step2: 'The AI builds the game piece by piece: map, player, enemies, items, sound and effects, in a game document.',
    step3: 'You play it. The preview shows the result right away, and every game is saved in your library.',
    featuresTitle: 'What you can already do',
    feature1: '2D and 3D games in the same engine.',
    feature2: 'Three controls: side-view (platformer), 8-direction and steering (racing).',
    feature3: 'Physics, jumping, collision and damage.',
    feature4: 'Enemies that path around walls.',
    feature5: 'A library with your games and a link to play.',
    whyTitle: 'Why an engine for AI',
    why: 'Instead of writing a whole game from scratch, the AI uses ready-made tools, so it can go further without getting lost.',
    waitTitle: "Want early access? Join the list and we'll let you know.",
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    submit: 'Join the waitlist',
    consent: "We'll only use your email to tell you about NeuralGames.",
    success: "You're on the list. We'll let you know when it opens.",
    duplicate: 'This email is already on the list.',
    invalid: 'Check your email and try again.',
    error: 'Something went wrong. Please try again in a moment.',
    note: 'In testing. Features may change.',
    brand: "NeuralGames is LocalNeuron's first product for giving AIs more power.",
    privacy: 'Language and privacy'
  }
};

function storedPreference() {
  let preference = 'auto';
  try { preference = localStorage.getItem('localneuron-language') || 'auto'; } catch (e) {}
  return SITE_LANGS.includes(preference) || preference === 'auto' ? preference : 'auto';
}

function browserLanguage() {
  const list = navigator.languages || [navigator.language || 'en'];
  return list.map(function (tag) { return String(tag).toLowerCase().split('-')[0]; }).find(function (tag) { return SITE_LANGS.includes(tag); }) || 'en';
}

function contentLanguage(preference) {
  const tag = preference === 'auto' ? browserLanguage() : preference;
  return tag === 'pt' ? 'pt' : 'en';
}

function pageLangCode(language) {
  return language === 'pt' ? 'pt-BR' : 'en';
}

function validEmail(value) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function duplicateResponse(status, payload) {
  if (status === 409) return true;
  const code = payload && payload.code;
  return code === '23505' || code === 23505;
}

const form = document.getElementById('ng-form');
const input = document.getElementById('ng-email');
const button = form.querySelector('button[type="submit"]');
const statusEl = document.getElementById('ng-status');
const languageSelect = document.getElementById('language');
let preference = storedPreference();
let language = contentLanguage(preference);
let statusKey = '';
let sending = false;

function text() {
  return copy[language];
}

function showStatus(key) {
  statusKey = key;
  const positive = key === 'success' || key === 'duplicate';
  statusEl.textContent = key ? text()[key] : '';
  statusEl.className = 'ng-status' + (key ? (positive ? ' is-positive' : ' is-error') : '');
}

function apply(nextPreference) {
  preference = nextPreference;
  language = contentLanguage(preference);
  const strings = text();
  document.documentElement.lang = pageLangCode(language);
  document.title = strings.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', strings.description);
  ['og:title', 'twitter:title'].forEach(function (name) {
    const meta = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
    if (meta) meta.setAttribute('content', strings.title);
  });
  ['og:description', 'twitter:description'].forEach(function (name) {
    const meta = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
    if (meta) meta.setAttribute('content', strings.description);
  });
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    const value = strings[el.dataset.i18n];
    if (value) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    const value = strings[el.dataset.i18nPlaceholder];
    if (value) el.setAttribute('placeholder', value);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
    const value = strings[el.dataset.i18nAria];
    if (value) el.setAttribute('aria-label', value);
  });
  languageSelect.setAttribute('aria-label', strings.language);
  const autoOption = languageSelect.querySelector('option[value="auto"]');
  if (autoOption) autoOption.textContent = strings.languageAuto;
  languageSelect.value = preference;
  if (statusKey) showStatus(statusKey);
}

languageSelect.addEventListener('change', function () {
  preference = languageSelect.value;
  try {
    if (preference === 'auto') localStorage.removeItem('localneuron-language');
    else localStorage.setItem('localneuron-language', preference);
  } catch (e) {}
  apply(preference);
});

input.addEventListener('input', function () {
  input.removeAttribute('aria-invalid');
  if (statusKey === 'invalid') showStatus('');
});

form.addEventListener('submit', function (event) {
  event.preventDefault();
  const email = input.value.trim();
  if (!validEmail(email)) {
    input.setAttribute('aria-invalid', 'true');
    showStatus('invalid');
    return;
  }
  input.removeAttribute('aria-invalid');
  if (sending) return;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !WAITLIST_TABLE) {
    showStatus('error');
    return;
  }
  sending = true;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  fetch(SUPABASE_URL + '/rest/v1/' + WAITLIST_TABLE, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      email: email,
      lang: pageLangCode(language),
      source: 'neuralgames-page'
    })
  }).then(function (response) {
    if (response.status === 201) {
      showStatus('success');
      return;
    }
    return response.json().catch(function () { return null; }).then(function (payload) {
      if (duplicateResponse(response.status, payload)) showStatus('duplicate');
      else showStatus('error');
    });
  }).catch(function () {
    showStatus('error');
  }).then(function () {
    sending = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  });
});

apply(preference);
