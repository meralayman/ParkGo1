/**
 * @deprecated Use `./chat.service` — persistent chat via GET /api/chat/history and POST /api/chat/message.
 */
export {
  fetchChatHistory,
  sendChatMessage,
  sendChatMessage as sendChatbotMessage,
  CHAT_MIN_SEND_INTERVAL_MS,
  CHAT_MIN_SEND_INTERVAL_MS as CHATBOT_MIN_SEND_INTERVAL_MS,
} from './chat.service';
