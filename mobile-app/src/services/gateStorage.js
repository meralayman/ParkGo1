import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'parkgo.gate.lastPreview';
const HISTORY_KEY = 'parkgo.gate.scanHistory';

export const gateStorage = {
  async setLastPreview(preview) {
    if (!preview) {
      await SecureStore.deleteItemAsync(KEY);
      return;
    }
    await SecureStore.setItemAsync(KEY, JSON.stringify(preview));
  },
  async getLastPreview() {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  },

  async addScanRecord(preview, action) {
    const bookingId = preview?.reservation?.id || '?';
    const act = action || preview?.nextAction || '?';
    const record = {
      id: Date.now().toString(),
      bookingId,
      slotNo: preview?.reservation?.slot_no || '?',
      status: preview?.reservation?.status || '?',
      userId: preview?.reservation?.user_id || '?',
      action: act,
      scannedAt: new Date().toISOString(),
    };
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      const isDuplicate = history.length > 0
        && history[0].bookingId === bookingId
        && history[0].action === act
        && (Date.now() - new Date(history[0].scannedAt).getTime()) < 30000;
      if (isDuplicate) return;
      history.unshift(record);
      const trimmed = history.slice(0, 100);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {}
  },

  async getScanHistory() {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async clearHistory() {
    await AsyncStorage.removeItem(HISTORY_KEY);
  },
};
