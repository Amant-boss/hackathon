// adminAuth.js — the admin password gate, isolated on purpose.
//
// PROTOTYPE ONLY. The password lives in the app bundle, so anyone who can read the app can
// read it. It stops casual access, not a determined person. To make this real, replace
// verifyAdminPassword() with a call to your backend (e.g. POST /api/auth/login with
// password_verify on the server and a signed session token) and delete ADMIN_PASSWORD.

const ADMIN_PASSWORD = 'admin123';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 1000;
let failures = 0;
let lockedUntil = 0;

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// -> { ok: true } | { ok: false, error, locked?: boolean, retryInSeconds?: number }
export async function verifyAdminPassword(input) {
  const now = Date.now();
  if (now < lockedUntil) {
    return { ok: false, locked: true, retryInSeconds: Math.ceil((lockedUntil - now) / 1000), error: 'Too many attempts. Please wait a moment and try again.' };
  }
  const ok = safeEqual(String(input || ''), ADMIN_PASSWORD);
  if (ok) {
    failures = 0;
    return { ok: true };
  }
  failures += 1;
  if (failures >= MAX_ATTEMPTS) {
    failures = 0;
    lockedUntil = now + LOCK_MS;
    return { ok: false, locked: true, retryInSeconds: LOCK_MS / 1000, error: 'Too many attempts. Please wait 30 seconds and try again.' };
  }
  return { ok: false, error: 'Incorrect password. Please try again.' };
}