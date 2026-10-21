export function starterSuggestionHtml(model, escape) {
  if (!model?.id || !model.name) return '';
  return `<section class="notice starter-model" role="region" aria-label="Início rápido"><p><strong>Início rápido.</strong> Para esta RAM, sugerimos um único modelo: ${escape(model.name)}.</p><p>${Number(model.ram_gib)} GiB de RAM estimados para usá-lo · computador a partir de ${Number(model.computer_ram_gib)} GiB.</p><button class="primary" type="button" data-model-command="download" data-model-value="${escape(model.id)}">Baixar este modelo</button></section>`;
}
