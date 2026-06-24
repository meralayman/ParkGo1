/**
 * API origin — in development, use empty string so requests go through CRA's
 * setupProxy.js (which forwards to the HTTPS backend with secure:false).
 * Production builds use the full URL from REACT_APP_API_BASE_URL or window.location.origin.
 */

const LOCAL_API = '';

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function getApiBase() {
  if (process.env.NODE_ENV === 'development') {
    return LOCAL_API;
  }

  const raw = process.env.REACT_APP_API_BASE_URL;
  if (raw != null && String(raw).trim() !== '') {
    return normalizeBase(raw);
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export const API_BASE = getApiBase();

export function unreachableBackendHint() {
  if (process.env.NODE_ENV === 'development') {
    return (
      'Cannot reach the ParkGo API. ' +
      'Start the backend: cd backend && npm start'
    );
  }
  const target = API_BASE || window.location.origin;
  return `Cannot reach the API at ${target}. Check that the backend is running.`;
}
