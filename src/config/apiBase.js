/**
 * Legacy helpers — canonical API origin is `apiOrigin.js` (used by `src/api/client.js`).
 */
import { API_BASE, unreachableBackendHint } from './apiOrigin';

export { API_BASE };

/** For requests that need `Authorization: Bearer`, use `fetchWithAuth` from `../utils/authFetch` (reads `localStorage.accessToken`). */

/**
 * GET /api/forecast — in development use a relative URL so Create React App's `proxy`
 * forwards to Express (port 5000). A mis-set REACT_APP_API_BASE_URL (e.g. Flask on :5001)
 * would otherwise call `/api/forecast` on the wrong server and return 404.
 */
export function apiForecastUrl() {
  if (process.env.NODE_ENV === 'development') {
    return '/api/forecast';
  }
  const base = String(API_BASE || '').replace(/\/$/, '');
  return `${base}/api/forecast`;
}

/** Local Express (Node API) — same host as Smart Parking Assistant proxy target */
const EXPRESS_FORECAST_FALLBACK = 'http://127.0.0.1:5000/api/forecast';

/**
 * GET /api/forecast as JSON array. Tries {@link apiForecastUrl} first, then Express :5000 directly
 * so forecast still loads if the CRA proxy returns 404 or misroutes.
 * Per-URL try/catch so a failed proxy (or backend down) still tries the absolute Express URL.
 */
export async function fetchForecastArray() {
  const urls = [...new Set([apiForecastUrl(), EXPRESS_FORECAST_FALLBACK])];

  let lastRes = /** @type {Response | null} */ (null);
  let lastData = /** @type {unknown} */ (null);
  /** @type {Error | null} */
  let lastNetworkError = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        return data;
      }
      lastRes = res;
      lastData = data;
    } catch (e) {
      lastNetworkError = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (lastRes) {
    let msg = `Demand forecast unavailable (HTTP ${lastRes?.status ?? '?'})`;
    if (
      lastData &&
      typeof lastData === 'object' &&
      typeof lastData.error === 'string'
    ) {
      msg = lastData.error;
    }
    const err = new Error(msg);
    err.status = lastRes?.status;
    throw err;
  }

  const baseHint = apiUnreachableMessage();
  const flaskHint =
    ' If demand still fails after the API is up, start the ML app: `python app.py` (default port 5001) so Express can reach /forecast.';
  const err = new Error(
    `${baseHint}${lastNetworkError && lastNetworkError.message === 'Failed to fetch' ? ' (connection refused or blocked — is `npm start` running in /backend on port 5000?)' : ` (${lastNetworkError?.message || 'network error'})`}${flaskHint}`
  );
  err.status = 0;
  throw err;
}

/**
 * Absolute URL for an API path. Use for multipart (FormData) POSTs so they always reach Express
 * on port 5000 in local dev, even if API_BASE were mis-resolved.
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = String(API_BASE || '').replace(/\/$/, '');
  if (base && /^https?:\/\//i.test(base)) {
    return `${base}${p}`;
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
      return `http://127.0.0.1:5000${p}`;
    }
  }
  return `http://127.0.0.1:5000${p}`;
}

/** User-facing hint when fetch fails (connection refused, DNS, etc.) */
export function apiUnreachableMessage() {
  return unreachableBackendHint();
}

/** Shown when API_BASE is empty in .env but we need to mention where the server should be */
export function apiBaseForErrors() {
  return API_BASE || 'http://127.0.0.1:5000';
}

/**
 * Fetch and parse JSON safely. Avoids "Unexpected token '<'" when the server returns HTML
 * (SPA index.html, Express 404 page, or proxy error page).
 * @param {string} pathname e.g. '/admin/analytics'
 */
export async function safeFetchJson(pathname) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = `${API_BASE}${path}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: `${apiUnreachableMessage()} (${e.message || 'network error'})`,
    };
  }
  const text = await res.text();
  if (!text || !text.trim()) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `Empty response from API (${res.status}). ${apiUnreachableMessage()}`,
    };
  }
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<')) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error:
        'The server returned a webpage instead of JSON. Usually this means the ParkGo backend is not running, is an old version without this API route, or the app is not pointed at the API. Start the backend (port 5000), restart it after updating, or set REACT_APP_API_BASE_URL in the frontend .env to your API base URL.',
    };
  }
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, status: res.status, data, error: null };
  } catch (e) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `Invalid JSON from API (${res.status}). ${e.message || 'parse error'}`,
    };
  }
}
