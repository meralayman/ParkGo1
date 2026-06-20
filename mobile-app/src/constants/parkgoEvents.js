/** Lightweight pub/sub when chatbot (or other flows) change bookings. */

const listeners = new Set();

export function emitReservationsChanged() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function onReservationsChanged(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
