import { apiGet } from './client';

export async function fetchSlots() {
  const res = await apiGet('/slots', false);
  if (!res.ok) return { ok: false, error: res.error, slots: [] };
  return { ok: true, slots: res.data.slots || [] };
}
