/*
 * Account handling.
 *
 * IMPORTANT: CoinCheck is a static site with no server, so these accounts are
 * local to the browser. Passwords are stored as PBKDF2-SHA256 digests rather
 * than plaintext, but a local-only account is a convenience for separating
 * profiles on a shared machine — it is not a security boundary, and it is not
 * a substitute for a real auth provider. See README.md.
 */

import { getUsers, saveUsers, setSession, clearSession, currentUser, deleteUserData } from './store.js';

const ITERATIONS = 150_000;
const KEY_BITS = 256;

/** WebCrypto is unavailable over file:// — the app needs an http origin. */
function subtle() {
  const api = globalThis.crypto?.subtle;
  if (!api) {
    throw new Error('Secure browser crypto is unavailable. Serve CoinCheck over http://localhost or https rather than opening the file directly.');
  }
  return api;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(password, saltHex, iterations = ITERATIONS) {
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const key = await subtle().importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, KEY_BITS);
  return toHex(bits);
}

/** Constant-time-ish compare so a wrong password does not leak via timing. */
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function validate({ username, email, password }) {
  if (!username || username.trim().length < 3) return 'Choose a username of at least 3 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return 'Enter a valid email address.';
  if (!password || password.length < 8) return 'Use a password of at least 8 characters.';
  return null;
}

export async function register({ username, email, password }) {
  const problem = validate({ username, email, password });
  if (problem) throw new Error(problem);

  const users = getUsers();
  const name = username.trim();
  const mail = email.trim().toLowerCase();

  if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    throw new Error('That username is already taken on this device.');
  }
  if (users.some((u) => u.email.toLowerCase() === mail)) {
    throw new Error('That email already has an account on this device.');
  }

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const user = {
    id: crypto.randomUUID(),
    username: name,
    email: mail,
    salt,
    iterations: ITERATIONS,
    hash: await derive(password, salt),
    createdAt: Date.now(),
  };

  saveUsers([...users, user]);
  setSession(user.id);
  return user;
}

export async function login({ identifier, password }) {
  const needle = String(identifier || '').trim().toLowerCase();
  const user = getUsers().find(
    (u) => u.username.toLowerCase() === needle || u.email.toLowerCase() === needle
  );

  // Derive either way so a missing account and a wrong password take the same time.
  const salt = user?.salt || '00000000000000000000000000000000';
  const candidate = await derive(password || '', salt, user?.iterations || ITERATIONS);

  if (!user || !equal(candidate, user.hash)) {
    throw new Error('Incorrect username or password.');
  }

  setSession(user.id);
  return user;
}

export function logout() { clearSession(); }

export function deleteAccount() {
  const user = currentUser();
  if (!user) return;
  deleteUserData(user.id);
  saveUsers(getUsers().filter((u) => u.id !== user.id));
  clearSession();
}
