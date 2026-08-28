/* Shared coin-card grid used by both Markets and Favourites. */

import { el, icon, formatPrice, formatPercent, trendClass } from '../util.js';
import { sparkline } from '../chart.js';
import { isFavorite, toggleFavorite } from '../store.js';

const RANGE_FIELD = {
  '1h': 'price_change_percentage_1h_in_currency',
  '24h': 'price_change_percentage_24h_in_currency',
  '7d': 'price_change_percentage_7d_in_currency',
};

/*
 * CoinGecko's sparkline is 168 hourly points (7 days). Trimming it to the
 * selected window means the trace covers the same period as the percentage
 * beside it. An hour is a single point, so 1h borrows the 24h view.
 */
const SPARK_HOURS = { '1h': 24, '24h': 24, '7d': 168 };

function sparkSeries(coin, window) {
  const prices = coin.sparkline_in_7d?.price || [];
  const hours = SPARK_HOURS[window] || prices.length;
  return prices.slice(-hours);
}

export function coinCard(coin, { currency = 'usd', window = '24h', onUnfavorite } = {}) {
  const change = coin[RANGE_FIELD[window]];

  const star = el('button.star', {
    type: 'button',
    'aria-pressed': String(isFavorite(coin.id)),
    'aria-label': `${isFavorite(coin.id) ? 'Remove' : 'Add'} ${coin.name} ${isFavorite(coin.id) ? 'from' : 'to'} favourites`,
    onclick: (event) => {
      // The card is a link; keep the star from navigating.
      event.preventDefault();
      event.stopPropagation();
      const now = toggleFavorite(coin.id);
      star.replaceChildren(icon('star', now));
      star.setAttribute('aria-pressed', String(now));
      if (!now) onUnfavorite?.(coin.id);
    },
  }, icon('star', isFavorite(coin.id)));

  const image = coin.image
    ? el('img.coin-icon', { src: coin.image, alt: '', loading: 'lazy', width: 28, height: 28 })
    : el('div.coin-icon');

  return el('a.coin',
    { href: `#/coin/${encodeURIComponent(coin.id)}` },
    star,
    el('div.coin-top',
      {},
      image,
      el('div',
        {},
        el('div.coin-name', { text: coin.name }),
        el('div.coin-symbol', { text: coin.symbol })
      )
    ),
    el('div.coin-price.num', { text: formatPrice(coin.current_price, currency) }),
    el('div.coin-meta',
      {},
      el('span', { class: `delta num ${trendClass(change)}`, text: formatPercent(change) }),
      el('span.coin-symbol', { text: window === '1h' ? '1h · 24h chart' : window })
    ),
    sparkline(sparkSeries(coin, window), { trend: change })
  );
}

export function coinGrid(coins, options = {}) {
  return el('div.grid', {}, coins.map((coin) => coinCard(coin, options)));
}

/**
 * Placeholder cards shown while the first request is in flight. They carry
 * their own class and are hidden from assistive tech so they are never
 * mistaken for loaded coins.
 */
export function gridSkeleton(count = 8) {
  return el('div.grid', {}, Array.from({ length: count }, () =>
    el('div.coin.coin-placeholder',
      { 'aria-hidden': 'true' },
      el('div.coin-top',
        {},
        el('div.coin-icon.skeleton'),
        el('div', {}, el('div.skeleton', { style: 'width:88px;height:13px;margin-bottom:6px' }),
          el('div.skeleton', { style: 'width:44px;height:11px' }))
      ),
      el('div.skeleton', { style: 'width:120px;height:22px' }),
      el('div.skeleton', { style: 'width:100%;height:40px;margin-top:16px' })
    )
  ));
}
