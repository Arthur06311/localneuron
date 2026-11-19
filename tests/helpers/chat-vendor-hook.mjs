export async function resolve(specifier, context, nextResolve) {
  if (specifier === './vendor/marked.js' || specifier === './vendor/purify.js') {
    const stub = specifier.endsWith('marked.js') ? 'marked-stub.mjs' : 'purify-stub.mjs';
    return { shortCircuit: true, url: new URL(`./${stub}`, import.meta.url).href };
  }
  return nextResolve(specifier, context);
}
