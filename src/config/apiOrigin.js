/**
 * API origin — local dev always uses http://127.0.0.1:5000 (see .env.development).
 * Production behavior is only used after `npm run build`.
 */

const LOCAL_API = 'http://127.0.0.1:5000';

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function getApiBase() {
  // ——— Local development (npm start) ———
  if (process.env.NODE_ENV === 'development') {
    const raw = process.env.REACT_APP_API_BASE_URL;
    if (raw != null && String(raw).trim() !== '') {
      let u = normalizeBase(raw);
      if (/:(3000|3001)(\/|$)/.test(u)) u = LOCAL_API;
      if (/^https:\/\//i.test(u)) {
        console.warn('[ParkGo] Local dev must use HTTP. Using', LOCAL_API);
        u = LOCAL_API;
      }
      return u;
    }
    return LOCAL_API;
  }

  // ——— Production build only ———
  const raw = process.env.REACT_APP_API_BASE_URL;
  if (raw != null && String(raw).trim() !== '') {
    return normalizeBase(raw);
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return LOCAL_API;
}

export const API_BASE = getApiBase();

export function unreachableBackendHint() {
  const target = API_BASE || LOCAL_API;
  if (process.env.NODE_ENV === 'development') {
    return (
      `Cannot reach the ParkGo API at ${target}. ` +
      'Start the backend: cd backend && npm start'
    );
  }
  return `Cannot reach the API at ${target}. Check that the backend is running.`;
}
