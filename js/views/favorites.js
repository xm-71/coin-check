import { el } from '../util.js';
import { fetchMarketsByIds, invalidate } from '../api.js';
import { getFavorites, getSettings } from '../store.js';
import { coinGrid, gridSkeleton } from './coinlist.js';

/**
 * The coins the signed-in user has starred. This is the feature the original
 * "Track" button gestured at: it read a duplicated element id and only logged
 * to the console, so nothing was ever saved.
 */
export default function favoritesView() {
  const settings = getSettings();
  let timer = null;

  const results = el('div', {}, gridSkeleton(4));
  const refreshBtn = el('button.btn', {
    type: 'button',
    text: 'Refresh',
    onclick: () => { invalidate(); load(); },
  });

  function emptyState() {
    return el('div.empty',
      {},
      el('p', { text: 'No favourites yet. Star a coin on the Markets page to follow it here.' }),
      el('a.btn.btn-primary', { href: '#/markets', text: 'Browse markets' })
    );
  }

  async function load() {
    const ids = getFavorites();
    if (!ids.length) {
      results.replaceChildren(emptyState());
      return;
    }

    refreshBtn.disabled = true;
    try {
      const coins = await fetchMarketsByIds(ids, { currency: settings.currency });
      results.replaceChildren(coins.length
        ? coinGrid(coins, {
            currency: settings.currency,
            window: '24h',
            // Unstarring here should drop the card, not leave a dead tile behind.
            onUnfavorite: () => load(),
          })
        : emptyState());
    } catch (error) {
      results.replaceChildren(el('div.alert.alert-error', { text: error.message }));
    } finally {
      refreshBtn.disabled = false;
    }
  }

  const root = el('div',
    {},
    el('div.page-head',
      {},
      el('div', {}, el('h1', { text: 'Favourites' }),
        el('p.sub', { style: 'margin:0', text: 'Coins you are following.' })),
      refreshBtn
    ),
    results
  );

  load();
  if (settings.refreshSeconds > 0) {
    timer = setInterval(() => { invalidate(); load(); }, settings.refreshSeconds * 1000);
  }

  return { el: root, cleanup: () => clearInterval(timer) };
}
