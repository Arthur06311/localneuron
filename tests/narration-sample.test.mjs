import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useLocale } from '../public/i18n.js';
import {
  NARRATION_INTRO_KEY,
  NARRATION_SAMPLE_TEXT,
  NARRATION_VOICE_KEY,
  hasSavedNarrationVoice,
  markNarrationIntro,
  narrationFamiliar,
  narrationIntroMode,
  narrationSampleMarkup,
  narrationSettingsCopy,
  narrationSettingsMarkup,
  narrationSettingsPlatform,
} from '../public/narration-sample.js';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function memory(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

const readyVoice = {
  ready: true,
  portuguese: true,
  available: true,
  engine: 'macos-say',
  id: 'Luciana',
  name: 'Luciana',
  voices: [{ id: 'Luciana', name: 'Luciana', language: 'pt_BR', brazilian: true }],
};

test('a amostra em pt-BR dura cerca de 5 segundos e não sai do computador', () => {
  const words = NARRATION_SAMPLE_TEXT.split(/\s+/).filter(Boolean);
  assert.ok(words.length >= 12 && words.length <= 16, words.join(' '));
  assert.match(NARRATION_SAMPLE_TEXT, /português do Brasil/);
  assert.equal(NARRATION_SAMPLE_TEXT.includes('<'), false);
  assert.equal(/https?:|openai|eleven/i.test(NARRATION_SAMPLE_TEXT), false);
});

test('a amostra só aparece no primeiro uso da narração', () => {
  const fresh = memory();
  assert.equal(narrationFamiliar(fresh), false);
  assert.equal(narrationIntroMode(fresh, readyVoice), 'sample');
  markNarrationIntro(fresh, 'heard');
  assert.equal(narrationIntroMode(fresh, readyVoice), 'ready');
  const used = memory({ [NARRATION_INTRO_KEY]: 'used' });
  markNarrationIntro(used, 'heard');
  assert.equal(used.getItem(NARRATION_INTRO_KEY), 'used');
  assert.equal(narrationIntroMode(used, readyVoice), 'ready');
  assert.equal(narrationIntroMode(memory({ [NARRATION_VOICE_KEY]: 'Luciana' }), readyVoice), 'sample');
  assert.equal(narrationIntroMode(memory(), readyVoice, true), 'ready');
  assert.equal(hasSavedNarrationVoice(memory({ [NARRATION_VOICE_KEY]: 'Luciana' })), true);
  assert.equal(hasSavedNarrationVoice(memory({ [NARRATION_VOICE_KEY]: 'faber-pt-br' })), true);
  assert.equal(hasSavedNarrationVoice(memory()), false);
});

test('sem voz pt-BR a dica aponta para as definições do macOS ou do Windows', () => {
  const storage = memory();
  const macos = { ...readyVoice, ready: false, portuguese: false, voices: [] };
  const windows = { ...macos, engine: 'windows-sapi' };
  const linux = { ...macos, engine: 'linux-speech-dispatcher' };
  const broken = { ...macos, available: false, engine: 'macos-say' };
  assert.equal(narrationSettingsPlatform('macos-say'), 'macos');
  assert.equal(narrationSettingsPlatform('windows-sapi'), 'windows');
  assert.equal(narrationIntroMode(storage, macos), 'settings');
  assert.equal(narrationIntroMode(storage, windows), 'settings');
  assert.equal(narrationIntroMode(storage, linux), 'settings');
  assert.equal(narrationIntroMode(storage, broken), 'blocked');
  assert.match(narrationSettingsCopy('macos'), /Acessibilidade/);
  assert.match(narrationSettingsCopy('macos'), /Conteúdo falado/);
  assert.match(narrationSettingsCopy('windows'), /Hora e idioma/);
  const hint = narrationSettingsMarkup(escapeHtml, 'windows', 'A voz encontrada é de Portugal.');
  assert.match(hint, /Hora e idioma/);
  assert.match(hint, /Portugal/);
  assert.match(hint, /role="status"/);
  assert.equal(hint.includes('<script'), false);
});

test('o cartão Ouvir amostra escapa o nome da voz e traduz o botão', () => {
  useLocale('pt-BR');
  const card = narrationSampleMarkup(escapeHtml, 'Luciana <img>');
  assert.match(card, /Ouvir amostra/);
  assert.match(card, /data-pro-media="narration-sample"/);
  assert.match(card, /type="button"/);
  assert.match(card, /aria-describedby="narration-sample-body"/);
  assert.match(card, /lang="pt-BR"/);
  assert.match(card, /cerca de 5 segundos/);
  assert.match(card, /não vai para a nuvem/);
  assert.match(card, /Luciana &lt;img&gt;/);
  assert.equal(card.includes('<img>'), false);
  useLocale('en');
  try {
    const english = narrationSampleMarkup(escapeHtml, 'Luciana');
    assert.match(english, /Listen to sample/);
    assert.match(english, /about 5 seconds/);
    assert.match(english, /not sent to the cloud/);
    assert.match(narrationSettingsCopy('macos'), /System Settings/);
    assert.match(narrationSettingsCopy('windows'), /Time and language/);
  } finally {
    useLocale('pt-BR');
  }
});

test('o Estúdio liga a amostra à voz local e não a um serviço de nuvem', () => {
  const studio = readFileSync(new URL('../public/studio-pro.js', import.meta.url), 'utf8');
  const sample = readFileSync(new URL('../public/narration-sample.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/studio.css', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(studio, /narrationIntroMode\(localStorage, v, narrationKnownAtStart\)/);
  assert.match(studio, /hasSavedNarrationVoice\(localStorage\)/);
  assert.match(sample, /data-pro-media="narration-sample"/);
  assert.match(studio, /NARRATION_SAMPLE_TEXT/);
  assert.match(studio, /api\("\/pro\/media\/speak"/);
  assert.match(studio, /new AudioContext\(\)/);
  assert.match(studio, /markNarrationIntro\(localStorage, "heard"\)/);
  assert.match(studio, /markNarrationIntro\(localStorage, "used"\)/);
  assert.match(studio, /showStoryNarrationIntro/);
  assert.doesNotMatch(studio, /speechSynthesis|elevenlabs|openai\.com|tts\.googleapis/i);
  assert.match(css, /#studio-pro-dialog \.narration-sample p/);
  assert.match(css, /color:var\(--ink\)/);
  assert.match(css, /outline:3px solid var\(--focus\)/);
  assert.match(server, /'\/narration-sample\.js'/);
});
