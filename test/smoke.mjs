/*
 * End-to-end smoke test.
 *
 * Serves the project on a local port, drives it with Playwright, and stubs
 * the CoinGecko endpoints so the run is deterministic and offline.
 *
 *   npm install && npm test
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- deterministic CoinGecko stub ---------- */

const COINS = [
  // id, symbol, name, price, 24h%, 1h%, 7d%
  ['bitcoin', 'btc', 'Bitcoin', 64213.44, 1.75, 0.41, 6.10],
  ['ethereum', 'eth', 'Ethereum', 3187.20, -2.31, -0.18, -3.44],
  ['solana', 'sol', 'Solana', 0.00042, 4.87, 1.12, 12.30],
];

function stub(page) {
  return page.route('**/api.coingecko.com/**', (route) => {
    const url = route.request().url();

    if (url.includes('/coins/markets')) {
      const wanted = new URL(url).searchParams.get('ids');
      const rows = wanted ? COINS.filter((c) => wanted.split(',').includes(c[0])) : COINS;
      return route.fulfill({ json: rows.map(([id, symbol, name, price, d24, d1, d7], i) => ({
        id, symbol, name, image: '', current_price: price, market_cap_rank: i + 1,
        price_change_percentage_1h_in_currency: d1,
        price_change_percentage_24h_in_currency: d24,
        price_change_percentage_7d_in_currency: d7,
        sparkline_in_7d: { price: Array.from({ length: 168 }, (_, k) => 100 + Math.sin(k / 9) * 6) },
      })) });
    }

    if (url.includes('/market_chart')) {
      const now = Date.now();
      return route.fulfill({ json: { prices: Array.from({ length: 168 }, (_, k) =>
        [now - (168 - k) * 36e5, 60000 + Math.sin(k / 11) * 2500 + k * 24]) } });
    }

    if (/\/coins\/[a-z-]+\?/.test(url)) {
      return route.fulfill({ json: {
        id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1, image: { small: '' },
        market_data: {
          current_price: { usd: 64213.44 }, market_cap: { usd: 1.26e12 }, total_volume: { usd: 3.1e10 },
          high_24h: { usd: 64980 }, low_24h: { usd: 62740 }, ath: { usd: 73738 },
          circulating_supply: 19712456, price_change_percentage_24h_in_currency: { usd: 1.75 },
        },
      } });
    }
    return route.fulfill({ json: {} });
  });
}

/* ---------- harness ---------- */

