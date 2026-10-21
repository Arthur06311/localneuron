import { t } from './i18n.js';
const expressions = {
  welcome: { src: '/mascot.png', label: 'mascot.welcome.label', description: 'mascot.welcome.description' },
  thinking: { src: '/mascot-thinking.png', label: 'mascot.thinking.label', description: 'mascot.thinking.description' },
  success: { src: '/mascot-success.png', label: 'mascot.success.label', description: 'mascot.success.description' },
  attention: { src: '/mascot-attention.png', label: 'mascot.attention.label', description: 'mascot.attention.description' },
};
const sizes = { chat: 128, welcome: 112, pro: 96, reply: 56, gallery: 120 };
export function mascotHTML(expression = 'welcome', placement = 'chat') {
  const key = Object.hasOwn(expressions, expression) ? expression : 'welcome';
  const face = expressions[key];
  const place = Object.hasOwn(sizes, placement) ? placement : 'chat';
  return `<span class="neuron-mascot-frame" data-expression="${key}" data-placement="${place}"><img class="neuron-mascot neuron-mascot-${place}" src="${face.src}" width="${sizes[place]}" height="${sizes[place]}" alt="" draggable="false"><span class="neuron-mascot-status"><span class="neuron-mascot-glyph" aria-hidden="true"></span><span class="neuron-mascot-label">${t(face.label)}</span></span></span>`;
}
export function mascotGallery() {
  return `<section class="panel mascot-gallery"><h2>${t('mascot.galleryTitle')}</h2><p>${t('mascot.galleryHelp')}</p><div class="mascot-faces">${Object.entries(expressions).map(([key, face]) => `<figure>${mascotHTML(key, 'gallery')}<figcaption><span>${t(face.description)}</span></figcaption></figure>`).join('')}</div></section>`;
}
