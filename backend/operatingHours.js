const ANU_TZ = "Africa/Cairo";
const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;
const OPERATING_HOURS_MSG =
  "ANU parking is available only between 08:00 AM and 06:00 PM.";

function getCairoDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ANU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year").value),
    month: Number(parts.find((p) => p.type === "month").value),
    day: Number(parts.find((p) => p.type === "day").value),
    hour: Number(parts.find((p) => p.type === "hour").value),
    minute: Number(parts.find((p) => p.type === "minute").value),
  };
}

function validateOperatingHours(startDt, endDt) {
  const s = getCairoDateParts(startDt);
  const e = getCairoDateParts(endDt);

  if (s.year !== e.year || s.month !== e.month || s.day !== e.day) {
    return {
      ok: false,
      error: `Reservations must start and end on the same day. ${OPERATING_HOURS_MSG}`,
    };
  }

  const startMinutes = s.hour * 60 + s.minute;
  const endMinutes = e.hour * 60 + e.minute;

  if (startMinutes < OPEN_HOUR * 60) {
    return {
      ok: false,
      error: `Reservations cannot start before 08:00 AM. ${OPERATING_HOURS_MSG}`,
    };
  }
  if (endMinutes > CLOSE_HOUR * 60) {
    return {
      ok: false,
      error: `Reservations cannot end after 06:00 PM. ${OPERATING_HOURS_MSG}`,
    };
  }
  return { ok: true };
}

module.exports = {
  ANU_TZ,
  OPEN_HOUR,
  CLOSE_HOUR,
  OPERATING_HOURS_MSG,
  getCairoDateParts,
  validateOperatingHours,
};
