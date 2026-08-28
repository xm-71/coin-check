/*
 * Persistence layer. Everything lives in localStorage:
 *
 *   coincheck.users    -> [{ id, username, email, salt, hash, iterations, createdAt }]
 *   coincheck.session  -> { userId }
 *   coincheck.user.<id>-> { favorites: [coinId], settings: {...} }
 *
 * Per-user keys keep favourites and settings scoped to whoever is signed in.
 */

const NS = 'coincheck';

export const DEFAULT_SETTINGS = {
  currency: 'usd',
  defaultRange: '7',      // days shown on a coin's trend chart
  theme: 'system',        // system | light | dark
  refreshSeconds: 60,     // 0 disables auto-refresh
  listSize: 100,          // how many coins the markets page loads
  apiKey: '',             // optional CoinGecko demo key, raises the rate limit
};

const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(`${NS}.${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(`${NS}.${key}`, JSON.stringify(value));
    return true;
  } catch {
    // Private-browsing modes and full quotas both throw here.
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(`${NS}.${key}`); } catch { /* ignore */ }
}

/** Subscribe to any change in users / session / favourites / settings. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of [...listeners]) fn();
}

/* ---------- users & session ---------- */

export const getUsers = () => read('users', []);
export const saveUsers = (users) => { write('users', users); emit(); };

export function currentUser() {
  const session = read('session', null);
  if (!session?.userId) return null;
  return getUsers().find((u) => u.id === session.userId) || null;
}

export function setSession(userId) { write('session', { userId }); emit(); }
export function clearSession() { remove('session'); emit(); }

/* ---------- per-user data ---------- */

function userKey(userId) { return `user.${userId}`; }

function userData(userId) {
  const data = read(userKey(userId), {});
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  };
}

export function deleteUserData(userId) { remove(userKey(userId)); }

/**
 * Settings fall back to defaults when signed out so the shell (theme,
 * currency) still renders sensibly on the login screen.
 */
export function getSettings() {
  const user = currentUser();
  return user ? userData(user.id).settings : { ...DEFAULT_SETTINGS };
}

export function updateSettings(patch) {
  const user = currentUser();
  if (!user) return getSettings();
  const data = userData(user.id);
  data.settings = { ...data.settings, ...patch };
  write(userKey(user.id), data);
  emit();
  return data.settings;
}

export function getFavorites() {
  const user = currentUser();
  return user ? userData(user.id).favorites : [];
}

export function isFavorite(coinId) {
  return getFavorites().includes(coinId);
}

/** Returns the new favourite state so callers can update their button. */
export function toggleFavorite(coinId) {
  const user = currentUser();
  if (!user) return false;
  const data = userData(user.id);
  const index = data.favorites.indexOf(coinId);
  if (index === -1) data.favorites.push(coinId);
  else data.favorites.splice(index, 1);
  write(userKey(user.id), data);
  emit();
  return index === -1;
}
