const expressions = {
  welcome: { src: '/mascot.png', label: 'Acolhedor', description: 'Repouso: nas boas-vindas, em uma nova conversa e quando nada está em andamento.' },
  thinking: { src: '/mascot-thinking.png', label: 'Pensando', description: 'Trabalho: enquanto o aplicativo prepara uma resposta ou executa uma tarefa.' },
  success: { src: '/mascot-success.png', label: 'Comemorando', description: 'Concluído: quando a resposta termina. Você continua responsável por revisar o conteúdo.' },
  attention: { src: '/mascot-attention.png', label: 'Atento', description: 'Atenção: em avisos, erros, interrupções ou quando a fila está pausada.' },
};
const sizes = { chat: 128, welcome: 112, pro: 96, reply: 56, gallery: 120 };
export function mascotHTML(expression = 'welcome', placement = 'chat') {
  const key = Object.hasOwn(expressions, expression) ? expression : 'welcome';
  const face = expressions[key];
  const place = Object.hasOwn(sizes, placement) ? placement : 'chat';
  return `<span class="neuron-mascot-frame" data-expression="${key}" data-placement="${place}"><img class="neuron-mascot neuron-mascot-${place}" src="${face.src}" width="${sizes[place]}" height="${sizes[place]}" alt="Mascote do LocalNeuron: ${face.label.toLocaleLowerCase()}" draggable="false"><span class="neuron-mascot-status"><span class="neuron-mascot-glyph" aria-hidden="true"></span><span class="neuron-mascot-label">${face.label}</span></span></span>`;
}
export function mascotGallery() {
  return `<section class="panel mascot-gallery"><h2>Um mascote, várias expressões</h2><p>Cada estado junta a expressão, um símbolo e o nome. A cor reforça o estado e não é o único sinal.</p><div class="mascot-faces">${Object.entries(expressions).map(([key, face]) => `<figure>${mascotHTML(key, 'gallery')}<figcaption><span>${face.description}</span></figcaption></figure>`).join('')}</div></section>`;
}
