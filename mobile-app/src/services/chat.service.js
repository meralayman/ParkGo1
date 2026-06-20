import { api } from './apiClient';

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
  try {
    const res = await api.get('/api/chat/history');
    const data = res?.data || {};
    if (!data.ok) {
      return {
        ok: false,
        error: data.error || 'Could not load messages. Check that you are logged in.',
        messages: [],
        code: res?.status === 401 ? 'AUTH_EXPIRED' : undefined,
      };
    }
    const messages = (Array.isArray(data.messages) ? data.messages : [])
      .map(mapMessage)
      .filter(Boolean);
    return { ok: true, messages };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Could not load chat history.',
      messages: [],
    };
  }
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

  try {
    const res = await api.post('/api/chat/message', {
      message,
      context: context && typeof context === 'object' ? context : {},
    });
    const data = res?.data || {};

    if (!data.ok) {
      return {
        ok: false,
        error: data.error || 'Something went wrong, please try again.',
        code: data.code ? String(data.code) : 'API_ERROR',
      };
    }

    return {
      ok: true,
      reply: typeof data.reply === 'string' ? data.reply : '',
      quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
      context: data.context && typeof data.context === 'object' ? data.context : {},
      userMessage: mapMessage(data.userMessage),
      botMessage: mapMessage(data.botMessage),
    };
  } catch (e) {
    const status = e?.response?.status;
    const data = e?.response?.data;

    if (status === 401) {
      return {
        ok: false,
        error: 'Your session expired. Please log in again, then reopen chat.',
        code: 'AUTH_EXPIRED',
      };
    }

    if (status === 429) {
      return {
        ok: false,
        error: data?.error || 'Too many requests. Please wait a moment.',
        code: 'RATE_LIMIT',
      };
    }

    return {
      ok: false,
      error: data?.error || e?.message || 'Something went wrong, please try again.',
      code: data?.code ? String(data.code) : 'NETWORK',
    };
  }
}
