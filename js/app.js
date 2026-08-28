/*
 * CoinCheck — app shell.
 *
 * Static site, no build step: plain ES modules, hash routing, and the free
 * CoinGecko API. Serve the folder over http (see README) — ES modules and
 * WebCrypto both refuse to run from a file:// origin.
 */

import { el } from './util.js';
import { currentUser, getSettings, subscribe } from './store.js';
import { applyTheme } from './theme.js';
import { define, setGuard, start, path, navigate } from './router.js';

import loginView from './views/login.js';
import marketsView from './views/markets.js';
import favoritesView from './views/favorites.js';
import coinView from './views/coin.js';
import settingsView from './views/settings.js';

const PUBLIC_ROUTES = ['/login'];

const NAV = [
  ['/markets', 'Markets'],
  ['/favorites', 'Favourites'],
  ['/settings', 'Settings'],
];

const outlet = el('main.main');
const topbar = el('header.topbar');

function renderChrome() {
  const user = currentUser();
  const here = path();

  const nav = el('nav.nav', { 'aria-label': 'Main' },
    user
      ? NAV.map(([href, label]) => el('a', {
          href: `#${href}`,
          text: label,
          class: here.startsWith(href) ? 'active' : null,
        }))
      : el('a', { href: '#/login', text: 'Sign in', class: here === '/login' ? 'active' : null })
  );

  topbar.replaceChildren(
    el('a.brand', { href: user ? '#/markets' : '#/login' }, el('span.dot'), 'CoinCheck'),
    nav
  );
}

/** Everything except /login requires a session; /login redirects away from one. */
function guard(here) {
  const signedIn = Boolean(currentUser());
  if (!signedIn && !PUBLIC_ROUTES.includes(here)) return '/login';
  if (signedIn && here === '/login') return '/markets';
  return null;
}

define('/login', loginView);
define('/markets', marketsView);
define('/favorites', favoritesView);
define('/coin/:id', coinView);
define('/settings', settingsView);

const root = document.getElementById('app');
root.replaceChildren(
  topbar,
  outlet,
  el('footer.footer', {},
    'CoinCheck · prices from ',
    el('a', { href: 'https://www.coingecko.com', target: '_blank', rel: 'noopener noreferrer', text: 'CoinGecko' })
  )
);

applyTheme(getSettings().theme);
setGuard(guard);
subscribe(renderChrome);
window.addEventListener('hashchange', renderChrome);

renderChrome();
start(outlet);

// Signing in/out in another tab should not leave this one on a stale view.
window.addEventListener('storage', (event) => {
  if (event.key === 'coincheck.session') {
    applyTheme(getSettings().theme);
    renderChrome();
    navigate(guard(path()) || path(), { replace: true });
    location.reload();
  }
});
