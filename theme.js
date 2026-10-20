(function () {
  const labels = {
    pt: { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: escuro', next: { auto: 'Mudar para tema claro', light: 'Mudar para tema escuro', dark: 'Voltar ao tema automático' } },
    en: { auto: 'Theme: automatic', light: 'Theme: light', dark: 'Theme: dark', next: { auto: 'Switch to light theme', light: 'Switch to dark theme', dark: 'Use the automatic theme' } },
    es: { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro', next: { auto: 'Cambiar a tema claro', light: 'Cambiar a tema oscuro', dark: 'Volver al tema automático' } },
    fr: { auto: 'Thème : automatique', light: 'Thème : clair', dark: 'Thème : sombre', next: { auto: 'Passer au thème clair', light: 'Passer au thème sombre', dark: 'Revenir au thème automatique' } },
    de: { auto: 'Thema: automatisch', light: 'Thema: hell', dark: 'Thema: dunkel', next: { auto: 'Helles Thema verwenden', light: 'Dunkles Thema verwenden', dark: 'Automatisches Thema verwenden' } },
    ja: { auto: 'テーマ: 自動', light: 'テーマ: ライト', dark: 'テーマ: ダーク', next: { auto: 'ライトに切り替える', light: 'ダークに切り替える', dark: '自動に戻す' } },
    zh: { auto: '主题：自动', light: '主题：浅色', dark: '主题：深色', next: { auto: '改为浅色', light: '改为深色', dark: '改回自动' } }
  };
  const order = ['auto', 'light', 'dark'];
  const button = document.getElementById('theme-toggle');
  function language() {
    let pref = 'pt';
    try { pref = localStorage.getItem('localneuron-language') || document.documentElement.lang || 'pt'; } catch {}
    pref = String(pref).toLowerCase().slice(0, 2);
    return labels[pref] ? pref : 'pt';
  }
  function mode() {
    const value = document.documentElement.getAttribute('data-theme');
    return value === 'light' || value === 'dark' ? value : 'auto';
  }
  function paint() {
    const current = mode();
    const copy = labels[language()];
    const light = current === 'light' || (current === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f3f4f6' : '#0f1114');
    if (!button) return;
    button.textContent = copy[current];
    button.setAttribute('aria-pressed', current === 'auto' ? 'false' : 'true');
    button.setAttribute('aria-label', copy[current] + '. ' + copy.next[current]);
  }
  function apply(next) {
    if (next === 'light' || next === 'dark') {
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('localneuron-theme', next); } catch {}
    } else {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.removeItem('localneuron-theme'); } catch {}
    }
    paint();
  }
  button?.addEventListener('click', () => apply(order[(order.indexOf(mode()) + 1) % order.length]));
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (mode() === 'auto') paint(); });
  document.getElementById('language')?.addEventListener('change', () => setTimeout(paint, 0));
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  paint();
})();
