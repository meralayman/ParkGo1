import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifier } from '../context/NotifierContext';
import './Dashboard.css';
import { formatEgp } from '../utils/formatEgp';
import { sortSlotsForAlexandriaGrid } from '../utils/slotSorting';

import { API_BASE } from '../config/apiOrigin';
import {
  fetchAnalytics,
  fetchAdminUsers,
  fetchAdminReservations,
  fetchAdminIncidents,
  fetchAdminLogs,
  fetchUserHistory,
  fetchSecurityAlerts,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  createAdminSlot,
  updateAdminSlot,
} from '../api/adminApi';
import { fetchSlots } from '../api/slotApi';

const SLOT_STATE_LABELS = { 0: 'Available', 1: 'Occupied', 2: 'Reserved' };
const SLOT_STATE_CLASSES = { 0: 'available', 1: 'occupied', 2: 'reserved' };

function slotArea(slotNo) {
  const m = String(slotNo || '').match(/^([A-Za-z])/);
  return m ? m[1].toUpperCase() : '?';
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast, confirm: openConfirmDialog } = useNotifier();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      return;
    }
    const initKey = 'parkgo_security_alerts_inited';
    const idKey = 'parkgo_security_alert_max_id';
    const poll = async () => {
      const afterId = Math.max(0, parseInt(localStorage.getItem(idKey) || '0', 10) || 0);
      try {
        const data = await fetchSecurityAlerts(user.id, afterId);
        if (!data.ok) return;
        const alerts = data.alerts || [];
        if (alerts.length === 0) return;
        const max = Math.max(...alerts.map((a) => a.id));
        if (!localStorage.getItem(initKey)) {
          localStorage.setItem(initKey, '1');
          localStorage.setItem(idKey, String(max));
          return;
        }
        localStorage.setItem(idKey, String(max));
        if (alerts.length === 1) {
          toast(`Security: ${alerts[0].message}`, { variant: 'warning', duration: 12_000 });
        } else {
          toast(
            `Security: ${alerts.length} new alert(s). Latest: ${
              alerts[alerts.length - 1].message
            }`,
            { variant: 'warning', duration: 14_000 }
          );
        }
      } catch {
        /* non-fatal */
      }
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [user, toast]);
  const [activeSection, setActiveSection] = useState('analytics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityLogsLoading, setSecurityLogsLoading] = useState(false);
  const [securityLogsError, setSecurityLogsError] = useState('');
  const [filterLogUserId, setFilterLogUserId] = useState('');
  const [filterLogAction, setFilterLogAction] = useState('');
  const filterLogUserIdRef = useRef(filterLogUserId);
  const filterLogActionRef = useRef(filterLogAction);
  useEffect(() => {
    filterLogUserIdRef.current = filterLogUserId;
  }, [filterLogUserId]);
  useEffect(() => {
    filterLogActionRef.current = filterLogAction;
  }, [filterLogAction]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [userHistoryUserId, setUserHistoryUserId] = useState(null);
  const [userHistoryData, setUserHistoryData] = useState(null);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlotNo, setNewSlotNo] = useState('');
  const [slotFilterText, setSlotFilterText] = useState('');
  const [slotFilterArea, setSlotFilterArea] = useState('');
  const [slotFilterState, setSlotFilterState] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    nationalId: '',
    username: '',
    gmail: '',
    password: '',
    role: 'user'
  });

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const loadSecurityLogs = useCallback(async () => {
    setSecurityLogsLoading(true);
    setSecurityLogsError('');
    try {
      const qs = new URLSearchParams();
      const uid = String(filterLogUserIdRef.current || '').trim();
      const act = String(filterLogActionRef.current || '').trim();
      if (uid) qs.set('user_id', uid);
      if (act) qs.set('action', act);
      const result = await fetchAdminLogs({
        userId: uid || undefined,
        action: act || undefined,
      });
      if (!result.ok) {
        setSecurityLogs([]);
        setSecurityLogsError(result.error);
        return;
      }
      setSecurityLogs(result.logs);
    } catch (err) {
      setSecurityLogs([]);
      setSecurityLogsError(err.message || 'Cannot load security logs');
    } finally {
      setSecurityLogsLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const result = await fetchAnalytics();
      if (!result.ok) {
        setAnalytics(null);
        setAnalyticsError(result.error);
        return;
      }
      setAnalytics(result.analytics);
    } catch (err) {
      setAnalytics(null);
      setAnalyticsError(err.message || 'Cannot reach server');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'analytics') loadAnalytics();
  }, [activeSection, loadAnalytics]);

  useEffect(() => {
    if (activeSection === 'accounts') loadUsers();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'slots' || activeSection === 'analytics') loadSlots();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'reservations' || activeSection === 'analytics') loadReservations();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'incidents') loadIncidents();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'security-logs') loadSecurityLogs();
  }, [activeSection, loadSecurityLogs]);

  useEffect(() => {
    if (userHistoryUserId) {
      setUserHistoryLoading(true);
      setUserHistoryData(null);
      fetchUserHistory(userHistoryUserId)
        .then((result) => {
          if (result.ok) setUserHistoryData(result.data);
          else setUserHistoryData(null);
        })
        .catch(() => setUserHistoryData(null))
        .finally(() => setUserHistoryLoading(false));
    } else {
      setUserHistoryData(null);
    }
  }, [userHistoryUserId]);

  const loadUsers = async () => {
    setAccountsLoading(true);
    try {
      const result = await fetchAdminUsers();
      setAccounts(result.ok ? result.users : []);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadSlots = async () => {
    setSlotsLoading(true);
    try {
      const result = await fetchSlots();
      setSlots(result.ok ? result.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const loadReservations = async () => {
    setReservationsLoading(true);
    try {
      const result = await fetchAdminReservations();
      setReservations(result.ok ? result.reservations : []);
    } catch {
      setReservations([]);
    } finally {
      setReservationsLoading(false);
    }
  };

  const loadIncidents = async () => {
    setIncidentsLoading(true);
    try {
      const result = await fetchAdminIncidents();
      setIncidents(result.ok ? result.incidents : []);
    } catch {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  };

  const incidentPhotoSrc = (filename) => {
    if (!filename) return null;
    const base = API_BASE || '';
    return `${base}/uploads/incidents/${encodeURIComponent(filename)}`;
  };

  const updateSlotState = async (slotNo, newState) => {
    try {
      const result = await updateAdminSlot(slotNo, newState);
      if (result.ok) loadSlots();
      else toast(result.error || 'Failed to update slot', { variant: 'error' });
    } catch {
      toast('Network error. Is the backend running?', { variant: 'error' });
    }
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    const name = newSlotNo.trim();
    if (!name) return;
    try {
      const result = await createAdminSlot(name);
      if (result.ok) {
        setNewSlotNo('');
        setShowAddSlotModal(false);
        loadSlots();
      } else {
        toast(result.error || 'Failed to add slot', { variant: 'error' });
      }
    } catch {
      toast('Network error. Is the backend running?', { variant: 'error' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const toApiUser = () => ({
    first_name: formData.firstName,
    last_name: formData.lastName,
    phone_number: formData.phoneNumber || null,
    national_id: formData.nationalId || null,
    username: formData.username,
    email: formData.gmail,
    password: formData.password || undefined,
    role: formData.role,
  });

  const handleAddAccount = async () => {
    const body = toApiUser();
    if (!body.password) {
      toast('Password is required', { variant: 'error' });
      return;
    }
    try {
      const result = await createAdminUser(body);
      if (result.ok) {
        loadUsers();
        resetForm();
        setShowAddModal(false);
      } else {
        toast(result.error || 'Failed to create user', { variant: 'error' });
      }
    } catch {
      toast('Network error. Is the backend running?', { variant: 'error' });
    }
  };

  const handleUpdateAccount = async () => {
    const body = toApiUser();
    delete body.email;
    delete body.username;
    if (!body.password) delete body.password;
    try {
      const result = await updateAdminUser(editingAccount.id, body);
      if (result.ok) {
        loadUsers();
        resetForm();
        setEditingAccount(null);
        setShowAddModal(false);
      } else {
        toast(result.error || 'Failed to update user', { variant: 'error' });
      }
    } catch {
      toast('Network error. Is the backend running?', { variant: 'error' });
    }
  };

  const handleDeleteAccount = async (id) => {
    const ok = await openConfirmDialog({
      title: 'Delete user?',
      message: 'Are you sure you want to delete this user? This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try {
      const result = await deleteAdminUser(id);
      if (result.ok) {
        loadUsers();
        toast('User deleted.', { variant: 'success' });
      } else toast(result.error || 'Failed to delete user', { variant: 'error' });
    } catch {
      toast('Network error. Is the backend running?', { variant: 'error' });
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      firstName: account.first_name || '',
      lastName: account.last_name || '',
      phoneNumber: account.phone_number || '',
      nationalId: account.national_id || '',
      username: account.username || '',
      gmail: account.email || '',
      password: '',
      role: account.role || 'user'
    });
    setShowAddModal(true);
  };

  const openUserHistory = (userId) => setUserHistoryUserId(userId);
  const closeUserHistory = () => setUserHistoryUserId(null);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      phoneNumber: '',
      nationalId: '',
      username: '',
      gmail: '',
      password: '',
      role: 'user'
    });
    setEditingAccount(null);
  };

  const sortedSlots = useMemo(() => sortSlotsForAlexandriaGrid(slots), [slots]);

  const slotAreas = useMemo(() => {
    const set = new Set(sortedSlots.map((s) => slotArea(s.slot_no)));
    return [...set].sort();
  }, [sortedSlots]);

  const filteredSlots = useMemo(() => {
    let list = sortedSlots;
    if (slotFilterText) {
      const q = slotFilterText.toLowerCase();
      list = list.filter((s) => String(s.slot_no).toLowerCase().includes(q));
    }
    if (slotFilterArea) {
      list = list.filter((s) => slotArea(s.slot_no) === slotFilterArea);
    }
    if (slotFilterState !== '') {
      const st = Number(slotFilterState);
      list = list.filter((s) => Number(s.state) === st);
    }
    return list;
  }, [sortedSlots, slotFilterText, slotFilterArea, slotFilterState]);

  const slotStats = useMemo(() => ({
    total: slots.length,
    available: slots.filter((s) => Number(s.state) === 0).length,
    occupied: slots.filter((s) => Number(s.state) === 1).length,
    reserved: slots.filter((s) => Number(s.state) === 2).length,
  }), [slots]);

  const paymentSummary = reservations.reduce(
    (acc, r) => {
      const amount = Number(r.total_amount) || 0;
      acc.totalRevenue += amount;
      acc.count += 1;
      const method = (r.payment_method || 'other').toLowerCase();
      acc.byMethod[method] = (acc.byMethod[method] || 0) + amount;
      return acc;
    },
    { totalRevenue: 0, count: 0, byMethod: {} }
  );

  const areaStats = useMemo(() => {
    const areas = {};
    slots.forEach(s => {
      const zone = slotArea(s.slot_no);
      if (!areas[zone]) areas[zone] = { zone, total: 0, available: 0 };
      areas[zone].total++;
      if (Number(s.state) === 0) areas[zone].available++;
    });
    return Object.values(areas)
      .sort((a, b) => a.zone.localeCompare(b.zone))
      .map(a => ({
        ...a,
        availablePercent: a.total > 0 ? Math.round((a.available / a.total) * 100) : 0
      }));
  }, [slots]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <img src={`${process.env.PUBLIC_URL || ''}/parkgo-logo.png`} alt="" className="admin-sidebar-logo-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand">ParkGO</span>
            <span className="admin-sidebar-subtitle">Smart Parking System</span>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          <button type="button" className={`admin-sidebar-item ${activeSection === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveSection('analytics'); setSidebarOpen(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span>Dashboard</span>
          </button>
          <button type="button" className={`admin-sidebar-item ${activeSection === 'accounts' ? 'active' : ''}`} onClick={() => { setActiveSection('accounts'); setSidebarOpen(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Accounts</span>
          </button>
          <button type="button" className={`admin-sidebar-item ${activeSection === 'slots' ? 'active' : ''}`} onClick={() => { setActiveSection('slots'); setSidebarOpen(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            <span>Manage Slots</span>
          </button>
          <button type="button" className={`admin-sidebar-item ${activeSection === 'reservations' ? 'active' : ''}`} onClick={() => { setActiveSection('reservations'); setSidebarOpen(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Reservations</span>
          </button>
          <button type="button" className={`admin-sidebar-item ${activeSection === 'incidents' ? 'active' : ''}`} onClick={() => { setActiveSection('incidents'); setSidebarOpen(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>Incidents</span>
          </button>
          <button type="button" className={`admin-sidebar-item ${activeSection === 'security-logs' ? 'active' : ''}`} onClick={() => { setActiveSection('security-logs'); setSidebarOpen(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Security Logs</span>
          </button>
        </nav>
      </aside>

      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-topbar-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="admin-topbar-left">
            <h1 className="admin-topbar-greeting">{getGreeting()}, {user?.firstName}</h1>
            <p className="admin-topbar-sub">Alexandria National University Parking</p>
          </div>
          <div className="admin-topbar-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" className="admin-topbar-search" placeholder="Search for location, slot, or area..." />
          </div>
          <div className="admin-topbar-right">
            <div className="admin-topbar-avatar">{(user?.firstName || '?')[0]}</div>
            <div className="admin-topbar-user-info">
              <span className="admin-topbar-user-name">{user?.firstName}</span>
              <span className="admin-topbar-user-role">Admin</span>
            </div>
          </div>
        </header>

        <div className="admin-main-content">

        {activeSection === 'analytics' && (
          <div className="admin-dashboard-view">
            <div className="admin-analytics-toolbar">
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadAnalytics} disabled={analyticsLoading}>
                {analyticsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {analyticsLoading && !analytics ? (
              <p className="empty-state">Loading analytics...</p>
            ) : analyticsError ? (
              <p className="empty-state slots-error">{analyticsError}</p>
            ) : analytics ? (
              <>
                <div className="admin-stats-row">
                  <div className="admin-stats-cards">
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon admin-stat-icon--blue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                      </div>
                      <div className="admin-stat-info">
                        <span className="admin-stat-label">Total Slots</span>
                        <span className="admin-stat-number">{analytics.parkingSlots.total}</span>
                        <span className="admin-stat-sub">All Parking Areas</span>
                      </div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon admin-stat-icon--green">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      </div>
                      <div className="admin-stat-info">
                        <span className="admin-stat-label">Available</span>
                        <span className="admin-stat-number">{analytics.parkingSlots.available}</span>
                        <span className="admin-stat-sub admin-stat-sub--green">{analytics.parkingSlots.total > 0 ? Math.round((analytics.parkingSlots.available / analytics.parkingSlots.total) * 100) : 0}% Available</span>
                      </div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon admin-stat-icon--orange">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/></svg>
                      </div>
                      <div className="admin-stat-info">
                        <span className="admin-stat-label">Occupied</span>
                        <span className="admin-stat-number">{analytics.parkingSlots.occupied}</span>
                        <span className="admin-stat-sub admin-stat-sub--orange">{analytics.parkingSlots.utilizationPercent}% Occupied</span>
                      </div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon admin-stat-icon--purple">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <div className="admin-stat-info">
                        <span className="admin-stat-label">Total Bookings</span>
                        <span className="admin-stat-number">{analytics.totalBookings}</span>
                        <span className="admin-stat-sub">All-time reservations</span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-parking-gauge">
                    <svg className="admin-gauge-svg" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="12" />
                      <circle cx="70" cy="70" r="58" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12"
                        strokeDasharray={`${((analytics.parkingSlots.total > 0 ? (analytics.parkingSlots.available / analytics.parkingSlots.total) : 0) * 364.42).toFixed(1)} 364.42`}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)" />
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <text x="70" y="64" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="700">
                        {analytics.parkingSlots.total > 0 ? Math.round((analytics.parkingSlots.available / analytics.parkingSlots.total) * 100) : 0}%
                      </text>
                      <text x="70" y="84" textAnchor="middle" fill="#94a3b8" fontSize="12">
                        Available
                      </text>
                    </svg>
                    <span className="admin-gauge-label">Parking Status</span>
                  </div>
                </div>

                <div className="admin-dashboard-grid-2">
                  <div className="admin-panel">
                    <h3 className="admin-panel-title">Booking Summary</h3>
                    <div className="admin-kpi-grid">
                      <div className="admin-kpi-item">
                        <span className="admin-kpi-label">Last 7 days</span>
                        <strong className="admin-kpi-value">{analytics.bookingsLast7Days}</strong>
                      </div>
                      <div className="admin-kpi-item">
                        <span className="admin-kpi-label">Last 30 days</span>
                        <strong className="admin-kpi-value">{analytics.bookingsLast30Days}</strong>
                      </div>
                      <div className="admin-kpi-item">
                        <span className="admin-kpi-label">Avg. Stay</span>
                        <strong className="admin-kpi-value">{analytics.avgBookingDurationHours != null ? `${analytics.avgBookingDurationHours}h` : '--'}</strong>
                      </div>
                      <div className="admin-kpi-item">
                        <span className="admin-kpi-label">Revenue</span>
                        <strong className="admin-kpi-value">{formatEgp(analytics.totalRevenueClosed || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="admin-panel">
                    <h3 className="admin-panel-title">Slot Availability by Area</h3>
                    {areaStats.length > 0 ? (
                      <div className="admin-area-list">
                        {areaStats.map(area => (
                          <div key={area.zone} className="admin-area-row">
                            <span className="admin-area-name">Area {area.zone}</span>
                            <div className="admin-area-bar">
                              <div className="admin-area-bar-fill" style={{ width: `${area.availablePercent}%` }} />
                            </div>
                            <span className="admin-area-count">{area.available} / {area.total}</span>
                            <span className="admin-area-percent">{area.availablePercent}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-panel-empty">No slot data available</p>
                    )}
                  </div>
                </div>

                <div className="admin-dashboard-grid-2">
                  <div className="admin-panel">
                    <h3 className="admin-panel-title">Peak Hours</h3>
                    {(() => {
                      const peak = analytics.peakHours || [];
                      const maxC = Math.max(1, ...peak.map((p) => p.count));
                      return (
                        <div className="peak-hours-chart">
                          {peak.map(({ hour, count }) => (
                            <div key={hour} className="peak-hour-row">
                              <span className="peak-hour-label">{String(hour).padStart(2, '0')}:00</span>
                              <div className="peak-hour-bar-wrap">
                                <div className="peak-hour-bar" style={{ width: `${(count / maxC) * 100}%` }} />
                              </div>
                              <span className="peak-hour-count">{count}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {analytics.peakHourTop5 && analytics.peakHourTop5.length > 0 && (
                      <p className="admin-peak-top">
                        <strong>Busiest hours:</strong>{' '}
                        {analytics.peakHourTop5.map((p) => `${String(p.hour).padStart(2, '0')}:00 (${p.count})`).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="admin-panel">
                    <h3 className="admin-panel-title">Bookings by Status</h3>
                    <ul className="admin-status-list">
                      {Object.entries(analytics.bookingsByStatus || {}).length === 0 ? (
                        <li className="admin-status-empty">No data</li>
                      ) : (
                        Object.entries(analytics.bookingsByStatus)
                          .sort((a, b) => b[1] - a[1])
                          .map(([status, count]) => (
                            <li key={status}>
                              <span className={`status-badge status-${status}`}>{status}</span>
                              <span className="admin-status-count">{count}</span>
                            </li>
                          ))
                      )}
                    </ul>
                  </div>
                </div>

                <div className="admin-dashboard-grid-2">
                  <div className="admin-panel">
                    <div className="admin-panel-header-row">
                      <h3 className="admin-panel-title">Recent Reservations</h3>
                      <button type="button" className="admin-panel-link" onClick={() => setActiveSection('reservations')}>View All</button>
                    </div>
                    {reservations.length === 0 ? (
                      <p className="admin-panel-empty">No reservations yet</p>
                    ) : (
                      <div className="admin-recent-list">
                        {reservations.slice(0, 5).map((r) => (
                          <div key={r.id} className="admin-recent-item">
                            <span className={`admin-recent-dot admin-recent-dot--${r.status}`} />
                            <div className="admin-recent-info">
                              <span className="admin-recent-slot">{r.slot_no}</span>
                              <span className="admin-recent-name">{r.first_name} {r.last_name}</span>
                            </div>
                            <span className="admin-recent-time">{r.start_time ? new Date(r.start_time).toLocaleDateString() : '--'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="admin-panel">
                    <h3 className="admin-panel-title">Quick Actions</h3>
                    <div className="admin-quick-actions">
                      <button type="button" className="admin-quick-action" onClick={() => setActiveSection('slots')}>
                        <div className="admin-quick-action-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                        </div>
                        <span>Manage Slots</span>
                      </button>
                      <button type="button" className="admin-quick-action" onClick={() => setActiveSection('accounts')}>
                        <div className="admin-quick-action-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        </div>
                        <span>Accounts</span>
                      </button>
                      <button type="button" className="admin-quick-action" onClick={() => setActiveSection('reservations')}>
                        <div className="admin-quick-action-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <span>Reservations</span>
                      </button>
                      <button type="button" className="admin-quick-action" onClick={() => setActiveSection('incidents')}>
                        <div className="admin-quick-action-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <span>Incidents</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  <h3 className="admin-panel-title">Most Used Spots</h3>
                  <div className="table-container admin-analytics-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Spot</th>
                          <th>Bookings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analytics.mostUsedSpots || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="empty-state">No bookings yet</td>
                          </tr>
                        ) : (
                          analytics.mostUsedSpots.map((row, idx) => (
                            <tr key={row.slot_no}>
                              <td>{idx + 1}</td>
                              <td><strong>{row.slot_no}</strong></td>
                              <td>{row.booking_count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeSection === 'accounts' && (
          <>
            <div className="dashboard-actions">
              <button 
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }} 
                className="btn btn-primary"
              >
                + Add New Account
              </button>
            </div>

            {accountsLoading ? (
              <p className="empty-state">Loading users...</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Email</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>National ID</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                          No users found
                        </td>
                      </tr>
                    ) : (
                      accounts.map((account) => (
                        <tr key={account.id}>
                          <td>{account.first_name}</td>
                          <td>{account.last_name}</td>
                          <td>{account.email}</td>
                          <td>{account.username}</td>
                          <td>{account.phone_number || '—'}</td>
                          <td>{account.national_id || '—'}</td>
                          <td>
                            <span className={`role-badge role-${account.role}`}>
                              {account.role}
                            </span>
                          </td>
                          <td>{account.created_at ? new Date(account.created_at).toLocaleDateString() : '—'}</td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                onClick={() => openUserHistory(account.id)}
                                className="btn btn-sm btn-secondary"
                              >
                                View history
                              </button>
                              <button 
                                onClick={() => handleEdit(account)}
                                className="btn btn-sm btn-edit"
                              >
                                Update
                              </button>
                              <button 
                                onClick={() => handleDeleteAccount(account.id)}
                                className="btn btn-sm btn-delete"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeSection === 'slots' && (
          <div className="dashboard-section">
            <div className="admin-analytics-header" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Parking Slots</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadSlots} disabled={slotsLoading}>
                  {slotsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddSlotModal(true)}>
                  + Add Slot
                </button>
              </div>
            </div>
            <p className="parking-overview-hint" style={{ marginTop: 0 }}>
              All parking bays across zones A–D. Use the filters to find specific slots.
            </p>

            {slotsLoading && slots.length === 0 ? (
              <p className="empty-state">Loading slots…</p>
            ) : slots.length === 0 ? (
              <p className="empty-state">No slots found. Add one with the button above or check that the database has parking_slots.</p>
            ) : (
              <>
                <div className="slots-stats-row">
                  <div className="slots-stat-card">
                    <div className="slots-stat-circle slots-stat-total">{slotStats.total}</div>
                    <span>Total</span>
                  </div>
                  <div className="slots-stat-card">
                    <div className="slots-stat-circle slots-stat-available">{slotStats.available}</div>
                    <span>Available</span>
                  </div>
                  <div className="slots-stat-card">
                    <div className="slots-stat-circle slots-stat-reserved">{slotStats.reserved}</div>
                    <span>Reserved</span>
                  </div>
                  <div className="slots-stat-card">
                    <div className="slots-stat-circle slots-stat-occupied">{slotStats.occupied}</div>
                    <span>Occupied</span>
                  </div>
                </div>

                <div className="admin-slot-filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                    <label htmlFor="admin-slot-search">Search slot</label>
                    <input
                      id="admin-slot-search"
                      type="search"
                      placeholder="e.g. A1, B12"
                      value={slotFilterText}
                      onChange={(e) => setSlotFilterText(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
                    <label htmlFor="admin-slot-area">Area</label>
                    <select id="admin-slot-area" value={slotFilterArea} onChange={(e) => setSlotFilterArea(e.target.value)}>
                      <option value="">All areas</option>
                      {slotAreas.map((a) => (
                        <option key={a} value={a}>Zone {a}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 130 }}>
                    <label htmlFor="admin-slot-status">Status</label>
                    <select id="admin-slot-status" value={slotFilterState} onChange={(e) => setSlotFilterState(e.target.value)}>
                      <option value="">All statuses</option>
                      <option value="0">Available</option>
                      <option value="1">Occupied</option>
                      <option value="2">Reserved</option>
                    </select>
                  </div>
                  {(slotFilterText || slotFilterArea || slotFilterState !== '') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setSlotFilterText(''); setSlotFilterArea(''); setSlotFilterState(''); }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {filteredSlots.length === 0 ? (
                  <p className="empty-state">No slots match your filters.</p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Slot ID</th>
                          <th>Area</th>
                          <th>Status</th>
                          <th>Change status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSlots.map((slot) => {
                          const st = Number(slot.state);
                          return (
                            <tr key={slot.slot_no}>
                              <td><strong>{slot.slot_no}</strong></td>
                              <td>Zone {slotArea(slot.slot_no)}</td>
                              <td>
                                <span className={`status-badge status-${SLOT_STATE_CLASSES[st] || 'available'}`}>
                                  {SLOT_STATE_LABELS[st] || 'Unknown'}
                                </span>
                              </td>
                              <td>
                                <select
                                  className="slot-state-select"
                                  value={slot.state}
                                  onChange={(e) => updateSlotState(slot.slot_no, parseInt(e.target.value, 10))}
                                >
                                  <option value={0}>Available</option>
                                  <option value={1}>Occupied</option>
                                  <option value={2}>Reserved</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="parking-overview-hint" style={{ marginTop: 8 }}>
                      Showing {filteredSlots.length} of {slots.length} slots
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeSection === 'reservations' && (
          <div className="dashboard-section">
            <h2>Reservation History & Payment Details</h2>
            <div className="stats-container">
              <div className="stat-card">
                <h3>Total Reservations</h3>
                <p className="stat-value">{paymentSummary.count}</p>
              </div>
              <div className="stat-card">
                <h3>Total Revenue</h3>
                <p className="stat-value">{formatEgp(paymentSummary.totalRevenue)}</p>
              </div>
              {Object.entries(paymentSummary.byMethod).length > 0 && (
                <div className="stat-card">
                  <h3>By payment method</h3>
                  <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', fontSize: 14 }}>
                    {Object.entries(paymentSummary.byMethod).map(([method, amount]) => (
                      <li key={method}>{method}: {formatEgp(amount)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {reservationsLoading ? (
              <p className="empty-state">Loading reservations...</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Slot</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th>Payment method</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No reservations yet</td>
                      </tr>
                    ) : (
                      reservations.map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>{r.first_name} {r.last_name} ({r.email})</td>
                          <td>{r.slot_no}</td>
                          <td>{new Date(r.start_time).toLocaleString()}</td>
                          <td>{new Date(r.end_time).toLocaleString()}</td>
                          <td>
                            <span className={`status-badge status-${r.status}`}>{r.status}</span>
                          </td>
                          <td>{r.payment_method || '—'}</td>
                          <td>{r.total_amount != null ? formatEgp(r.total_amount) : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === 'incidents' && (
          <div className="dashboard-section">
            <div className="admin-analytics-header" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Incidents Reports</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadIncidents} disabled={incidentsLoading}>
                {incidentsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <p className="parking-overview-hint" style={{ marginTop: 0 }}>
              All reports submitted by customers (with booking ID) and by gatekeepers. Newest first.
            </p>
            {incidentsLoading ? (
              <p className="empty-state">Loading incidents…</p>
            ) : (
              <div className="table-container admin-incidents-table-wrap">
                <table className="data-table admin-incidents-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Source</th>
                      <th>Submitted</th>
                      <th>Name (form)</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Booking #</th>
                      <th>Customer account</th>
                      <th>Gatekeeper</th>
                      <th>What happened</th>
                      <th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>
                          No incident reports yet
                        </td>
                      </tr>
                    ) : (
                      incidents.map((row) => {
                        const isGk = (row.reporter_type || 'user') === 'gatekeeper';
                        const cust =
                          row.reporter_account_first_name || row.reporter_account_last_name
                            ? `${row.reporter_account_first_name || ''} ${row.reporter_account_last_name || ''}`.trim() +
                              (row.user_id ? ` (#${row.user_id})` : '')
                            : row.user_id
                              ? `User #${row.user_id}`
                              : '—';
                        const gk =
                          row.gatekeeper_first_name || row.gatekeeper_last_name
                            ? `${row.gatekeeper_first_name || ''} ${row.gatekeeper_last_name || ''}`.trim() +
                              (row.gatekeeper_id ? ` (#${row.gatekeeper_id})` : '')
                            : row.gatekeeper_id
                              ? `#${row.gatekeeper_id}`
                              : '—';
                        const src = incidentPhotoSrc(row.photo_filename);
                        return (
                          <tr key={row.id}>
                            <td>{row.id}</td>
                            <td>
                              <span
                                className={`incident-source-badge ${isGk ? 'incident-source-gatekeeper' : 'incident-source-user'}`}
                              >
                                {isGk ? 'Gatekeeper' : 'User'}
                              </span>
                            </td>
                            <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                            <td>{row.full_name || '—'}</td>
                            <td>{row.mobile || '—'}</td>
                            <td>
                              {isGk
                                ? row.email || '—'
                                : row.reporter_account_email || '—'}
                            </td>
                            <td>{row.reservation_id != null ? row.reservation_id : '—'}</td>
                            <td>{!isGk ? cust : '—'}</td>
                            <td>{isGk ? gk : '—'}</td>
                            <td className="admin-incidents-desc">{row.description || '—'}</td>
                            <td>
                              {src ? (
                                <a href={src} target="_blank" rel="noopener noreferrer" title="Open image">
                                  <img className="admin-incidents-photo" src={src} alt="" />
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === 'security-logs' && (
          <div className="dashboard-section">
            <div className="admin-analytics-header" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Security Logs</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadSecurityLogs}
                disabled={securityLogsLoading}
              >
                {securityLogsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <p className="parking-overview-hint" style={{ marginTop: 0 }}>
              Login, bookings, QR scans, check-in/out. Sorted newest first (max 100). Uses GET /admin/logs.
            </p>
            <div
              className="form-row"
              style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}
            >
              <div className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
                <label htmlFor="admin-log-search-action">Search action</label>
                <input
                  id="admin-log-search-action"
                  type="search"
                  value={filterLogAction}
                  onChange={(e) => setFilterLogAction(e.target.value)}
                  placeholder="Text in action (partial match)"
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
                <label htmlFor="admin-log-filter-user">Filter by user ID</label>
                <input
                  id="admin-log-filter-user"
                  type="text"
                  value={filterLogUserId}
                  onChange={(e) => setFilterLogUserId(e.target.value)}
                  placeholder="Exact UUID (optional)"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={loadSecurityLogs}
                disabled={securityLogsLoading}
              >
                Apply
              </button>
            </div>
            {securityLogsLoading && securityLogs.length === 0 && !securityLogsError ? (
              <p className="empty-state">Loading security logs…</p>
            ) : securityLogsError ? (
              <p className="empty-state slots-error">{securityLogsError}</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>User ID</th>
                      <th>Timestamp</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                          No log entries
                        </td>
                      </tr>
                    ) : (
                      securityLogs.map((row) => (
                        <tr key={row.id}>
                          <td className="admin-security-log-action">{row.action || '—'}</td>
                          <td className="admin-security-log-user">{row.user_id || '—'}</td>
                          <td>
                            {row.timestamp
                              ? new Date(row.timestamp).toLocaleString()
                              : '—'}
                          </td>
                          <td>{row.ip_address || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        </div>
      </main>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAccount ? 'Update Account' : 'Add New Account'}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              editingAccount ? handleUpdateAccount() : handleAddAccount();
            }}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="gmail"
                  value={formData.gmail}
                  onChange={handleInputChange}
                  required
                  readOnly={!!editingAccount}
                />
              </div>

              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  readOnly={!!editingAccount}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>National ID *</label>
                  <input
                    type="text"
                    name="nationalId"
                    value={formData.nationalId}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="gatekeeper">Gatekeeper</option>
                </select>
              </div>

              <div className="form-group">
                <label>Password {editingAccount ? '(leave blank to keep current)' : '*'}</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingAccount}
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? 'Update' : 'Add'} Account
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userHistoryUserId && (
        <div className="modal-overlay" onClick={closeUserHistory}>
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <h2>User history</h2>
            {userHistoryLoading ? (
              <p className="empty-state">Loading...</p>
            ) : userHistoryData && userHistoryData.user ? (
              <>
                <div className="user-history-info">
                  <p><strong>{userHistoryData.user.first_name} {userHistoryData.user.last_name}</strong></p>
                  <p>Email: {userHistoryData.user.email}</p>
                  <p>Username: {userHistoryData.user.username}</p>
                  <p>Phone: {userHistoryData.user.phone_number || '—'}</p>
                  <p>Role: <span className={`role-badge role-${userHistoryData.user.role}`}>{userHistoryData.user.role}</span></p>
                </div>
                {userHistoryData.paymentSummary && (
                  <div className="stats-container" style={{ marginBottom: 20 }}>
                    <div className="stat-card">
                      <h3>Reservations</h3>
                      <p className="stat-value">{userHistoryData.paymentSummary.reservationCount}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Total spent</h3>
                      <p className="stat-value">{formatEgp(userHistoryData.paymentSummary.totalSpent)}</p>
                    </div>
                    {Object.keys(userHistoryData.paymentSummary.byMethod || {}).length > 0 && (
                      <div className="stat-card">
                        <h3>By payment method</h3>
                        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', fontSize: 14 }}>
                          {Object.entries(userHistoryData.paymentSummary.byMethod).map(([method, amount]) => (
                            <li key={method}>{method}: {formatEgp(amount)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <h3 style={{ marginTop: 20, marginBottom: 12 }}>Reservation history</h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Slot</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!userHistoryData.reservations || userHistoryData.reservations.length === 0) ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '16px' }}>No reservations</td>
                        </tr>
                      ) : (
                        userHistoryData.reservations.map((r) => (
                          <tr key={r.id}>
                            <td>{r.id}</td>
                            <td>{r.slot_no}</td>
                            <td>{new Date(r.start_time).toLocaleString()}</td>
                            <td>{new Date(r.end_time).toLocaleString()}</td>
                            <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                            <td>{r.payment_method || '—'}</td>
                            <td>{r.total_amount != null ? formatEgp(r.total_amount) : '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="modal-actions" style={{ marginTop: 20 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeUserHistory}>Close</button>
                </div>
              </>
            ) : (
              <p className="empty-state">Failed to load user history.</p>
            )}
          </div>
        </div>
      )}

      {showAddSlotModal && (
        <div className="modal-overlay" onClick={() => { setShowAddSlotModal(false); setNewSlotNo(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Slot</h2>
            <form onSubmit={handleAddSlot}>
              <div className="form-group">
                <label>Slot number / name *</label>
                <input
                  type="text"
                  value={newSlotNo}
                  onChange={(e) => setNewSlotNo(e.target.value)}
                  placeholder="e.g. A-106 or B-301"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Add Slot</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddSlotModal(false); setNewSlotNo(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
