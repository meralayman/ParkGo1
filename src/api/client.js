/**
 * Central API client — all frontend HTTP calls should go through this module.
 */
import { API_BASE, unreachableBackendHint } from '../config/apiOrigin';
import { fetchWithAuth, parkgoFetch, clearSessionStorage } from '../utils/authFetch';

export function apiPath(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${String(API_BASE).replace(/\/$/, '')}${p}`;
}

function friendlyError(data, status) {
  if (data && typeof data.error === 'string' && data.error.trim()) return data.error;
  if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
  if (status === 401) return 'Please log in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 429) return 'Too many requests. Please wait and try again.';
  if (status >= 500) return 'Server error. Please try again later.';
  return 'Something went wrong. Please try again.';
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '';
  if (path.startsWith('/login') || path.startsWith('/signup')) return;
  const next = encodeURIComponent(path + window.location.search);
  window.location.assign(`/login?session=expired&next=${next}`);
}

/**
 * @param {string} path - e.g. '/reservations' or '/api/chat/history'
 * @param {RequestInit} [init]
 * @param {{ auth?: boolean }} [opts]
 */
export async function apiRequest(path, init = {}, { auth = true } = {}) {
  const url = apiPath(path);
  const headers = {
    Accept: 'application/json',
    ...(init.headers || {}),
  };
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && init.body != null && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = auth
      ? await fetchWithAuth(url, { ...init, headers })
      : await parkgoFetch(url, { ...init, headers });

    const text = await res.text();
    let data = null;
    if (text && text.trim()) {
      const trimmed = text.trimStart();
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<')) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error:
            'The server returned a webpage instead of JSON. Check that the backend is running and REACT_APP_API_BASE_URL points to it.',
        };
      }
      try {
        data = JSON.parse(text);
      } catch {
        return { ok: false, status: res.status, data: null, error: 'Invalid response from server.' };
      }
    }

    if (res.status === 401 && auth) {
      clearSessionStorage();
      redirectToLogin();
      return {
        ok: false,
        status: 401,
        data,
        error: friendlyError(data, 401),
        code: 'AUTH_EXPIRED',
      };
    }

    if (!res.ok || (data && data.ok === false)) {
      return {
        ok: false,
        status: res.status,
        data,
        error: friendlyError(data, res.status),
        code: data && data.code ? String(data.code) : undefined,
      };
    }

    return { ok: true, status: res.status, data: data ?? {} };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: unreachableBackendHint(),
      code: 'NETWORK',
    };
  }
}

export async function apiGet(path, auth = true) {
  return apiRequest(path, { method: 'GET' }, { auth });
}

export async function apiPost(path, body, auth = true) {
  return apiRequest(
    path,
    { method: 'POST', body: body != null ? JSON.stringify(body) : undefined },
    { auth }
  );
}

export async function apiPatch(path, body, auth = true) {
  return apiRequest(
    path,
    { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined },
    { auth }
  );
}

export async function apiDelete(path, auth = true) {
  return apiRequest(path, { method: 'DELETE' }, { auth });
}

/** Multipart form (e.g. incident photo upload). */
export async function apiPostForm(path, formData, auth = true) {
  return apiRequest(path, { method: 'POST', body: formData }, { auth });
}
