import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'parkgo_chatbot_context';

export async function loadChatbotContext() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export async function saveChatbotContext(context) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(context && typeof context === 'object' ? context : {}));
  } catch {
    /* ignore */
  }
}
