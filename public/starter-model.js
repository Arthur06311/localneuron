import { format, t } from './i18n.js';

export function starterSuggestionHtml(model, escape) {
  if (!model?.id || !model.name) return '';
  return `<section class="notice starter-model" role="region" aria-label="${escape(t('models.starter.label'))}"><p><strong>${t('models.starter.title')}</strong> ${format('models.starter.body', { name: escape(model.name) })}</p><p>${format('models.starter.ram', { ram: Number(model.ram_gib), computer: Number(model.computer_ram_gib) })}</p><button class="primary" type="button" data-model-command="download" data-model-value="${escape(model.id)}">${t('models.starter.download')}</button></section>`;
}
