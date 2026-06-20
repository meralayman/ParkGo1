import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export async function fetchAnalytics() {
  const res = await apiGet('/admin/analytics');
  if (!res.ok) return { ok: false, error: res.error, analytics: null };
  return { ok: true, analytics: res.data.analytics };
}

export async function fetchAdminUsers() {
  const res = await apiGet('/admin/users');
  if (!res.ok) return { ok: false, error: res.error, users: [] };
  return { ok: true, users: res.data.users || [] };
}

export async function fetchAdminReservations() {
  const res = await apiGet('/admin/reservations');
  if (!res.ok) return { ok: false, error: res.error, reservations: [] };
  return { ok: true, reservations: res.data.reservations || [] };
}

export async function fetchAdminIncidents() {
  const res = await apiGet('/admin/incidents');
  if (!res.ok) return { ok: false, error: res.error, incidents: [] };
  return { ok: true, incidents: res.data.incidents || [] };
}

export async function fetchAdminLogs(params = {}) {
  const qs = new URLSearchParams();
  if (params.userId) qs.set('user_id', params.userId);
  if (params.action) qs.set('action', params.action);
  const q = qs.toString();
  const res = await apiGet(`/admin/logs${q ? `?${q}` : ''}`);
  if (!res.ok) return { ok: false, error: res.error, logs: [] };
  return { ok: true, logs: res.data.logs || [] };
}

export async function fetchUserHistory(userId) {
  const res = await apiGet(`/admin/users/${encodeURIComponent(userId)}/history`);
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, data: res.data };
}

export async function createAdminUser(payload) {
  const res = await apiPost('/admin/users', payload);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, user: res.data.user };
}

export async function updateAdminUser(id, payload) {
  const res = await apiPatch(`/admin/users/${encodeURIComponent(id)}`, payload);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, user: res.data.user };
}

export async function deleteAdminUser(id) {
  const res = await apiDelete(`/admin/users/${encodeURIComponent(id)}`);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function createAdminSlot(slotNo) {
  const res = await apiPost('/admin/slots', { slot_no: slotNo });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function updateAdminSlot(slotNo, state) {
  const res = await apiPatch(`/admin/slots/${encodeURIComponent(slotNo)}`, { state });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function fetchSecurityAlerts(userId, afterId = 0) {
  const qs = new URLSearchParams({
    userId: String(userId),
    afterId: String(afterId),
  });
  const res = await apiGet(`/admin/security-alerts?${qs.toString()}`);
  if (!res.ok) return { ok: false, error: res.error, alerts: [] };
  return { ok: true, alerts: res.data.alerts || [] };
}
