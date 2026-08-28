import { el, debounce } from '../util.js';
import { fetchMarkets, invalidate } from '../api.js';
import { getSettings } from '../store.js';
import { coinGrid, gridSkeleton } from './coinlist.js';

const WINDOWS = ['1h', '24h', '7d'];

/** Top coins by market cap, searchable, with a change-window switch. */
export default function marketsView() {
  const settings = getSettings();
  let changeWindow = '24h';
  let coins = [];
  let query = '';
  let timer = null;

  const status = el('span.sub', { style: 'margin:0', text: '' });
  const results = el('div', {}, gridSkeleton());

  const search = el('input.input', {
    type: 'search',
    placeholder: 'Search by name or symbol…',
    'aria-label': 'Search coins',
    oninput: debounce((event) => { query = event.target.value.trim().toLowerCase(); draw(); }, 150),
  });

  const segmented = el('div.segmented', { role: 'group', 'aria-label': 'Change window' },
    WINDOWS.map((w) => el('button', {
      type: 'button',
      text: w,
      'aria-pressed': String(w === changeWindow),
      onclick: (event) => {
        changeWindow = w;
        for (const button of segmented.children) {
          button.setAttribute('aria-pressed', String(button === event.currentTarget));
        }
        draw();
      },
    }))
  );

  const refreshBtn = el('button.btn', {
    type: 'button',
    text: 'Refresh',
    onclick: () => { invalidate(); load(); },
  });

  function draw() {
    const visible = query
      ? coins.filter((c) =>
          c.name.toLowerCase().includes(query) || c.symbol.toLowerCase().includes(query))
      : coins;

    if (!visible.length) {
      results.replaceChildren(el('div.empty', {}, el('p', {
        text: query ? `No coin matches “${query}” in the top ${coins.length}.` : 'No market data available.',
      })));
      return;
    }
    results.replaceChildren(coinGrid(visible, { currency: settings.currency, window: changeWindow }));
  }

  async function load() {
    refreshBtn.disabled = true;
    try {
      coins = await fetchMarkets({ currency: settings.currency, perPage: settings.listSize });
      status.textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
      draw();
    } catch (error) {
      // Keep whatever data is already on screen; only replace it if we have none.
      const notice = el('div.alert.alert-error', { text: error.message });
      if (coins.length) results.prepend(notice);
      else results.replaceChildren(notice);
      status.textContent = '';
    } finally {
      refreshBtn.disabled = false;
    }
  }

  const root = el('div',
    {},
    el('div.page-head',
      {},
      el('div', {}, el('h1', { text: 'Markets' }),
        el('p.sub', { style: 'margin:0', text: `Top ${settings.listSize} coins by market cap.` })),
      segmented
    ),
    el('div.toolbar', {}, search, el('span.spacer'), status, refreshBtn),
    results
  );

  load();
  if (settings.refreshSeconds > 0) {
    timer = setInterval(() => { invalidate(); load(); }, settings.refreshSeconds * 1000);
  }

  return { el: root, cleanup: () => clearInterval(timer) };
}
