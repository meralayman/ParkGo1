import { apiPostForm } from './client';

export async function submitIncident(formData) {
  const res = await apiPostForm('/incidents', formData);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function submitGatekeeperIncident(formData) {
  const res = await apiPostForm('/incidents/gatekeeper', formData);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}
