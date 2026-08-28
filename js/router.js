/*
 * Hash router. Hash routing (rather than the History API) keeps the app
 * deployable as plain static files with no server rewrite rules.
 */

const routes = [];
let outlet = null;
let current = null;      // { cleanup? } returned by the active view
let guard = () => null;  // returns a redirect path, or null to allow
let token = 0;           // guards against a slow view resolving after navigation

/** define('/coin/:id', view) — ':name' segments land in params. */
export function define(pattern, view) {
  const names = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
      names.push(name);
      return '([^/]+)';
    }) + '$'
  );
  routes.push({ regex, names, view });
}

export function setGuard(fn) { guard = fn; }

export function path() {
  const hash = location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : '/';
}

export function navigate(to, { replace = false } = {}) {
  const target = `#${to}`;
  if (location.hash === target) return resolve();
  if (replace) location.replace(target);
  else location.hash = target;
}

function match(current_path) {
  for (const route of routes) {
    const found = current_path.match(route.regex);
    if (!found) continue;
    const params = {};
    route.names.forEach((name, i) => { params[name] = decodeURIComponent(found[i + 1]); });
    return { route, params };
  }
  return null;
}

async function resolve() {
  const here = path();

  const redirect = guard(here);
  if (redirect && redirect !== here) return navigate(redirect, { replace: true });

  const found = match(here);
  if (!found) return navigate('/markets', { replace: true });

  const mine = (token += 1);

  current?.cleanup?.();
  current = null;

  let result;
  try {
    result = await found.route.view(found.params);
  } catch (error) {
    console.error(error);
    result = document.createElement('div');
    result.className = 'alert alert-error';
    result.textContent = error?.message || 'Something went wrong rendering this page.';
  }

  if (mine !== token) {
    // Navigated away while this view was loading — throw the result away.
    result?.cleanup?.();
    return undefined;
  }

  current = result && result.el ? result : { el: result };
  outlet.replaceChildren(current.el);
  window.scrollTo(0, 0);
  return undefined;
}

export function start(mountPoint) {
  outlet = mountPoint;
  window.addEventListener('hashchange', resolve);
  if (!location.hash) return navigate('/markets', { replace: true });
  return resolve();
}

/** Re-render the current route (used after a settings change). */
export function refresh() { return resolve(); }
