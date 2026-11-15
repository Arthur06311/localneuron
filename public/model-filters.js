export const FAMILY_ALL = 'all';

export const MODEL_FILTERS = [
  { id: 'all', key: 'models.filter.all' },
  { id: 'public-access', key: 'models.filter.publicAccess' },
  { id: 'compatible-engine', key: 'models.filter.compatibleEngine' },
  { id: 'built-in', key: 'models.filter.builtIn' },
  { id: 'favorites', key: 'models.filter.favorites' },
  { id: 'downloaded', key: 'models.filter.downloaded' },
  { id: 'fits-now', key: 'models.filter.fitsNow' },
  { id: 'conversation', key: 'models.filter.conversation', category: 'Conversa' },
  { id: 'code', key: 'models.filter.code', category: 'Código' },
  { id: 'writing', key: 'models.filter.writing', category: 'Escrita' },
  { id: 'reasoning', key: 'models.filter.reasoning', category: 'Raciocínio' },
  { id: 'image', key: 'models.filter.image', category: 'Imagem' },
  { id: 'video', key: 'models.filter.video', category: 'Vídeo' },
  { id: 'ready-to-generate', key: 'models.filter.ready' },
  { id: 'this-pc', key: 'models.filter.thisPc' },
  { id: 'large-70b', key: 'models.filter.large' },
];

const CATEGORY_KEYS = {
  Conversa: 'models.filter.conversation',
  Código: 'models.filter.code',
  Escrita: 'models.filter.writing',
  Raciocínio: 'models.filter.reasoning',
  Imagem: 'models.filter.image',
  Vídeo: 'models.filter.video',
};

export function categoryKey(value) {
  return CATEGORY_KEYS[value] || '';
}

export function isVisualFilter(id) {
  return id === 'image' || id === 'video';
}

export function emptyCatalogMessageKey(filterId) {
  return filterId === 'fits-now' ? 'models.results.fitsNowNone' : 'models.results.none';
}

export function emptyCatalogAction(filterId) {
  if (filterId !== 'fits-now') return null;
  return { filterId: 'this-pc', labelKey: 'models.results.fitsNowAction' };
}

export function modelMatchesFilter(model, filter, library, favorites) {
  if (filter === 'all') return true;
  if (filter === 'public-access') return model.availability?.access === 'public' || model.access === 'public';
  if (filter === 'compatible-engine') return model.availability?.support?.status === 'declared';
  if (filter === 'built-in') return Boolean(model.embedded?.runs);
  if (filter === 'favorites') return favorites.has(model.id);
  if (filter === 'downloaded') return Boolean(model.local_key || model.downloaded_file || library.media_downloads?.jobs.some(job => job.model === model.id && job.state === 'downloaded') || library.media_profiles?.some(profile => profile.id === (model.profile_id || model.id) && profile.installed));
  if (filter === 'ready-to-generate') return Boolean(model.local_profile || model.profile_id);
  if (filter === 'fits-now') return !model.external && (model.ram_gib + 1) * 1073741824 <= library.available_memory_bytes;
  if (filter === 'this-pc') return !model.external && model.computer_ram_gib * 1073741824 <= library.total_memory_bytes;
  if (filter === 'large-70b') return (model.parameters_b || 0) >= 70;
  const category = MODEL_FILTERS.find(item => item.id === filter)?.category;
  return Boolean(category && model.categories?.includes(category));
}

export const QUANTIZE_STATE_KEYS = {
  preparing: 'models.quantize.state.preparing',
  imatrix: 'models.quantize.state.imatrix',
  quantizing: 'models.quantize.state.quantizing',
  done: 'models.quantize.state.done',
  cancelled: 'models.quantize.state.cancelled',
  failed: 'models.quantize.state.failed',
};

export const QUANTIZE_DETAIL_KEYS = {
  'GGUF Q4_K_M · imatrix': 'models.quantize.detail.ggufBalanced',
  'GGUF Q4_K_M · sem imatrix': 'models.quantize.detail.ggufBalancedPlain',
  'GGUF IQ4_XS · imatrix': 'models.quantize.detail.ggufSmall',
  'GGUF IQ4_XS · sem imatrix': 'models.quantize.detail.ggufSmallPlain',
  'GGUF Q6_K': 'models.quantize.detail.ggufQuality',
  'MLX 4 bits · grupo 64': 'models.quantize.detail.mlxBalanced',
  'MLX 4 bits · grupo 128': 'models.quantize.detail.mlxSmall',
  'MLX misto 4 e 6 bits': 'models.quantize.detail.mlxQuality',
};
