/*
 * CoinGecko client.
 *
 * The original app called api.coinmarketcap.com/v1/ticker/, which was
 * decommissioned in November 2018. CoinGecko's public API is free, needs no
 * key, sends CORS headers, and — unlike the old endpoint — exposes historical
 * series, which is what the trend charts need.
 *
 * The free tier is rate limited (roughly 5-15 requests/minute), so every
 * response is cached in memory with a TTL and in-flight requests are shared.
 */

import { getSettings } from './store.js';

const BASE = 'https://api.coingecko.com/api/v3';

const cache = new Map();   // url -> { expires, value }
const inflight = new Map(); // url -> Promise

export class ApiError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

function buildUrl(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, value);
  }
  const { apiKey } = getSettings();
  if (apiKey) url.searchParams.set('x_cg_demo_api_key', apiKey);
  return url.toString();
}

async function request(path, params, ttlMs) {
  const url = buildUrl(path, params);

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;

  if (inflight.has(url)) return inflight.get(url);

  const promise = (async () => {
    let response;
    try {
      response = await fetch(url, { headers: { accept: 'application/json' } });
    } catch (cause) {
      throw new ApiError('Could not reach CoinGecko. Check your network connection.', { retryable: true });
    }

    if (response.status === 429) {
      throw new ApiError(
        'CoinGecko rate limit reached. Wait a moment, or add a free API key in Settings.',
        { status: 429, retryable: true }
      );
    }
    if (!response.ok) {
      throw new ApiError(`CoinGecko returned ${response.status}.`, {
        status: response.status,
        retryable: response.status >= 500,
      });
    }

    const value = await response.json();
    cache.set(url, { expires: Date.now() + ttlMs, value });
    return value;
  })().finally(() => inflight.delete(url));

  inflight.set(url, promise);
  return promise;
}

/** Drop cached responses so the next call re-fetches. */
export function invalidate() { cache.clear(); }

/**
 * Top coins by market cap, with 1h/24h/7d change and a 7-day sparkline —
 * one request covers the whole markets grid.
 */
export function fetchMarkets({ currency = 'usd', perPage = 100 } = {}) {
  return request('/coins/markets', {
    vs_currency: currency,
    order: 'market_cap_desc',
    per_page: Math.min(Math.max(perPage, 1), 250),
    page: 1,
    sparkline: true,
    price_change_percentage: '1h,24h,7d',
  }, 60_000);
}

/** Markets data for a specific set of ids — used by the Favourites page. */
export function fetchMarketsByIds(ids, { currency = 'usd' } = {}) {
  if (!ids.length) return Promise.resolve([]);
  return request('/coins/markets', {
    vs_currency: currency,
    ids: ids.join(','),
    order: 'market_cap_desc',
    per_page: 250,
    page: 1,
    sparkline: true,
    price_change_percentage: '1h,24h,7d',
  }, 60_000);
}

export function fetchCoin(id) {
  return request(`/coins/${encodeURIComponent(id)}`, {
    localization: false,
    tickers: false,
    market_data: true,
    community_data: false,
    developer_data: false,
    sparkline: false,
  }, 60_000);
}

/**
 * Historical prices. `days` is 1 | 7 | 30 | 90 | 365 | 'max'.
 * Longer windows change slowly, so they are cached for longer.
 */
export async function fetchMarketChart(id, { currency = 'usd', days = 7 } = {}) {
  const ttl = Number(days) <= 1 ? 60_000 : Number(days) <= 30 ? 5 * 60_000 : 30 * 60_000;
  const data = await request(`/coins/${encodeURIComponent(id)}/market_chart`, {
    vs_currency: currency,
    days,
  }, ttl);
  return (data?.prices || []).map(([time, price]) => ({ time, price }));
}
