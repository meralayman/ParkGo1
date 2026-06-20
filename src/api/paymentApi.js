import { apiGet, apiPost } from './client';

export async function fetchPaymobConfig() {
  const res = await apiGet('/paymob/config', false);
  if (!res.ok) return { ok: false, error: res.error, config: null };
  return { ok: true, config: res.data };
}

export async function createPaymobSession(payload) {
  const res = await apiPost('/paymob/session', payload);
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, data: res.data };
}
