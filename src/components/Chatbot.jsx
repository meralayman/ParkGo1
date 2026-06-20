import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PARKGO_RESERVATIONS_CHANGED } from '../constants/parkgoEvents';
import { fetchChatHistory, sendChatMessage } from '../api/chatApi';
import './Chatbot.css';

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

function MessageList({ messages, typing, scrollRef }) {
  const endRef = useRef(null);

  useEffect(() => {
    const el = scrollRef?.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typing, scrollRef]);

  if (messages.length === 0 && !typing) {
    return null;
  }

  return (
    <div className="parkgo-chatbot-messages" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`parkgo-chatbot-bubble-row parkgo-chatbot-bubble-row--${m.role}`}>
          <div className={`parkgo-chatbot-bubble parkgo-chatbot-bubble--${m.role}`}>
            {messageText(m)}
          </div>
          {m.createdAt ? (
            <time className="parkgo-chatbot-time" dateTime={m.createdAt}>
              {formatTime(m.createdAt)}
            </time>
          ) : null}
        </div>
      ))}
      {typing ? (
        <div className="parkgo-chatbot-typing">Assistant is typing…</div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

export default function Chatbot() {
  const { user } = useAuth();
  const isAuthed = Boolean(user?.id);
  const messagesScrollRef = useRef(null);

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
      setHistoryError(result.error || 'Could not load messages. Check that you are logged in.');
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
    }
  }, [isAuthed]);

  useEffect(() => {
    const onResChanged = () => {
      if (open && isAuthed) loadHistory();
    };
    window.addEventListener(PARKGO_RESERVATIONS_CHANGED, onResChanged);
    return () => window.removeEventListener(PARKGO_RESERVATIONS_CHANGED, onResChanged);
  }, [open, isAuthed, loadHistory]);

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
        try {
          window.dispatchEvent(new CustomEvent(PARKGO_RESERVATIONS_CHANGED));
        } catch {
          /* ignore */
        }
      }
    },
    [context, pending, isAuthed]
  );

  const onSubmit = (e) => {
    e.preventDefault();
    handleSend(input);
  };

  const suggestionChips = quickReplies.length > 0 ? quickReplies : DEFAULT_SUGGESTIONS;
  const suggestionLabel = quickReplies.length > 0 ? 'Quick replies' : 'Suggested questions';
  const inputDisabled = pending || loadingHistory;
  const awaitingCancelConfirm =
    quickReplies.some((q) => /confirm cancel/i.test(q)) ||
    quickReplies.some((q) => /keep booking/i.test(q));

  return (
    <>
      <button
        type="button"
        className="parkgo-chatbot-fab"
        aria-label="Open chat assistant"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '×' : '💬'}
      </button>

      {open ? (
        <section className="parkgo-chatbot-panel" aria-label="ParkGo assistant chat">
          <header className="parkgo-chatbot-panel__head">
            <span>ParkGo assistant</span>
            <button
              type="button"
              className="parkgo-chatbot-panel__close"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          {!isAuthed ? (
            <div className="parkgo-chatbot-guest-banner" role="note">
              <a href="/login">Log in</a> to save chat history and manage bookings.
            </div>
          ) : null}

          {awaitingCancelConfirm ? (
            <div className="parkgo-chatbot-hint" role="status">
              Tap <strong>Confirm Cancel</strong> or <strong>Keep Booking</strong> below to finish.
            </div>
          ) : null}

          <div className="parkgo-chatbot-body">
            {loadingHistory ? (
              <div className="parkgo-chatbot-loading">Loading conversation…</div>
            ) : historyError ? (
              <div className="parkgo-chatbot-error">
                <p>{historyError}</p>
                <button type="button" onClick={loadHistory}>
                  Retry
                </button>
              </div>
            ) : (
              <div ref={messagesScrollRef} className="parkgo-chatbot-messages-wrap">
                {!isAuthed && messages.length === 0 ? (
                  <div className="parkgo-chatbot-empty">Ask a question — log in to save history.</div>
                ) : null}
                {isAuthed && messages.length === 0 ? (
                  <div className="parkgo-chatbot-empty">No messages yet. Try “Show my bookings”.</div>
                ) : null}
                <MessageList messages={messages} typing={pending} scrollRef={messagesScrollRef} />
              </div>
            )}
          </div>

          <div className="parkgo-chatbot-quick-wrap">
            <div className="parkgo-chatbot-quick__label">{suggestionLabel}</div>
            <div className="parkgo-chatbot-quick" role="group" aria-label="Suggested questions">
              {suggestionChips.map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={inputDisabled}
                  onClick={() => handleSend(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <form className="parkgo-chatbot-inputrow" onSubmit={onSubmit}>
            <input
              type="text"
              maxLength={2000}
              placeholder={isAuthed ? 'Ask about parking or bookings…' : 'Log in to chat…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={inputDisabled}
              autoComplete="off"
            />
            <button type="submit" disabled={inputDisabled || !input.trim()}>
              {pending ? '…' : 'Send'}
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
