import { apiGet, apiPost } from './client';

export const CHAT_MIN_SEND_INTERVAL_MS = 700;

let lastSendAt = 0;

function mapMessage(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    role: row.senderType === 'user' ? 'user' : 'bot',
    senderType: row.senderType,
    text: row.content,
    content: row.content,
    reservationId: row.reservationId || null,
    createdAt: row.createdAt,
  };
}

export async function fetchChatHistory() {
  const res = await apiGet('/api/chat/history');
  if (!res.ok) {
    return { ok: false, error: res.error, messages: [], code: res.code };
  }
  const messages = (Array.isArray(res.data.messages) ? res.data.messages : [])
    .map(mapMessage)
    .filter(Boolean);
  return { ok: true, messages };
}

export async function sendChatMessage(message, context = {}) {
  const now = Date.now();
  if (now - lastSendAt < CHAT_MIN_SEND_INTERVAL_MS) {
    return {
      ok: false,
      error: 'You are sending messages too quickly. Please wait a moment.',
      code: 'CLIENT_THROTTLE',
    };
  }
  lastSendAt = now;

  const res = await apiPost('/api/chat/message', {
    message,
    context: context && typeof context === 'object' ? context : {},
  });

  if (!res.ok) {
    return { ok: false, error: res.error, code: res.code };
  }

  const data = res.data;
  return {
    ok: true,
    reply: typeof data.reply === 'string' ? data.reply : '',
    quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
    context: data.context && typeof data.context === 'object' ? data.context : {},
    userMessage: mapMessage(data.userMessage),
    botMessage: mapMessage(data.botMessage),
  };
}
