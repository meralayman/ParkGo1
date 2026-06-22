export const ANU_OPEN_HOUR = 8;
export const ANU_CLOSE_HOUR = 18;
export const ANU_HOURS_LABEL = '08:00 AM – 06:00 PM';

export function validateBookingHours(timeStr, durationHours) {
  if (!timeStr) return { ok: false, error: 'Please select a start time.' };
  const [h, m] = timeStr.split(':').map(Number);
  const startMinutes = h * 60 + (m || 0);
  const endMinutes = startMinutes + durationHours * 60;

  if (startMinutes < ANU_OPEN_HOUR * 60) {
    return { ok: false, error: `Start time must be 08:00 AM or later. ANU parking: ${ANU_HOURS_LABEL}.` };
  }
  if (endMinutes > ANU_CLOSE_HOUR * 60) {
    return { ok: false, error: `Your reservation would end after 06:00 PM. ANU parking: ${ANU_HOURS_LABEL}.` };
  }
  return { ok: true };
}

export function maxDurationForStartTime(timeStr) {
  if (!timeStr) return 10;
  const [h, m] = timeStr.split(':').map(Number);
  const startMinutes = h * 60 + (m || 0);
  const remaining = ANU_CLOSE_HOUR * 60 - startMinutes;
  return Math.max(1, Math.floor(remaining / 60));
}
