import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './AuthPages.css';
import './Dashboard.css';
import { formatEgp } from '../utils/formatEgp';
import { apiUnreachableMessage, apiBaseForErrors } from '../config/apiBase';
import { createPaymobSession, fetchPaymobConfig } from '../api/paymentApi';

const PAY_PENDING_KEY = 'parkgo_pay_pending';

function redirectLockKey(paymentAttempt) {
  return `parkgo_paymob_redirect_${paymentAttempt}`;
}

function friendlyFetchError(err) {
  const msg = err && err.message ? String(err.message) : '';
  if (
    /failed to fetch|fetch failed|networkerror|load failed|network request failed|econnrefused|when attempting to fetch resource/i.test(
      msg
    )
  ) {
    return apiUnreachableMessage();
  }
  return msg || 'Request failed';
}

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const pending = location.state?.pendingReservation;

  const [error, setError] = useState('');
  const [paymobEnabled, setPaymobEnabled] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | redirecting | error
  const [showStuckHint, setShowStuckHint] = useState(false);

  const attemptRef = useRef(null);

  const paymentAttempt = pending?.paymentAttempt ?? null;

  const billingPayload = useCallback(
    () => ({
      first_name: user?.first_name || user?.firstName || 'Customer',
      last_name: user?.last_name || user?.lastName || 'ParkGo',
      email: user?.email || 'user@example.com',
      phone_number: user?.phone_number || user?.phoneNumber || '+201000000000',
    }),
    [user]
  );

  const redirectToPaymob = useCallback(async () => {
    if (!pending || !user?.id) return;
    const attempt = pending.paymentAttempt;
    if (attempt == null) {
      setError('Missing payment attempt id. Go back and choose Card (Paymob) again.');
      setPhase('error');
      return;
    }

    const lk = redirectLockKey(attempt);
    if (sessionStorage.getItem(lk) === '1') {
      setPhase('idle');
      return;
    }
    sessionStorage.setItem(lk, '1');
    setShowStuckHint(false);
    setError('');
    setPhase('redirecting');
    try {
      sessionStorage.setItem(
        PAY_PENDING_KEY,
        JSON.stringify({
          userId: user.id,
          startTime: pending.startTime,
          endTime: pending.endTime,
          totalAmount: pending.totalAmount,
          slotNo: pending.slotNo,
        })
      );

      const result = await createPaymobSession({
        amount: pending.totalAmount,
        billing: billingPayload(),
      });

      if (!result.ok) {
        sessionStorage.removeItem(lk);
        setError(result.error || 'Could not start Paymob');
        setPhase('error');
        return;
      }

      const data = result.data;
      if (!data.iframeUrl) {
        sessionStorage.removeItem(lk);
        setError('Paymob did not return a checkout URL.');
        setPhase('error');
        return;
      }

      window.location.assign(data.iframeUrl);
    } catch (err) {
      sessionStorage.removeItem(lk);
      setError(friendlyFetchError(err));
      setPhase('error');
    }
  }, [pending, user, billingPayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchPaymobConfig();
        if (cancelled) return;
        if (!result.ok) {
          setPaymobEnabled(false);
          setError(result.error || `Is the backend running at ${apiBaseForErrors()}?`);
          setPhase('error');
          return;
        }
        const d = result.config;
        if (d && d.ok) setPaymobEnabled(Boolean(d.enabled));
        else setPaymobEnabled(false);
      } catch (err) {
        if (!cancelled) {
          setPaymobEnabled(false);
          setError(friendlyFetchError(err));
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pending || !user?.id) return;
    if (paymobEnabled !== true) return;
    if (paymentAttempt == null) return;
    if (attemptRef.current === paymentAttempt) return;
    attemptRef.current = paymentAttempt;
    redirectToPaymob();
  }, [pending, user?.id, paymobEnabled, paymentAttempt, redirectToPaymob]);

  useEffect(() => {
    if (paymobEnabled !== true || phase !== 'idle' || error) return;
    const t = setTimeout(() => setShowStuckHint(true), 2500);
    return () => clearTimeout(t);
  }, [paymobEnabled, phase, error]);

  const retry = () => {
    if (paymentAttempt != null) {
      sessionStorage.removeItem(redirectLockKey(paymentAttempt));
    }
    attemptRef.current = null;
    setShowStuckHint(false);
    setPhase('idle');
    setError('');
    redirectToPaymob();
  };

  if (!pending || !user?.id) {
    return (
      <div className="auth-page-wrap">
        <Navbar />
        <div className="auth-container">
          <div className="auth-card">
            <h2>Invalid session</h2>
            <p className="auth-subtitle">No pending payment. Start from a new reservation.</p>
            <button type="button" className="auth-button" onClick={() => navigate('/user')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const amount = pending?.totalAmount ?? 0;

  return (
    <div className="auth-page-wrap">
      <Navbar />
      <div className="auth-container">
        <div className="auth-card payment-card">
          <h2>Pay with Paymob</h2>
          <p className="auth-subtitle">
            Amount due: <strong>{formatEgp(amount)}</strong>
          </p>

          {error && <div className="error-message">{error}</div>}

          {paymobEnabled === null && phase !== 'error' && (
            <p className="auth-subtitle">Connecting to payment…</p>
          )}

          {paymobEnabled === false && !error && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              Card payment uses Paymob only. Add <code>PAYMOB_API_KEY</code>,{' '}
              <code>PAYMOB_INTEGRATION_ID</code>, and <code>PAYMOB_IFRAME_ID</code> to{' '}
              <code>backend/.env</code>, then restart the API server.
            </div>
          )}

          {paymobEnabled === true && phase === 'redirecting' && !error && (
            <p className="auth-subtitle">Redirecting you to Paymob secure checkout…</p>
          )}

          {(phase === 'error' || showStuckHint) && paymobEnabled === true && (
            <button type="button" className="auth-button" onClick={retry}>
              Try Paymob again
            </button>
          )}

          {showStuckHint && phase === 'idle' && !error && paymobEnabled === true && (
            <p className="auth-subtitle" style={{ fontSize: 13, marginTop: 8 }}>
              If nothing happens, tap <strong>Try Paymob again</strong> (this clears a stuck payment lock).
            </p>
          )}

          <button
            type="button"
            className="btn btn-secondary mt-3 w-100"
            onClick={() => navigate('/user')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
