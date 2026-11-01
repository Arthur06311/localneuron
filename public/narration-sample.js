import { format, t } from './i18n.js';

export const NARRATION_INTRO_KEY = 'localneuron-narration-intro';
export const NARRATION_VOICE_KEY = 'localneuron-tts-voice';

// ~15 palavras a 175 palavras/minuto ≈ 5 segundos na voz do sistema.
export const NARRATION_SAMPLE_TEXT =
  'Esta é a voz do sistema em português do Brasil. Se estiver clara, pode narrar.';

const FAMILIAR = new Set(['heard', 'used']);

export function hasSavedNarrationVoice(storage) {
  return Boolean(storage?.getItem?.(NARRATION_VOICE_KEY));
}

export function narrationFamiliar(storage) {
  return FAMILIAR.has(storage?.getItem?.(NARRATION_INTRO_KEY) || '');
}

export function markNarrationIntro(storage, reason) {
  if (!FAMILIAR.has(reason) || !storage?.setItem) return;
  const current = storage.getItem?.(NARRATION_INTRO_KEY) || '';
  if (current === 'used' || current === reason) return;
  storage.setItem(NARRATION_INTRO_KEY, reason);
}

export function narrationSettingsPlatform(engine) {
  if (engine === 'macos-say') return 'macos';
  if (engine === 'windows-sapi') return 'windows';
  if (engine === 'linux-speech-dispatcher') return 'linux';
  return '';
}

export function narrationIntroMode(storage, voice, known = false) {
  if (!voice || typeof voice !== 'object') return 'blocked';
  if (voice.ready && voice.portuguese)
    return known || narrationFamiliar(storage) ? 'ready' : 'sample';
  if (voice.available && !voice.portuguese && narrationSettingsPlatform(voice.engine))
    return 'settings';
  return 'blocked';
}

export function narrationSettingsCopy(platform) {
  if (platform === 'macos') return t('narration.settings.macos');
  if (platform === 'windows') return t('narration.settings.windows');
  if (platform === 'linux') return t('narration.settings.linux');
  return t('narration.settings.generic');
}

export function narrationSampleMarkup(escapeHtml, voiceLabel) {
  const name = String(voiceLabel || '').trim();
  const voiceLine = name
    ? `<p class="narration-sample-voice">${escapeHtml(format('narration.sample.voice', { name }))}</p>`
    : '';
  return `<section class="narration-sample" aria-labelledby="narration-sample-title"><p class="eyebrow" id="narration-sample-kicker">${escapeHtml(t('narration.sample.kicker'))}</p><h3 id="narration-sample-title">${escapeHtml(t('narration.sample.title'))}</h3><p id="narration-sample-body">${escapeHtml(t('narration.sample.body'))}</p><p class="narration-sample-line" lang="pt-BR">${escapeHtml(NARRATION_SAMPLE_TEXT)}</p>${voiceLine}<div class="narration-sample-actions"><button type="button" class="primary" data-pro-media="narration-sample" aria-describedby="narration-sample-body">${escapeHtml(t('narration.sample.listen'))}</button></div><p id="narration-sample-status" role="status"></p></section>`;
}

export function narrationSettingsMarkup(escapeHtml, platform, detail) {
  const extra = String(detail || '').trim();
  const detailHtml = extra
    ? `<p class="narration-voice-detail">${escapeHtml(extra)}</p>`
    : '';
  return `<section class="notice narration-voice-hint" role="status" aria-labelledby="narration-settings-title"><h3 id="narration-settings-title">${escapeHtml(t('narration.settings.title'))}</h3><p>${escapeHtml(narrationSettingsCopy(platform))}</p>${detailHtml}<p>${escapeHtml(t('narration.settings.local'))}</p></section>`;
}
