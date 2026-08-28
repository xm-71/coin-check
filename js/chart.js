/*
 * Hand-rolled SVG line charts. Two shapes:
 *   sparkline() — the tiny 7-day trace on a coin card
 *   lineChart() — the interactive trend chart on the coin detail page
 *
 * Drawing these directly avoids pulling in a charting library for what is,
 * in both cases, a single polyline plus an area fill.
 */

import { el, formatPrice, formatDateTime } from './util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function node(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

/** Map values onto a viewBox, padded so the stroke is never clipped. */
function project(values, width, height, pad) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;                       // flat series would divide by zero
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((value, index) => [
    index * stepX,
    pad + (1 - (value - min) / span) * (height - pad * 2),
  ]);
  return { points, min, max };
}

function toPath(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
}

let gradientSeq = 0;

/**
 * Trace for a coin card.
 *
 * `trend` is the percentage the card is currently displaying; colouring by it
 * (rather than by first-vs-last of the drawn series) keeps the number and the
 * line from ever disagreeing on screen. Falls back to the series' own
 * direction when no trend is supplied.
 */
export function sparkline(values, { trend } = {}) {
  const clean = (values || []).filter(Number.isFinite);
  if (clean.length < 2) return el('div.spark');

  const W = 240, H = 40;
  const { points } = project(clean, W, H, 3);
  const rising = Number.isFinite(trend) ? trend >= 0 : clean[clean.length - 1] >= clean[0];
  const color = `var(--${rising ? 'up' : 'down'})`;

  const svg = node('svg', {
    class: 'spark',
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  svg.append(
    node('path', {
      d: `${toPath(points)} L${W} ${H} L0 ${H} Z`,
      fill: color,
      'fill-opacity': '0.10',
    }),
    node('path', {
      d: toPath(points),
      fill: 'none',
      stroke: color,
      'stroke-width': '1.5',
      'vector-effect': 'non-scaling-stroke',
      'stroke-linejoin': 'round',
    })
  );
  return svg;
}

/**
 * Full trend chart with a hover readout.
 * @param {{time:number, price:number}[]} series
 * @returns {HTMLElement} a positioned wrapper containing the svg and tooltip
 */
export function lineChart(series, { currency = 'usd' } = {}) {
  const wrap = el('div.chart-wrap');
  const points = (series || []).filter((p) => Number.isFinite(p.price));

  if (points.length < 2) {
    wrap.append(el('div.empty', { text: 'No price history available for this range.' }));
    return wrap;
  }

  const W = 800, H = 260, PAD = 12;
  const values = points.map((p) => p.price);
  const { points: coords, min, max } = project(values, W, H, PAD);
  const rising = values[values.length - 1] >= values[0];
  const color = `var(--${rising ? 'up' : 'down'})`;
  const gradientId = `cc-grad-${gradientSeq += 1}`;

  const svg = node('svg', {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': `Price trend from ${formatPrice(min, currency)} to ${formatPrice(max, currency)}`,
  });

  const defs = node('defs');
  const gradient = node('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0', y2: '1' });
  gradient.append(
    node('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.22' }),
    node('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' })
  );
  defs.append(gradient);

  const guide = node('line', {
    y1: 0, y2: H, stroke: 'var(--border)', 'stroke-width': '1',
    'vector-effect': 'non-scaling-stroke', opacity: '0',
  });
  const marker = node('circle', {
    r: '3.5', fill: color, stroke: 'var(--bg)', 'stroke-width': '2', opacity: '0',
  });

  svg.append(
    defs,
    node('path', { d: `${toPath(coords)} L${W} ${H} L0 ${H} Z`, fill: `url(#${gradientId})` }),
    node('path', {
      d: toPath(coords),
      fill: 'none',
      stroke: color,
      'stroke-width': '2',
      'vector-effect': 'non-scaling-stroke',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
    guide,
    marker
  );

  const tooltip = el('div.tooltip',
    {},
    el('div.t-price'),
    el('div.t-time')
  );

  // The svg is stretched with preserveAspectRatio="none", so pointer x maps
  // linearly from the rendered box back onto the viewBox.
  function onMove(event) {
    const box = svg.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    const index = Math.round(ratio * (points.length - 1));
    const [x, y] = coords[index];
    const point = points[index];

    guide.setAttribute('x1', x);
    guide.setAttribute('x2', x);
    guide.setAttribute('opacity', '1');
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    marker.setAttribute('opacity', '1');

    tooltip.querySelector('.t-price').textContent = formatPrice(point.price, currency);
    tooltip.querySelector('.t-time').textContent = formatDateTime(point.time);

    const left = (x / W) * box.width;
    const top = (y / H) * box.height;
    // Flip below the point near the top edge, and keep the box inside the
    // chart horizontally, so the readout never covers the range buttons.
    const flip = top < tooltip.offsetHeight + 12;
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.min(Math.max(left, half), box.width - half)}px`;
    tooltip.style.top = `${flip ? top + 18 : top - 10}px`;
    tooltip.style.transform = `translate(-50%, ${flip ? '0' : '-100%'})`;
    tooltip.classList.add('on');
  }

  function onLeave() {
    guide.setAttribute('opacity', '0');
    marker.setAttribute('opacity', '0');
    tooltip.classList.remove('on');
  }

  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', onLeave);

  wrap.append(svg, tooltip);
  wrap.dataset.min = String(min);
  wrap.dataset.max = String(max);
  return wrap;
}
