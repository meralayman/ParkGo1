import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { useNotifier } from '../context/NotifierContext';
import Navbar from '../components/Navbar';
import DemandGuidanceBanner from '../components/DemandGuidanceBanner';
import SmartParkingAssistant from '../components/SmartParkingAssistant';
import ParkingRulesSection from '../components/ParkingRulesSection';
import ANUParkingMap from '../components/ANUParkingMap';
import { LOT_NAME } from '../constants/alexandriaLot';
import { PARKGO_PENDING_SLOT_KEY } from '../constants/pendingSlot';
import { formatEgp } from '../utils/formatEgp';
import './Dashboard.css';

import { fetchSlots as apiFetchSlots } from '../api/slotApi';
import {
  fetchUserReservations,
  createReservation,
  cancelReservation,
  cancelAllActiveBookings,
  extendOverstay,
} from '../api/bookingApi';
import { PARKGO_RESERVATIONS_CHANGED } from '../constants/parkgoEvents';
import { fetchParkingDemandInsight } from '../utils/parkingDemandHint';
import {
  CHECK_IN_DEADLINE_MINUTES,
  CHECK_IN_WARNING_LEAD_MINUTES,
} from '../constants/checkInDeadline';
import { tieredBookingTotalEgp, extraHourChargeEgp } from '../utils/parkingPricing';
import { useParkgoPaymentSuccessToast } from '../hooks/useParkgoPaymentSuccessToast';

/** Match backend overstay / extend extra-per-hour; set REACT_APP_OVERSTAY_HOURLY_RATE to override display. */
const OVERSTAY_RATE_DISPLAY =
  Number(process.env.REACT_APP_OVERSTAY_HOURLY_RATE) || extraHourChargeEgp();

