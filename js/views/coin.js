import {
  el, icon, formatPrice, formatCompact, formatPercent, trendClass, formatTime,
} from '../util.js';
import { fetchCoin, fetchMarketChart } from '../api.js';
import { lineChart } from '../chart.js';
import { getSettings, isFavorite, toggleFavorite } from '../store.js';

/** Selectable trend windows. `days` is what CoinGecko expects. */
const RANGES = [
  { days: '1', label: '24H' },
  { days: '7', label: '7D' },
  { days: '30', label: '30D' },
  { days: '90', label: '90D' },
  { days: '365', label: '1Y' },
  { days: 'max', label: 'All' },
];

function statList(market, currency) {
  const entries = [
    ['Market cap', formatCompact(market.market_cap?.[currency], currency)],
    ['24h volume', formatCompact(market.total_volume?.[currency], currency)],
    ['24h high', formatPrice(market.high_24h?.[currency], currency)],
    ['24h low', formatPrice(market.low_24h?.[currency], currency)],
    ['All-time high', formatPrice(market.ath?.[currency], currency)],
    ['Circulating supply', market.circulating_supply
      ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 })
          .format(market.circulating_supply)
      : '—'],
  ];
  return el('dl.stats', {}, entries.map(([term, value]) =>
    el('div.stat', {}, el('dt', { text: term }), el('dd', { class: 'num', text: value }))
  ));
}

/** Coin detail: current price, an interactive trend chart, and key stats. */
export default async function coinView({ id }) {
  const settings = getSettings();
  const currency = settings.currency;

  const coin = await fetchCoin(id);
  const market = coin.market_data || {};
  const price = market.current_price?.[currency];
  const change24h = market.price_change_percentage_24h_in_currency?.[currency]
    ?? market.price_change_percentage_24h;

  let days = RANGES.some((r) => r.days === settings.defaultRange) ? settings.defaultRange : '7';

  const star = el('button.btn', {
    type: 'button',
    'aria-pressed': String(isFavorite(coin.id)),
    onclick: () => {
      const now = toggleFavorite(coin.id);
      star.replaceChildren(icon('star', now), now ? 'Favourited' : 'Add to favourites');
      star.setAttribute('aria-pressed', String(now));
    },
  }, icon('star', isFavorite(coin.id)), isFavorite(coin.id) ? 'Favourited' : 'Add to favourites');

  const chartBody = el('div', {}, el('div.skeleton', { style: 'height:260px' }));
  const chartRange = el('p.sub', { style: 'margin:0', text: '' });

  const segmented = el('div.segmented', { role: 'group', 'aria-label': 'Trend range' },
    RANGES.map((range) => el('button', {
      type: 'button',
      text: range.label,
      'aria-pressed': String(range.days === days),
      onclick: (event) => {
        days = range.days;
        for (const button of segmented.children) {
          button.setAttribute('aria-pressed', String(button === event.currentTarget));
        }
        loadChart();
      },
    }))
  );

  async function loadChart() {
    chartBody.replaceChildren(el('div.skeleton', { style: 'height:260px' }));
    chartRange.textContent = '';
    try {
      const series = await fetchMarketChart(coin.id, { currency, days });
      if (series.length < 2) {
        chartBody.replaceChildren(el('div.empty', { text: 'No price history for this range.' }));
        return;
      }

      const first = series[0].price;
      const last = series[series.length - 1].price;
      const move = first ? ((last - first) / first) * 100 : 0;

      chartBody.replaceChildren(
        lineChart(series, { currency }),
        el('div.chart-axis',
          {},
          el('span', { text: formatTime(series[0].time, days) }),
          el('span', { text: formatTime(series[series.length - 1].time, days) })
        )
      );
      chartRange.replaceChildren(
        el('span', { class: `delta num ${trendClass(move)}`, text: formatPercent(move) }),
        el('span', { text: ' over this range' })
      );
    } catch (error) {
      chartBody.replaceChildren(el('div.alert.alert-error', { text: error.message }));
    }
  }

  const root = el('div',
    {},
    el('a.sub', { href: '#/markets', text: '← Back to markets', style: 'display:inline-block;margin-bottom:20px' }),
    el('div.page-head',
      {},
      el('div',
        {},
        el('div.detail-head',
          {},
          coin.image?.small
            ? el('img', { src: coin.image.small, alt: '', width: 40, height: 40 })
            : el('div.coin-icon'),
          el('div',
            {},
            el('h1', { style: 'margin:0', text: coin.name }),
            el('div.coin-symbol', {},
              coin.symbol,
              coin.market_cap_rank ? el('span.coin-rank', { style: 'margin-left:8px', text: `#${coin.market_cap_rank}` }) : null)
          )
        ),
        el('div.detail-price.num', { text: formatPrice(price, currency) }),
        el('span', { class: `delta num ${trendClass(change24h)}`, text: `${formatPercent(change24h)} · 24h` })
      ),
      star
    ),
    el('div.chart-card',
      {},
      el('div.chart-head', {}, el('div', {}, el('h2', { style: 'margin:0', text: 'Trend' }), chartRange), segmented),
      chartBody
    ),
    el('h2', { text: 'Market stats' }),
    statList(market, currency)
  );

  loadChart();
  return root;
}
