import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../utils/colors';
import { emitReservationsChanged, onReservationsChanged } from '../constants/parkgoEvents';
import { openLoginScreen } from '../navigation/navigationRef';
import { fetchChatHistory, sendChatMessage } from '../services/chat.service';
import { useAuth } from '../store/AuthContext';

const WELCOME =
  "Hi — I'm your ParkGo booking assistant. View active reservations, book parking, or cancel trips with confirmation.";

const DEFAULT_SUGGESTIONS = [
  'Show my bookings',
  'Show active reservations',
  'Cancel booking',
  'Cancel all bookings',
  'Check parking',
  'Help',
];

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function messageText(m) {
  return m?.text ?? m?.content ?? '';
}

function MessageBubble({ role, text, createdAt }) {
  const isUser = role === 'user';
  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{text}</Text>
      </View>
      {createdAt ? (
        <Text style={[styles.timeLabel, isUser && styles.timeLabelUser]}>{formatTime(createdAt)}</Text>
      ) : null}
    </View>
  );
}

export function Chatbot() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const { isAuthed } = useAuth();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [context, setContext] = useState({});
  const [quickReplies, setQuickReplies] = useState([]);

  const loadHistory = useCallback(async () => {
    if (!isAuthed) {
      setMessages([]);
      setHistoryError('');
      return;
    }
    setLoadingHistory(true);
    setHistoryError('');
    const result = await fetchChatHistory();
    setLoadingHistory(false);
    if (!result.ok) {
      setHistoryError(
        result.code === 'AUTH_EXPIRED'
          ? 'Your session expired. Please log in again.'
          : result.error || 'Could not load messages. Check that you are logged in.'
      );
      setMessages([]);
      return;
    }
    if (result.messages.length === 0) {
      setMessages([{ id: 'welcome', role: 'bot', text: WELCOME, createdAt: new Date().toISOString() }]);
    } else {
      setMessages(result.messages);
    }
  }, [isAuthed]);

  useEffect(() => {
    if (open && isAuthed) {
      loadHistory();
    }
  }, [open, isAuthed, loadHistory]);

  useEffect(() => {
    if (!isAuthed) {
      setMessages([]);
      setContext({});
      setQuickReplies([]);
      setHistoryError('');
    }
  }, [isAuthed]);

  useEffect(() => {
    return onReservationsChanged(() => {
      if (open && isAuthed) {
        loadHistory();
      }
    });
  }, [open, isAuthed, loadHistory]);

  useEffect(() => {
    if (!open || loadingHistory) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, pending, open, loadingHistory]);

  const handleSend = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim();
      if (!text || pending) return;

      if (!isAuthed) {
        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString() },
          {
            id: `b-${Date.now()}`,
            role: 'bot',
            text: 'Please log in to manage bookings and save your chat history.',
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      const optimisticUser = {
        id: `tmp-u-${Date.now()}`,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setInput('');
      setPending(true);
      setQuickReplies([]);

      const result = await sendChatMessage(text, context);

      setPending(false);

      if (!result.ok) {
        const msg =
          result.code === 'CLIENT_THROTTLE'
            ? result.error || 'You are sending messages too quickly. Please wait a moment.'
            : result.code === 'AUTH_EXPIRED'
              ? 'Your session expired. Please log in again, then reopen chat.'
              : result.error || 'Something went wrong. Please try again.';
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUser.id),
          result.userMessage || optimisticUser,
          {
            id: `b-err-${Date.now()}`,
            role: 'bot',
            text: msg,
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      setContext(result.context || {});
      setQuickReplies(result.quickReplies || []);

      setMessages((prev) => {
        const withoutTmp = prev.filter((m) => m.id !== optimisticUser.id);
        const next = [...withoutTmp];
        if (result.userMessage) next.push(result.userMessage);
        else next.push(optimisticUser);
        if (result.botMessage) next.push(result.botMessage);
        else if (result.reply) {
          next.push({
            id: `b-${Date.now()}`,
            role: 'bot',
            text: result.reply,
            createdAt: new Date().toISOString(),
          });
        }
        return next;
      });

      if (result.context?.reservationUpdated === true) {
        emitReservationsChanged();
      }
    },
    [context, pending, isAuthed]
  );

  const onSubmit = () => handleSend(input);

  const suggestionChips = quickReplies.length > 0 ? quickReplies : DEFAULT_SUGGESTIONS;
  const suggestionLabel = quickReplies.length > 0 ? 'Quick replies' : 'Suggested questions';
  const inputDisabled = pending || loadingHistory;
  const awaitingCancelConfirm =
    quickReplies.some((q) => /confirm cancel/i.test(q)) ||
    quickReplies.some((q) => /keep booking/i.test(q));

  const fabBottom = Math.max(insets.bottom, 12) + 64;

  const renderMessagesBody = () => {
    if (loadingHistory) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.logoBlue} />
          <Text style={styles.centerStateText}>Loading conversation…</Text>
        </View>
      );
    }

    if (historyError) {
      return (
        <View style={styles.errorBannerWrap}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{historyError}</Text>
            <Pressable onPress={loadHistory} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {!isAuthed && messages.length === 0 ? (
          <Text style={styles.emptyHint}>Ask a question — log in to save history.</Text>
        ) : null}
        {isAuthed && messages.length === 0 ? (
          <Text style={styles.emptyHint}>No messages yet. Try “Show my bookings”.</Text>
        ) : null}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            text={messageText(m)}
            createdAt={m.createdAt}
          />
        ))}

        {pending ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={Colors.logoBlueLight} />
            <Text style={styles.typingText}>Assistant is typing…</Text>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <>
      <Pressable
        accessibilityLabel={open ? 'Close chat assistant' : 'Open chat assistant'}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: fabBottom },
          pressed && styles.fabPressed,
        ]}
      >
        <Text style={styles.fabIcon}>{open ? '×' : '💬'}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>ParkGo assistant</Text>
              <Pressable
                accessibilityLabel="Close chat"
                onPress={() => setOpen(false)}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </Pressable>
            </View>

            {!isAuthed ? (
              <View style={styles.guestBanner}>
                <Text style={styles.guestBannerText}>
                  <Text style={styles.guestBannerLink} onPress={openLoginScreen}>
                    Log in
                  </Text>
                  {' '}to save chat history and manage bookings.
                </Text>
              </View>
            ) : null}

            {awaitingCancelConfirm ? (
              <View style={styles.hintBanner}>
                <Text style={styles.hintBannerText}>
                  Tap <Text style={styles.hintBold}>Confirm Cancel</Text> or{' '}
                  <Text style={styles.hintBold}>Keep Booking</Text> below to finish.
                </Text>
              </View>
            ) : null}

            <View style={styles.messagesBody}>{renderMessagesBody()}</View>

            <View style={styles.quickWrap}>
              <Text style={styles.quickLabel}>{suggestionLabel}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRow}
                keyboardShouldPersistTaps="handled"
              >
                {suggestionChips.map((label) => (
                  <Pressable
                    key={label}
                    disabled={inputDisabled}
                    onPress={() => handleSend(label)}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && styles.chipPressed,
                      inputDisabled && styles.chipDisabled,
                    ]}
                  >
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={isAuthed ? 'Ask about parking or bookings…' : 'Log in to chat…'}
                placeholderTextColor={Colors.muted}
                value={input}
                onChangeText={setInput}
                editable={!inputDisabled}
                maxLength={2000}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
              />
              <Pressable
                onPress={onSubmit}
                disabled={inputDisabled || !input.trim()}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (inputDisabled || !input.trim()) && styles.sendBtnDisabled,
                  pressed && styles.sendBtnPressed,
                ]}
              >
                <Text style={styles.sendBtnText}>{pending ? '…' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.logoBlue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: { opacity: 0.88 },
  fabIcon: { fontSize: 24, color: '#fff' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '88%',
    minHeight: '55%',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  panelTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
  },
  closeBtnText: { color: Colors.text, fontSize: 22, lineHeight: 24, fontWeight: '700' },
  guestBanner: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 193, 7, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guestBannerText: { color: '#664d03', fontSize: 13, lineHeight: 18 },
  guestBannerLink: { color: Colors.logoBlue, fontWeight: '800' },
  hintBanner: {
    backgroundColor: 'rgba(13, 110, 253, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 110, 253, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintBannerText: { color: '#084298', fontSize: 12, lineHeight: 17 },
  hintBold: { fontWeight: '800' },
  messagesBody: { flex: 1, minHeight: 0 },
  messages: { flex: 1 },
  messagesContent: { padding: 14, gap: 8, flexGrow: 1 },
  emptyHint: {
    color: Colors.muted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  bubbleWrap: { alignSelf: 'flex-start', maxWidth: '88%', gap: 4 },
  bubbleWrapUser: { alignSelf: 'flex-end' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: Colors.logoBlue,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: Colors.elevated,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: '#fff' },
  timeLabel: { color: Colors.muted, fontSize: 11, paddingLeft: 4 },
  timeLabelUser: { textAlign: 'right', paddingRight: 4 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  typingText: { color: Colors.muted, fontSize: 13 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerStateText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  errorBannerWrap: { flex: 1, justifyContent: 'center', padding: 14 },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorBannerText: { color: Colors.danger, fontSize: 13 },
  retryBtn: { alignSelf: 'flex-start' },
  retryBtnText: { color: Colors.logoBlueLight, fontWeight: '800' },
  quickWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingBottom: 6,
  },
  quickLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  quickRow: { paddingHorizontal: 12, gap: 8, flexDirection: 'row' },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipPressed: { opacity: 0.85 },
  chipDisabled: { opacity: 0.5 },
  chipText: { color: Colors.logoBlueLight, fontSize: 13, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: Colors.text,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: Colors.logoBlue,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnPressed: { opacity: 0.9 },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
