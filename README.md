# CoinCheck

Check crypto prices, star the coins you care about, and follow their trend over
time. A static site — no build step, no bundler, no runtime dependencies.

## Features

- **Markets** — top coins by market cap, searchable, with a 1h / 24h / 7d change
  switch and a sparkline on every card.
- **Favourites** — star a coin from anywhere; favourites are stored per account
  and survive a reload.
- **Trends** — an interactive price chart per coin over 24h, 7d, 30d, 90d, 1y or
  the full history, with a hover readout and the net move across the range.
- **Accounts** — a sign-in / sign-up screen that gates the app and scopes
  favourites and preferences to whoever is signed in.
- **Settings** — currency, default trend range, light/dark/system theme,
  auto-refresh interval, list size, and an optional API key.

## Running it

The app uses ES modules and WebCrypto, and neither works from a `file://`
origin, so it has to be served over http:

```sh
python3 -m http.server 8080   # or: npm start
```

Then open <http://localhost:8080>.

## Tests

```sh
npm install
npm test
```

`test/smoke.mjs` serves the project, drives it with Playwright, and stubs the
CoinGecko endpoints so the run is deterministic and works offline. It covers the
auth gate, the markets grid, search, favourites round-tripping through storage,
the trend chart, settings, and API failure handling.

## Market data

Prices come from the free [CoinGecko API](https://www.coingecko.com/en/api). No
key is required, but the free tier is rate limited to roughly 5–15 requests per
minute; responses are cached client-side with a TTL to stay well under it. If
you hit the limit, add a free demo key under **Settings → Data**.

> The original version of this app called `api.coinmarketcap.com/v1/ticker/`,
> which CoinMarketCap decommissioned in November 2018. That is why the price
> page had stopped returning anything.

## About the accounts

**These accounts are local to the browser and are not a security boundary.**

CoinCheck is a static site with no server, so there is nowhere to authenticate
against. Passwords are stored as PBKDF2-SHA256 digests (150,000 iterations, a
random per-user salt) rather than in plaintext, and sign-in compares digests
rather than raw input — but anything in `localStorage` is readable by anyone
with access to the browser profile, and there is no rate limiting, no recovery,
and no sync between devices.

Treat it as a way to keep separate profiles on a shared machine, not as real
authentication. Use a password you do not reuse elsewhere. Wiring this to a real
provider means replacing `js/auth.js` and the session check in `js/app.js`;
nothing else depends on how a user is identified.

## Layout

```
index.html          app shell
css/style.css       design tokens and all styling
js/
  app.js            bootstrap: chrome, routes, auth guard
  router.js         hash router with per-view cleanup
  store.js          localStorage: users, session, favourites, settings
  auth.js           register / login / delete account
  api.js            CoinGecko client, caching and error mapping
  chart.js          SVG sparkline and interactive trend chart
  theme.js          light / dark / system resolution
  util.js           DOM helper, currency and percent formatting
  views/            login, markets, favourites, coin, settings
test/smoke.mjs      end-to-end smoke test
SVG/, webfont/      coin icon assets, currently unreferenced
```
