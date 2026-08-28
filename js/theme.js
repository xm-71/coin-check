/* Theme resolution: 'system' follows prefers-color-scheme, otherwise pinned. */

const media = window.matchMedia('(prefers-color-scheme: dark)');
let mode = 'system';

function paint() {
  const dark = mode === 'dark' || (mode === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function applyTheme(next) {
  mode = next || 'system';
  paint();
}

media.addEventListener('change', () => { if (mode === 'system') paint(); });