/** Inline booking fieldset — used for Continue → scroll + reveal animation. */
const UDB_BOOKING_FIELDSET_ID = 'udb-booking-fieldset';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, confirm } = useNotifier();

  useParkgoPaymentSuccessToast(toast);

  const [reservations, setReservations] = useState([]);
  const [history, setHistory] = useState([]);

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [reservationsError, setReservationsError] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState(null);
  const [cancelAllBusy, setCancelAllBusy] = useState(false);

  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showExitQRModal, setShowExitQRModal] = useState(false);
  const [exitQRReservation, setExitQRReservation] = useState(null);
  const [reservationData, setReservationData] = useState({
    date: '',
    time: '',
    duration: '1',
    vehicleType: 'car',
    paymentMethod: 'cash'
  });

  /** Tiered estimate shown in modal (matches backend tariff: first hour + extra hours). */
  const reservationModalEstimateEgp = useMemo(() => {
    const raw = parseFloat(String(reservationData.duration).trim(), 10);
    const hours = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return tieredBookingTotalEgp(hours);
  }, [reservationData.duration]);

  /** Slot chosen on the public map or here; kept in localStorage across login */
  const [pendingSlotNo, setPendingSlotNo] = useState(null);

  /** Demand insight for reservation modal (High / Low banners) */
  const [demandInsight, setDemandInsight] = useState(null);
  const [demandInsightLoading, setDemandInsightLoading] = useState(false);

  const clearPendingSlot = () => {
    setPendingSlotNo(null);
    try {
      localStorage.removeItem(PARKGO_PENDING_SLOT_KEY);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PARKGO_PENDING_SLOT_KEY);
      if (saved) setPendingSlotNo(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadReservationsAndHistory();
    }
  }, [user?.id]);

  /** Chatbot (and other clients) can create/cancel bookings without a full page reload. */
  useEffect(() => {
    if (!user?.id) return undefined;
    const onReservationsChanged = () => {
      loadReservationsAndHistory();
      loadSlots();
    };
    window.addEventListener(PARKGO_RESERVATIONS_CHANGED, onReservationsChanged);
    return () =>
      window.removeEventListener(PARKGO_RESERVATIONS_CHANGED, onReservationsChanged);
  }, [user?.id]);


  /** Demand hint for popup modal (same times as inline booking panel). */
  useEffect(() => {
    if (!reservationData.date || !reservationData.time) {
      setDemandInsight(null);
      setDemandInsightLoading(false);
      return;
    }

    const startTime = new Date(`${reservationData.date}T${reservationData.time}`);
    if (Number.isNaN(startTime.getTime())) {
      setDemandInsight(null);
      return;
    }

    let cancelled = false;
    setDemandInsightLoading(true);
    const t = setTimeout(async () => {
      try {
        const insight = await fetchParkingDemandInsight(startTime);
        if (cancelled) return;
        setDemandInsight(insight ?? null);
      } finally {
        if (!cancelled) setDemandInsightLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [reservationData.date, reservationData.time]);

  /** Valid arrival ⇒ Smart Parking Assistant expands with full insight payload. */
  const schedulingReady = useMemo(() => {
    if (!reservationData.date?.trim() || !reservationData.time?.trim()) return false;
    const start = new Date(`${reservationData.date}T${reservationData.time}`);
    return !Number.isNaN(start.getTime());
  }, [reservationData.date, reservationData.time]);

  const canConfirmBooking = schedulingReady && Boolean(pendingSlotNo);

  /** Short feedback above SPA after date + time (uses same demand insight as modal). */
  const demandToneBanner = useMemo(() => {
    if (!schedulingReady || !pendingSlotNo) return null;
    if (demandInsightLoading) {
      return { modifier: 'loading', emoji: '📊', headline: 'Checking demand for your arrival…' };
    }
    const norm = String(demandInsight?.level || '').toLowerCase();
    if (norm === 'low') return { modifier: 'low', emoji: '🟢', headline: 'Great time to book' };
    if (norm === 'medium') return { modifier: 'mid', emoji: '🟡', headline: 'Moderate traffic expected' };
    if (norm === 'high') return { modifier: 'high', emoji: '🔴', headline: 'High demand — consider another time' };
    return { modifier: 'neutral', emoji: 'ℹ️', headline: 'Demand insight will refine as models respond.' };
  }, [schedulingReady, pendingSlotNo, demandInsightLoading, demandInsight]);

  const schedulingReadyEnteredRef = useRef(false);

  useEffect(() => {
    if (!schedulingReady) {
      schedulingReadyEnteredRef.current = false;
      return undefined;
    }
    if (schedulingReadyEnteredRef.current) return undefined;
    schedulingReadyEnteredRef.current = true;
    const tid = window.setTimeout(() => {
      document.getElementById('user-dash-assistant-stack')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 420);
    return () => window.clearTimeout(tid);
  }, [schedulingReady]);

  const scrollToBookingPanel = () => {
    const panel = document.getElementById('user-dash-booking-panel');
    panel?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const fs = document.getElementById(UDB_BOOKING_FIELDSET_ID);
        if (!fs) return;
        fs.classList.remove('user-dash-inline-form--continue-reveal');
        void fs.offsetWidth;
        fs.classList.add('user-dash-inline-form--continue-reveal');
        const onAnimationEnd = () => {
          fs.classList.remove('user-dash-inline-form--continue-reveal');
          fs.removeEventListener('animationend', onAnimationEnd);
        };
        fs.addEventListener('animationend', onAnimationEnd);
      }, 72);
    });
  };

  const pendingSlotLive = useMemo(() => {
    if (!pendingSlotNo) return null;
    return { label: 'Available', tone: 'available' };
  }, [pendingSlotNo]);

  const loadSlots = async () => {
    setSlotsLoading(true);
    setSlotsError('');
    try {
      const result = await apiFetchSlots();
      if (result.ok) {
        setSlots(result.slots);
      } else {
        setSlotsError(result.error || 'Failed to load slots');
      }
    } catch (err) {
      setSlotsError(err.message || 'Cannot reach server');
    } finally {
      setSlotsLoading(false);
    }
  };

  const mapApiReservationToUI = (r) => {
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    const durationHours = Math.max(1, Math.round((end - start) / (1000 * 60 * 60)));

    return {
      id: r.id,
      parkingSpot: r.slot_no,
      date: r.start_time,
      endTime: r.end_time,
      time: start.toTimeString().slice(0, 5),
      duration: durationHours,
      vehicleType: r.vehicle_type || '-',
      totalAmount: Number(r.total_amount) || 0,
      status: r.status,
      createdAt: r.created_at,
      checkInTime: r.check_in_time,
      checkOutTime: r.check_out_time,
      paymentMethod: r.payment_method || 'cash',
      qrJwt: r.qrJwt || null,
    };
  };

  const bookingQrValue = (reservation) =>
    (reservation && (reservation.qrJwt || reservation.qr_jwt)) || String(reservation.id);

  const loadReservationsAndHistory = async () => {
    if (!user?.id) {
      setReservations([]);
      setHistory([]);
      setReservationsLoading(false);
      return;
    }

    setReservationsLoading(true);
    setReservationsError('');
    try {
      const result = await fetchUserReservations(user.id);

      if (result.ok && Array.isArray(result.reservations)) {
        const mapped = result.reservations.map(mapApiReservationToUI);

        const active = mapped.filter((r) => ['confirmed', 'checked_in'].includes(r.status));
        setReservations(active);

        const hist = mapped
          .filter((r) => !['confirmed', 'checked_in'].includes(r.status))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHistory(hist);
      } else {
        setReservationsError(result.error || 'Failed to load bookings');
      }
    } catch (err) {
      setReservationsError(err.message || 'Cannot reach server');
    } finally {
      setReservationsLoading(false);
    }
  };

  const handleReservationChange = (e) => {
    setReservationData({
      ...reservationData,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateReservation = async () => {
    if (!reservationData.date || !reservationData.time || !reservationData.duration) {
      toast('Please fill in date, time, and duration', { variant: 'error' });
      return;
    }

    const duration = parseFloat(reservationData.duration) || 1;
    const startTime = new Date(`${reservationData.date}T${reservationData.time}`);
    const totalAmount = tieredBookingTotalEgp(duration, startTime);
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    const isCard = reservationData.paymentMethod === 'card';

    if (isCard) {
      setShowReservationModal(false);
      setReservationData({
        date: '',
        time: '',
        duration: '1',
        vehicleType: 'car',
        paymentMethod: 'cash'
      });
      navigate('/payment', {
        state: {
          pendingReservation: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            totalAmount,
            paymentAttempt: Date.now(),
          },
        },
      });
      return;
    }

    setBookingSubmitting(true);
    try {
      const result = await createReservation({
        userId: user.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalAmount,
        paymentMethod: 'cash',
      });

      if (!result.ok) {
        toast(result.error || 'Failed to create reservation', { variant: 'error' });
        return;
      }

      await loadReservationsAndHistory();
      await loadSlots();

      clearPendingSlot();
      setShowReservationModal(false);
      setReservationData({
        date: '',
        time: '',
        duration: '1',
        vehicleType: 'car',
        paymentMethod: 'cash'
      });

      const reservation = result.data?.reservation || {};
      toast(
        `Reservation created\nSlot: ${reservation.slot_no}\nBooking ID: ${reservation.id}\nShow your booking QR at the gate (ID ${reservation.id}).`,
        { variant: 'success', duration: 9000 }
      );
    } catch (err) {
      toast(err.message || 'Cannot reach server', { variant: 'error' });
    } finally {
      setBookingSubmitting(false);
    }
  };

  const overdueReservations = useMemo(() => {
    const now = Date.now();
    return reservations.filter(
      (r) =>
        ['confirmed', 'checked_in'].includes(r.status) &&
        r.endTime &&
        new Date(r.endTime).getTime() < now
    );
  }, [reservations]);

  const [overstayActionLoading, setOverstayActionLoading] = useState(false);

  /** Live clock for check-in deadline countdown (confirmed bookings only) */
  const [nowTick, setNowTick] = useState(() => Date.now());
  const checkInAlertedRef = useRef(new Set());

  const formatMsAsCountdown = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m <= 0) return `${sec} second${sec !== 1 ? 's' : ''}`;
    return `${m} min ${sec.toString().padStart(2, '0')} sec`;
  };

  /** Confirmed bookings within the final warning window before auto-cancel (no gate scan). */
  const checkInUrgentWarnings = useMemo(() => {
    const now = nowTick;
    const windowMs = CHECK_IN_DEADLINE_MINUTES * 60 * 1000;
    const warnMs = CHECK_IN_WARNING_LEAD_MINUTES * 60 * 1000;
    const out = [];
    for (const r of reservations) {
      if (r.status !== 'confirmed') continue;
      const startMs = new Date(r.date).getTime();
      const deadlineMs = startMs + windowMs;
      const msLeft = deadlineMs - now;
      if (msLeft > 0 && msLeft <= warnMs) {
        out.push({
          id: r.id,
          parkingSpot: r.parkingSpot,
          msLeft,
          deadlineMs,
        });
      }
    }
    return out;
  }, [reservations, nowTick]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const hasConfirmed = reservations.some((r) => r.status === 'confirmed');
    if (!hasConfirmed) return undefined;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [user?.id, reservations]);

  useEffect(() => {
    checkInUrgentWarnings.forEach((w) => {
      if (checkInAlertedRef.current.has(w.id)) return;
      checkInAlertedRef.current.add(w.id);
      const mins = Math.max(1, Math.ceil(w.msLeft / 60000));
      toast(
        `Urgent: check in at the gate soon.\n\nBooking #${w.id} (spot ${w.parkingSpot}): about ${mins} minute${
          mins !== 1 ? 's' : ''
        } left before this reservation is cancelled if you are not scanned in.`,
        { variant: 'warning', duration: 12000 }
      );
    });
  }, [checkInUrgentWarnings, toast]);

  const handleOverstayExtend = async (reservationId) => {
    if (!user?.id) return;
    setOverstayActionLoading(true);
    try {
      const result = await extendOverstay(reservationId);
      if (!result.ok) {
        toast(result.error || 'Could not extend reservation', { variant: 'error' });
        return;
      }
      await loadReservationsAndHistory();
      await loadSlots();
      toast(result.data?.message || 'Reservation extended by 1 hour.', { variant: 'success' });
    } catch (err) {
      toast(err.message || 'Cannot reach server', { variant: 'error' });
    } finally {
      setOverstayActionLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    const t = setInterval(() => {
      loadReservationsAndHistory();
    }, 45000);
    return () => clearInterval(t);
  }, [user?.id]);

  const displayName = useMemo(() => {
    if (!user) return 'there';
    const first = user.first_name || user.firstName || '';
    const last = user.last_name || user.lastName || '';
    const combined = `${first} ${last}`.trim();
    return combined || user.username || 'there';
  }, [user]);

  const confirmedBookingsCount = useMemo(
    () => reservations.filter((r) => r.status === 'confirmed').length,
    [reservations]
  );

  const handleCancelAllActive = async () => {
    if (confirmedBookingsCount === 0) {
      toast('No confirmed bookings to cancel.', { variant: 'info' });
      return;
    }
    const ok = await confirm({
      title: 'Cancel all active bookings?',
      message: `This will cancel ${confirmedBookingsCount} confirmed booking(s). Spots will be released for others.`,
      confirmLabel: 'Yes, cancel all',
      cancelLabel: 'Keep bookings',
      danger: true,
    });
    if (!ok) return;

    setCancelAllBusy(true);
    try {
      const result = await cancelAllActiveBookings();
      if (!result.ok) {
        toast(result.error || 'Failed to cancel bookings', { variant: 'error' });
        return;
      }
      await loadReservationsAndHistory();
      await loadSlots();
      const n = result.data?.cancelledCount ?? confirmedBookingsCount;
      toast(n > 0 ? `Cancelled ${n} booking(s).` : 'No bookings were cancelled.', {
        variant: 'success',
      });
    } catch (err) {
      toast(err.message || 'Cannot reach server', { variant: 'error' });
    } finally {
      setCancelAllBusy(false);
    }
  };

  const handleCancelReservation = async (id) => {
    const ok = await confirm({
      title: 'Cancel reservation?',
      message: 'Are you sure you want to cancel this reservation? The spot will be released for others.',
      confirmLabel: 'Yes, cancel',
      cancelLabel: 'Keep booking',
      danger: true,
    });
    if (!ok) return;

    setCancelBusyId(id);
    try {
      const result = await cancelReservation(id);

      if (!result.ok) {
        toast(result.error || 'Failed to cancel reservation', { variant: 'error' });
        return;
      }

      await loadReservationsAndHistory();
      await loadSlots();
      toast('Reservation cancelled.', { variant: 'success' });
    } catch (err) {
      toast(err.message || 'Cannot reach server', { variant: 'error' });
    } finally {
      setCancelBusyId(null);
    }
  };

  return (
    <div className={`dashboard user-dashboard-flow${canConfirmBooking ? ' user-dashboard-flow--sticky' : ''}`}>
      <Navbar hideLotDesignerLink />
      <header className="dashboard-header user-dashboard-flow__masthead">
        <div className="user-dash-masthead-row">
          <div className="user-dash-masthead-intro">
            <h1>User Dashboard</h1>
            <p>
              Welcome back, {displayName}.
              <br />
              Choose your parking spot to begin.
            </p>
          </div>
          <button
            type="button"
            className="btn user-dash-report-incident-btn"
            onClick={() => navigate('/user/report-incident')}
          >
            Report an incident
          </button>
        </div>
      </header>

      <div className="dashboard-content user-dashboard-flow__main">
        {checkInUrgentWarnings.length > 0 && (
          <div className="checkin-deadline-panel" role="alert" aria-live="polite">
            {checkInUrgentWarnings.map((w) => (
              <div key={w.id} className="checkin-deadline-card">
                <h3 className="checkin-deadline-title">Check in soon — reservation at risk</h3>
                <p className="checkin-deadline-text">
                  Booking <strong>#{w.id}</strong> (spot <strong>{w.parkingSpot}</strong>): the gate must scan your QR
                  before{' '}
                  <strong>{new Date(w.deadlineMs).toLocaleString()}</strong> — about{' '}
                  <strong className="checkin-deadline-countdown">{formatMsAsCountdown(w.msLeft)}</strong> left. After
                  that, this booking may be cancelled and the spot released.
                </p>
              </div>
            ))}
          </div>
        )}

        {overdueReservations.length > 0 && (
          <div className="overstay-panel" role="region" aria-label="Parking time ended">
            {overdueReservations.map((ov) => (
              <div key={ov.id} className="overstay-card">
                <h3 className="overstay-title">Parking time ended</h3>
                <p className="overstay-text">
                  Spot <strong>{ov.parkingSpot}</strong> — your booking ended at{' '}
                  <strong>{new Date(ov.endTime).toLocaleString()}</strong>. Add another hour below if you need more time.
                  If you leave without extending, extra fees apply: <strong>{OVERSTAY_RATE_DISPLAY.toFixed(2)} EGP per hour</strong> for each full hour past your end time (rounded up), added when you scan out at the gate.
                </p>
                <div className="overstay-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={overstayActionLoading}
                    onClick={() => handleOverstayExtend(ov.id)}
                  >
                    {`Add 1 more hour (+${extraHourChargeEgp().toFixed(2)} EGP)`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-section parking-overview-dashboard dashboard-section--map dashboard-section--featured user-dash-map-first">
          <h2 id="user-dash-map-heading">Parking map — choose your bay</h2>
          <p className="parking-overview-hint">
            <strong>{LOT_NAME}</strong> — select a parking area, then tap a slot. You get
            instant confirmation before scheduling date and time.
          </p>

          <ANUParkingMap
            onSlotConfirm={(area, slotNo) => {
              setPendingSlotNo(slotNo);
              try {
                localStorage.setItem(PARKGO_PENDING_SLOT_KEY, slotNo);
              } catch { /* ignore */ }
              scrollToBookingPanel();
            }}
          />
        </div>

        <div id="user-dash-booking-panel" className="dashboard-section dashboard-section--booking-controls user-dash-booking-card">
          <div className="user-dash-booking-card__top">
            <div>
              <h2>Your booking</h2>
              <p className="dashboard-section-intro">
                Pick a bay on the map, then set arrival details—the Smart Parking Assistant expands once date and time are
                complete.
              </p>
            </div>
            {pendingSlotNo ? (
              <div className="user-dash-slot-chip" aria-live="polite">
                <span className="user-dash-slot-chip__label">Selected bay</span>
                <strong className="user-dash-slot-chip__spot">{pendingSlotNo}</strong>
                {pendingSlotLive && (
                  <span
                    className={`user-dash-slot-badge user-dash-slot-badge--${pendingSlotLive.tone}`}
                    title="Status on the map right now"
                  >
                    {pendingSlotLive.label}
                  </span>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearPendingSlot}>
                  Clear bay
                </button>
              </div>
            ) : (
              <p className="user-dash-slot-hint-muted" role="status">
                No bay selected — choose a green slot on the map above.
              </p>
            )}
          </div>

          <ParkingRulesSection />

          <div
            className={`user-dash-scheduling-block ${pendingSlotNo ? 'user-dash-scheduling-block--open' : 'user-dash-scheduling-block--locked'}`}
          >
            {!pendingSlotNo ? (
              <p className="user-dash-scheduling-block__shield" role="note">
                Select an <strong>available</strong> bay on the map above to show date, start time, duration, and payment
                options here.
              </p>
            ) : (
              <fieldset id={UDB_BOOKING_FIELDSET_ID} className="user-dash-inline-form">
                <legend className="sr-only">Booking details — date through payment</legend>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="udb-date">Date *</label>
                    <input
                      id="udb-date"
                      type="date"
                      name="date"
                      value={reservationData.date}
                      onChange={handleReservationChange}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="udb-time">Start time *</label>
                    <input
                      id="udb-time"
                      type="time"
                      name="time"
                      value={reservationData.time}
                      onChange={handleReservationChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="udb-duration">Duration (hours) *</label>
                    <input
                      id="udb-duration"
                      type="number"
                      name="duration"
                      value={reservationData.duration}
                      onChange={handleReservationChange}
                      min="1"
                      max="24"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="udb-vt">Vehicle type *</label>
                    <select id="udb-vt" name="vehicleType" value={reservationData.vehicleType} onChange={handleReservationChange} required>
                      <option value="car">Car</option>
                      <option value="motorcycle">Motorcycle</option>
                      <option value="truck">Truck</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="udb-pay">Payment</label>
                    <select id="udb-pay" name="paymentMethod" value={reservationData.paymentMethod} onChange={handleReservationChange}>
                      <option value="cash">Cash</option>
                      <option value="card">Card (Paymob)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="udb-total-inline">Estimated total</label>
                    <output id="udb-total-inline" htmlFor="udb-duration" className="reservation-total-amount-display user-dash-output">
                      {formatEgp(reservationModalEstimateEgp)}
                    </output>
                  </div>
                </div>
              </fieldset>
            )}
          </div>

          {!schedulingReady && pendingSlotNo && (
            <p className="user-dash-soft-hint user-dash-soft-hint--await-time" role="note">
              Set a valid <strong>date</strong> and <strong>start time</strong> to unlock forecasts and tailored advice below.
            </p>
          )}
          {schedulingReady && pendingSlotNo && (
            <p className="user-dash-soft-hint user-dash-soft-hint--review" role="status">
              Review totals and pricing rules, then use <strong>Confirm Booking</strong> in the sticky bar below.
            </p>
          )}
        </div>

        {schedulingReady ? (
          <section id="user-dash-assistant-stack" className="user-dash-assistant-stack" aria-label="Parking intelligence">
            {demandToneBanner != null ? (
              <div
                key={`${demandToneBanner.modifier}-${demandToneBanner.headline}`}
                className={`user-dash-demand-banner user-dash-demand-banner--${demandToneBanner.modifier}`}
                role="status"
                aria-live="polite"
              >
                <span className="user-dash-demand-banner__emoji" aria-hidden>
                  {demandToneBanner.emoji}
                </span>
                <span className="user-dash-demand-banner__text">{demandToneBanner.headline}</span>
              </div>
            ) : null}

            <SmartParkingAssistant
              schedulingReady
              reservationDate={reservationData.date}
              reservationTime={reservationData.time}
            />
          </section>
        ) : null}

        <div className="dashboard-sections user-dash-tail">
          <div className="dashboard-section">
            <h2>Current bookings</h2>
            <p className="parking-overview-hint" style={{ marginBottom: '0.75rem' }}>
              Parking QR codes are <strong>signed</strong> for security (your booking ID is shown below for reference). Show at entry (check-in) and exit (check-out) — hold your phone to the <strong>automated gate camera</strong> or a gatekeeper scanner.{' '}
              After your scheduled start time, the gate must scan you in within{' '}
              <strong>{CHECK_IN_DEADLINE_MINUTES} minutes</strong> or the reservation is cancelled and the spot is
              released. You get a dashboard alert and banner in the last{' '}
              <strong>{CHECK_IN_WARNING_LEAD_MINUTES} minutes</strong> before that deadline.
            </p>
            {confirmedBookingsCount > 1 && (
              <div className="user-dash-cancel-all-row" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-delete"
                  onClick={handleCancelAllActive}
                  disabled={cancelAllBusy || reservationsLoading}
                >
                  {cancelAllBusy
                    ? 'Cancelling…'
                    : `Cancel all confirmed bookings (${confirmedBookingsCount})`}
                </button>
              </div>
            )}
            <div className="table-container">
              {reservationsLoading ? (
                <p className="empty-state">Loading bookings…</p>
              ) : reservationsError ? (
                <p className="empty-state slots-error" role="alert">
                  {reservationsError}{' '}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={loadReservationsAndHistory}>
                    Retry
                  </button>
                </p>
              ) : reservations.length === 0 ? (
                <p className="empty-state">No current bookings</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Parking Spot</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Duration (hours)</th>
                      <th>Est. amount</th>
                      <th>Booking QR</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td>{reservation.id}</td>
                        <td>{reservation.parkingSpot}</td>
                        <td>
                          <span className={`status-badge status-${reservation.status}`}>
                            {reservation.status}
                          </span>
                        </td>
                        <td>{new Date(reservation.date).toLocaleDateString()}</td>
                        <td>{reservation.time}</td>
                        <td>{reservation.duration}</td>
                        <td>{formatEgp(reservation.totalAmount)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            <QRCodeCanvas value={bookingQrValue(reservation)} size={90} />
                            <small>ID: {reservation.id}</small>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setExitQRReservation(reservation);
                                setShowExitQRModal(true);
                              }}
                            >
                              Larger QR
                            </button>
                          </div>
                        </td>

                        <td>
                          {reservation.status === 'confirmed' ? (
                            <button
                              onClick={() => handleCancelReservation(reservation.id)}
                              className="btn btn-sm btn-delete"
                              disabled={cancelBusyId === reservation.id || cancelAllBusy}
                            >
                              {cancelBusyId === reservation.id ? 'Cancelling…' : 'Cancel'}
                            </button>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 12 }}>Checked in</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="dashboard-section">
            <h2>Reservation History</h2>
            <div className="table-container">
              {reservationsLoading ? (
                <p className="empty-state">Loading history…</p>
              ) : reservationsError ? (
                <p className="empty-state slots-error">{reservationsError}</p>
              ) : history.length === 0 ? (
                <p className="empty-state">No reservation history</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parking Spot</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>{item.parkingSpot}</td>
                        <td>{new Date(item.date).toLocaleDateString()}</td>
                        <td>{item.time}</td>
                        <td>{item.duration} hours</td>
                        <td>{formatEgp(item.totalAmount)}</td>
                        <td>
                          <span className={`status-badge status-${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {canConfirmBooking && (
          <aside className="user-dash-sticky-confirm" role="region" aria-label="Confirm reservation" aria-live="polite">
            <div className="user-dash-sticky-confirm__bar">
              <div className="user-dash-sticky-confirm__summary">
                <span className="user-dash-sticky-confirm__line">
                  <strong>Bay {pendingSlotNo}</strong>
                  {' · '}
                  {reservationData.date} {reservationData.time}
                </span>
                <span className="user-dash-sticky-confirm__total">{formatEgp(reservationModalEstimateEgp)}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary user-dash-sticky-confirm__cta"
                onClick={() => handleCreateReservation()}
                disabled={bookingSubmitting}
              >
                {bookingSubmitting ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          </aside>
        )}

      </div>

      {showExitQRModal && exitQRReservation && (
        <div className="modal-overlay" onClick={() => setShowExitQRModal(false)}>
          <div className="modal-content exit-qr-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pay cash &amp; show booking QR</h2>
            <p className="exit-qr-instruction">
              Pay <strong>{formatEgp(exitQRReservation.totalAmount)}</strong> cash to the gatekeeper. Show this QR for <strong>check-out</strong> — final amount is calculated at exit.
            </p>
            <div className="exit-qr-code-wrap">
              <QRCodeCanvas value={bookingQrValue(exitQRReservation)} size={220} />
              <p className="exit-qr-instruction" style={{ marginTop: 12 }}>Booking ID: {exitQRReservation.id}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowExitQRModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showReservationModal && (
        <div className="modal-overlay" onClick={() => setShowReservationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Make a Reservation</h2>

            <ParkingRulesSection variant="modal" />

            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateReservation();
            }}>
              <p className="form-hint">
                {pendingSlotNo
                  ? `You are reserving spot ${pendingSlotNo}. Change it by tapping another green slot on the map above.`
                  : 'Choose a green slot on the map above, or we will assign the first available spot when you confirm.'}
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={reservationData.date}
                    onChange={handleReservationChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Time *</label>
                  <input
                    type="time"
                    name="time"
                    value={reservationData.time}
                    onChange={handleReservationChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reservation-duration-input">Duration (hours) *</label>
                  <input
                    id="reservation-duration-input"
                    type="number"
                    name="duration"
                    value={reservationData.duration}
                    onChange={handleReservationChange}
                    min="1"
                    max="24"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Vehicle Type *</label>
                  <select
                    name="vehicleType"
                    value={reservationData.vehicleType}
                    onChange={handleReservationChange}
                    required
                  >
                    <option value="car">Car</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="truck">Truck</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    name="paymentMethod"
                    value={reservationData.paymentMethod}
                    onChange={handleReservationChange}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card (Paymob)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reservation-total-estimate">Total Amount</label>
                  <output
                    id="reservation-total-estimate"
                    className="reservation-total-amount-display"
                    htmlFor="reservation-duration-input"
                  >
                    {formatEgp(reservationModalEstimateEgp)}
                  </output>
                </div>
              </div>

              {demandInsightLoading && (
                <p className="parkgo-demand-loading" role="status">
                  Checking typical demand for this time…
                </p>
              )}

              {!demandInsightLoading && demandInsight && (
                <DemandGuidanceBanner insight={demandInsight} />
              )}

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={bookingSubmitting}>
                  {bookingSubmitting ? 'Booking…' : 'Confirm Reservation'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReservationModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
