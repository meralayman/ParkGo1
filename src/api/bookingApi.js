import { apiGet, apiPost, apiPatch } from './client';

export async function fetchUserReservations(userId) {
  const res = await apiGet(`/reservations/user/${encodeURIComponent(userId)}`);
  if (!res.ok) return { ok: false, error: res.error, reservations: [] };
  return { ok: true, reservations: res.data.reservations || [] };
}

export async function createReservation(payload) {
  const res = await apiPost('/reservations', payload);
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, data: res.data };
}

export async function cancelReservation(reservationId) {
  const res = await apiPatch(`/reservations/${encodeURIComponent(reservationId)}/cancel`);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function cancelReservationViaChat(reservationId) {
  const res = await apiPatch(`/api/chat/bookings/${encodeURIComponent(reservationId)}/cancel`);
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, data: res.data };
}

export async function cancelAllActiveBookings() {
  const res = await apiPatch('/api/chat/bookings/cancel-all');
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, data: res.data };
}

export async function fetchActiveBookings() {
  const res = await apiGet('/api/chat/bookings/active');
  if (!res.ok) return { ok: false, error: res.error, bookings: [] };
  return { ok: true, bookings: res.data.bookings || [] };
}

export async function extendOverstay(reservationId) {
  const res = await apiPost(`/reservations/${encodeURIComponent(reservationId)}/overstay-extend`, {});
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, data: res.data };
}