let failures = 0;
function check(name, ok, extra = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
await stub(page);

const REAL_COIN = '.coin:not(.coin-placeholder)';

try {
  /* auth gate */
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('signed-out visitors land on /login', page.url().endsWith('#/login'));

  await page.goto(`${BASE}/#/settings`);
  await page.waitForFunction(() => location.hash === '#/login');
  check('route guard blocks deep links', true);

  /* validation */
  await page.fill('input[name=identifier]', 'ab');
  await page.fill('input[name=email]', 'nope');
  await page.fill('input[name=password]', 'short');
  await page.click('button[type=submit]');
  await page.waitForSelector('.alert-error');
  check('rejects an invalid signup', (await page.textContent('.alert-error')).includes('3 characters'));

  /* register */
  await page.fill('input[name=identifier]', 'satoshi');
  await page.fill('input[name=email]', 'sat@example.com');
  await page.fill('input[name=password]', 'correct-horse');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.hash === '#/markets');
  check('registering signs the user in', true);

  /* markets */
  await page.waitForSelector(REAL_COIN);
  check('markets renders a card per coin', (await page.locator(REAL_COIN).count()) === 3);
  check('large prices drop decimals',
    (await page.locator(REAL_COIN).first().locator('.coin-price').textContent()).includes('64,213'));
  check('sub-cent prices keep precision',
    (await page.locator(REAL_COIN).nth(2).locator('.coin-price').textContent()).includes('0.00042'));
  check('a fall is marked down', await page.locator(REAL_COIN).nth(1).locator('.delta.down').isVisible());
  check('sparkline colour follows the shown delta',
    (await page.locator(REAL_COIN).first().locator('.spark path').first().getAttribute('fill')) === 'var(--up)');

  await page.click('.segmented button:has-text("7d")');
  check('change window switches',
    (await page.locator(REAL_COIN).first().locator('.delta').textContent()).includes('6.10'));

  /* search */
  await page.fill('input[type=search]', 'eth');
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 1, REAL_COIN);
  check('search filters the grid', true);
  await page.fill('input[type=search]', 'zzzz');
  await page.waitForSelector('.empty');
  check('search shows an empty state', true);
  await page.fill('input[type=search]', '');
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 3, REAL_COIN);

  /* favourites */
  await page.locator(REAL_COIN).first().locator('.star').click();
  check('starring does not follow the card link', page.url().endsWith('#/markets'));
  check('star reflects pressed state',
    (await page.locator(REAL_COIN).first().locator('.star').getAttribute('aria-pressed')) === 'true');

  await page.click('.nav a:has-text("Favourites")');
  await page.waitForSelector(REAL_COIN);
  check('favourites lists only starred coins', (await page.locator(REAL_COIN).count()) === 1);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(REAL_COIN);
  check('favourites persist across a reload', (await page.locator(REAL_COIN).count()) === 1);

  await page.locator('.star').click();
  await page.waitForSelector('.empty');
  check('unstarring removes the card', true);

  /* trends */
  await page.goto(`${BASE}/#/coin/bitcoin`);
  await page.waitForSelector('.chart-wrap svg path');
  check('trend chart draws', (await page.locator('.chart-wrap svg path').count()) >= 2);
  check('range change is summarised', /%/.test(await page.textContent('.chart-head .sub')));
  check('market stats render', (await page.locator('.stat').count()) === 6);

  await page.click('.segmented button:has-text("30D")');
  await page.waitForTimeout(250);
  check('switching range keeps the chart', await page.locator('.chart-wrap svg').isVisible());

  const box = await page.locator('.chart-wrap svg').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForSelector('.tooltip.on');
  check('hover reads out a price', (await page.textContent('.tooltip .t-price')).includes('$'));

  /* settings */
  await page.click('.nav a:has-text("Settings")');
  await page.waitForSelector('.panel');
  check('settings shows every panel', (await page.locator('.panel').count()) === 3);

  await page.selectOption('.panel:first-of-type .row:nth-of-type(3) select', 'light');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  check('theme preference applies', true);

  await page.selectOption('.panel:first-of-type .row:nth-of-type(1) select', 'eur');
  await page.waitForSelector('.alert-ok');
  await page.goto(`${BASE}/#/markets`);
  await page.waitForSelector(REAL_COIN);
  check('currency preference applies to prices',
    (await page.locator(REAL_COIN).first().locator('.coin-price').textContent()).includes('€'));
  check('theme preference survives navigation',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');

  /* sign out / in */
  await page.goto(`${BASE}/#/settings`);
  await page.click('button:has-text("Sign out")');
  await page.waitForFunction(() => location.hash === '#/login');
  check('signing out returns to login', true);

  await page.fill('input[name=identifier]', 'satoshi');
  await page.fill('input[name=password]', 'wrong-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('.alert-error');
  check('a wrong password is rejected', (await page.textContent('.alert-error')).includes('Incorrect'));

  await page.fill('input[name=password]', 'correct-horse');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.hash === '#/markets');
  check('signing back in works', true);
  check('the password is never stored in the clear', await page.evaluate(() =>
    !JSON.parse(localStorage.getItem('coincheck.users')).some((u) => JSON.stringify(u).includes('correct-horse'))));

  /* failure handling */
  await page.route('**/api.coingecko.com/**', (route) => route.fulfill({ status: 429, json: {} }));
  await page.evaluate(() => location.reload());
  await page.waitForSelector('.alert-error');
  check('a rate limit is surfaced, not swallowed',
    (await page.textContent('.alert-error')).toLowerCase().includes('rate limit'));

  check('no uncaught page errors', consoleErrors.length === 0, consoleErrors.join('; '));
} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
