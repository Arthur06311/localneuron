const expressions = {
  welcome: { src: '/mascot.png', label: 'Acolhedor', description: 'Nas boas-vindas e em uma nova conversa.' },
  thinking: { src: '/mascot-thinking.png', label: 'Pensando', description: 'Enquanto o aplicativo prepara uma resposta ou executa uma tarefa.' },
  success: { src: '/mascot-success.png', label: 'Comemorando', description: 'Quando a resposta termina. Você continua responsável por revisar o conteúdo.' },
  attention: { src: '/mascot-attention.png', label: 'Atento', description: 'Em avisos, interrupções ou quando a fila está pausada.' },
};
const sizes = { chat: 128, welcome: 112, pro: 96, reply: 56, gallery: 120 };
export function mascotHTML(expression = 'welcome', placement = 'chat') {
  const face = Object.hasOwn(expressions, expression) ? expressions[expression] : expressions.welcome;
  const place = Object.hasOwn(sizes, placement) ? placement : 'chat';
  return `<img class="neuron-mascot neuron-mascot-${place}" src="${face.src}" width="${sizes[place]}" height="${sizes[place]}" alt="Mascote do LocalNeuron: ${face.label.toLocaleLowerCase()}" draggable="false">`;
}
export function mascotGallery() {
  return `<section class="panel mascot-gallery"><h2>Um mascote, várias expressões</h2><p>Conheça as carinhas que acompanham você no LocalNeuron.</p><div class="mascot-faces">${Object.entries(expressions).map(([key, face]) => `<figure>${mascotHTML(key, 'gallery')}<figcaption><strong>${face.label}</strong><span>${face.description}</span></figcaption></figure>`).join('')}</div></section>`;
}
