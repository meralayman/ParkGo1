import { apiGet, apiPost, apiRequest } from './client';

export async function gatePreviewQr(qr) {
  const res = await apiPost('/gate/qr/preview', { qr });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data ?? { ok: false, error: res.error };
}

export async function gateGetBooking(bookingId) {
  const res = await apiGet(`/gate/booking/${encodeURIComponent(bookingId)}`);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data ?? { ok: false, error: res.error };
}

export async function gateCheckIn(bookingId) {
  const res = await apiPost('/gate/check-in', { bookingId });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data ?? { ok: false, error: res.error };
}

export async function gateCheckOut(bookingId) {
  const res = await apiPost('/gate/check-out', { bookingId });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data ?? { ok: false, error: res.error };
}

/** Physical gate device — validate QR and auto check-in/out (requires X-Gate-Device-Key). */
export async function gateDeviceScan(qr, { deviceKey, deviceId } = {}) {
  const headers = {};
  if (deviceKey) headers['X-Gate-Device-Key'] = deviceKey;
  if (deviceId) headers['X-Gate-Device-Id'] = deviceId;
  const res = await apiRequest(
    '/gate/device/scan',
    { method: 'POST', headers, body: JSON.stringify({ qr }) },
    { auth: false }
  );
  if (!res.ok) {
    return {
      ok: false,
      gateAction: 'deny',
      error: res.error,
      ...(res.data && typeof res.data === 'object' ? res.data : {}),
    };
  }
  return res.data ?? { ok: false, gateAction: 'deny', error: res.error };
}
