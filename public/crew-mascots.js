/** Identificadores estáveis. O desenho pode ser trocado sem mudar o id. */
export const CREW_MASCOTS = ['coordenador', 'redacao', 'analise', 'codigo', 'pesquisa'];

export const CREW_MASCOT_LABELS = {
  coordenador: 'Coordenador',
  redacao: 'Redação',
  analise: 'Análise',
  codigo: 'Código',
  pesquisa: 'Pesquisa',
};

const PATHS = {
  coordenador: '<circle cx="12" cy="9" r="3"/><path d="M7 19.5c.7-2.8 2.6-4 5-4s4.3 1.2 5 4"/><path d="m12 2 1 2.2h2.3L13.6 5.6l.7 2.2L12 6.6 9.7 7.8l.7-2.2L8.7 4.2H11z"/>',
  redacao: '<path d="M4 20h9"/><path d="m14.5 4.5 5 5L9 20H4v-5z"/>',
  analise: '<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5M11 8v3l2 2"/>',
  codigo: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4M13 6l-2 12"/>',
  pesquisa: '<path d="M5 5h9a2 2 0 0 1 2 2v12H7a2 2 0 0 0-2 2z"/><path d="M5 5a2 2 0 0 1 2-2h9v14"/>',
};

export function crewMascot(id) {
  const key = CREW_MASCOTS.includes(id) ? id : 'codigo';
  return `<span class="crew-mascot" data-crew-mascot="${key}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[key]}</svg></span>`;
}

export function isAdvancedModel(key, parametersB, advancedMin = 70) {
  if (String(key || '').startsWith('exo:')) return true;
  const size = Number(parametersB);
  return parametersB != null && Number.isFinite(size) && size >= advancedMin;
}

export function describeModel(entry, { coordinator = false, advancedMin = 70 } = {}) {
  const advanced = isAdvancedModel(entry.key, entry.parameters_b, advancedMin);
  return { ...entry, advanced, disabled: advanced && !coordinator };
}

export function modelOptionLabel(entry) {
  const size = entry.parameters_b ? `${entry.parameters_b}B · ` : '';
  return `${size}${entry.name}${entry.advanced ? ' · só o coordenador' : ''}`;
}

export function estimateTokens(text) {
  const length = String(text ?? '').length;
  if (!length) return 0;
  return Math.max(1, Math.ceil(length / 4));
}

export function crewModelChoices({ catalog = [], installed = [], suggestion = null, current = '', coordinator = false, advancedMin = 70 } = {}) {
  const rows = [];
  const push = (key, name, parameters) => {
    if (!key || rows.some(row => row.key === key)) return;
    rows.push(describeModel({ key, name: name || key, parameters_b: parameters ?? null }, { coordinator, advancedMin }));
  };
  for (const model of installed) {
    const card = catalog.find(item => item.local_key === model.key || item.id === model.key);
    push(model.key, model.display_name || card?.name || model.key, card?.parameters_b ?? null);
  }
  if (suggestion) push(suggestion.id, suggestion.name, suggestion.parameters_b);
  if (current) {
    const card = catalog.find(item => item.local_key === current || item.id === current);
    push(current, card?.name || current, card?.parameters_b ?? null);
  }
  return rows.sort((a, b) => Number(a.advanced) - Number(b.advanced) || String(a.name).localeCompare(String(b.name), 'pt'));
}
