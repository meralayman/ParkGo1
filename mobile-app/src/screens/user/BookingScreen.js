import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRoute } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { ANUParkingMapInline } from '../../components/ANUParkingMapInline';
import { DashboardMasthead } from '../../components/DashboardMasthead';
import { SectionTitle, SectionHint, HintGreen } from '../../components/SectionTitle';
import { Colors } from '../../utils/colors';
import { LOT_NAME } from '../../constants/alexandriaLot';
import { useAuth } from '../../store/AuthContext';
import { createReservation, getSlots } from '../../services/parkgo.service';
import { bookingStorage } from '../../services/bookingStorage';
import { PARKGO_PENDING_SLOT_KEY } from '../../constants/pendingSlot';
import { ANU_HOURS_LABEL, validateBookingHours, maxDurationForStartTime } from '../../constants/operatingHours';

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
}

function isTimeHm(s) {
  return /^\d{2}:\d{2}$/.test(String(s || '').trim());
}

function parseLocalStart(dateStr, timeStr) {
  const d = String(dateStr || '').trim();
  const t = String(timeStr || '').trim();
  if (!isIsoDate(d) || !isTimeHm(t)) return null;
  const [y, mo, da] = d.split('-').map((x) => parseInt(x, 10));
  const [hh, mm] = t.split(':').map((x) => parseInt(x, 10));
  if (![y, mo, da, hh, mm].every((n) => Number.isFinite(n))) return null;
  const dt = new Date(y, mo - 1, da, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextWholeHourHm(d = new Date()) {
  const x = new Date(d.getTime());
  x.setMinutes(0, 0, 0);
  x.setHours(x.getHours() + 1);
  return `${String(x.getHours()).padStart(2, '0')}:00`;
}

function displayName(user) {
  if (!user) return 'there';
  const combined = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return combined || user.username || 'there';
}

export function BookingScreen({ navigation }) {
  const route = useRoute();
  const { user, logout } = useAuth();
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const selectedSlotRef = useRef(null);
  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  const [date, setDate] = useState(() => localIsoDate());
  const [time, setTime] = useState(() => nextWholeHourHm());
  const [durationHours, setDurationHours] = useState('1');
  const [paymentMethod] = useState('cash');

  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadSlots = useCallback(async () => {
    setSlotsError('');
    setLoadingSlots(true);
    try {
      const s = await getSlots();
      setSlots(Array.isArray(s) ? s : []);
      const sel = selectedSlotRef.current;
      if (sel) {
        const row = (Array.isArray(s) ? s : []).find((x) => String(x.slot_no).trim() === String(sel).trim());
        if (!row || Number(row.state) !== 0) setSelectedSlot(null);
      }
    } catch (e) {
      setSlotsError(e?.message || 'Failed to load slots');
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSlots();
    }, [loadSlots])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const raw = route.params?.presetSlot;
        if (raw != null && String(raw).trim() !== '') {
          setSelectedSlot(String(raw).trim());
          navigation.setParams({ presetSlot: undefined });
          return;
        }
        try {
          const pending = await AsyncStorage.getItem(PARKGO_PENDING_SLOT_KEY);
          if (cancelled || pending == null || String(pending).trim() === '') return;
          const t = String(pending).trim();
          if (!slots.length) return;
          const row = slots.find((x) => String(x.slot_no).trim() === t);
          if (row && Number(row.state) === 0) setSelectedSlot(t);
        } catch {
          /* ignore */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [navigation, route.params?.presetSlot, slots])
  );

  const onSelectSlot = async (slotNo) => {
    const key = String(slotNo).trim();
    setSelectedSlot(key);
    try {
      await AsyncStorage.setItem(PARKGO_PENDING_SLOT_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const startDateTime = useMemo(() => parseLocalStart(date, time), [date, time]);

  const duration = useMemo(() => {
    const n = Number(String(durationHours || '').trim());
    if (!Number.isFinite(n) || n <= 0) return 1;
    const cap = maxDurationForStartTime(time);
    return Math.min(cap, Math.max(1, n));
  }, [durationHours, time]);

  const canSubmit = Boolean(user?.id) && Boolean(selectedSlot) && Boolean(startDateTime);

  const computedMaxDuration = useMemo(
    () => maxDurationForStartTime(time),
    [time]
  );

  const submit = async () => {
    setError('');
    if (!canSubmit) {
      setError('Select an available parking bay and enter a valid date/time.');
      return;
    }

    const hoursCheck = validateBookingHours(time, duration);
    if (!hoursCheck.ok) {
      setError(hoursCheck.error);
      return;
    }

    setCreating(true);
    try {
      const startTime = startDateTime.toISOString();
      const endTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000).toISOString();
      const data = await createReservation({
        userId: user.id,
        startTime,
        endTime,
        paymentMethod,
        slotNo: selectedSlot,
      });
      const reservation = data?.reservation || null;
      const qrJwt = data?.qrJwt ?? reservation?.qrJwt ?? reservation?.qr_jwt ?? null;
      await bookingStorage.setLastBooking({ reservation, qrJwt });
      await AsyncStorage.removeItem(PARKGO_PENDING_SLOT_KEY).catch(() => {});
      await loadSlots();
      if (qrJwt) {
        navigation.navigate({
          name: 'QR',
          params: { qrPass: String(qrJwt), resPass: reservation },
          merge: true,
        });
      } else {
        navigation.navigate('QR');
      }
    } catch (e) {
      setError(e?.message || 'Booking failed');
      loadSlots();
    } finally {
      setCreating(false);
    }
  };

  const subtitle = `Welcome back, ${displayName(user)}.\nChoose your parking spot to begin.`;

  return (
    <Screen contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0, gap: 0 }}>
      <DashboardMasthead title="User Dashboard" subtitle={subtitle} onLogout={() => logout()} />
      <View style={{ padding: 16, gap: 14 }}>
        <Banner tone="danger" text={error} />

        <Card>
          <SectionTitle title="Parking map — choose your bay">
            <SectionHint>
              <Text style={{ color: Colors.muted, fontSize: 15, lineHeight: 22 }}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>{LOT_NAME}</Text>
                {' — select a parking area, then tap a slot.'}
              </Text>
            </SectionHint>
          </SectionTitle>

          <ANUParkingMapInline
            selectedSlot={selectedSlot}
            onSlotSelect={onSelectSlot}
          />

          <View
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              backgroundColor: Colors.elevated,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ color: Colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Selected bay
            </Text>
            <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 18 }}>
              {selectedSlot || 'None'}
            </Text>
          </View>

          <Button title="Refresh map" onPress={loadSlots} disabled={loadingSlots} loading={loadingSlots} tone="secondary" />
        </Card>

        <Card>
          <SectionTitle title="Schedule your stay">
            <SectionHint>
              <Text style={{ color: Colors.muted, fontSize: 13 }}>
                ANU parking hours: <Text style={{ fontWeight: '700', color: Colors.text }}>{ANU_HOURS_LABEL}</Text>
              </Text>
            </SectionHint>
          </SectionTitle>
          <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-06-01" />
          <TextField label="Start time (HH:MM, 08:00–17:00)" value={time} onChangeText={setTime} placeholder="09:00" />
          <TextField
            label={`Duration (hours, max ${computedMaxDuration})`}
            value={String(durationHours)}
            onChangeText={setDurationHours}
            placeholder="1"
            keyboardType="numeric"
          />

          {!user?.id ? (
            <Text style={{ color: Colors.muted }}>Log in to book a parking bay.</Text>
          ) : !selectedSlot ? (
            <Text style={{ color: Colors.muted }}>Tap a green available bay on the map above.</Text>
          ) : !startDateTime ? (
            <Text style={{ color: Colors.muted }}>Enter a valid date and start time.</Text>
          ) : (
            <Text style={{ color: Colors.muted }}>
              Bay <Text style={{ color: Colors.text, fontWeight: '800' }}>{selectedSlot}</Text> · {date} {time} · {duration}h
            </Text>
          )}

          <Button
            title={creating ? 'Booking…' : 'Confirm Booking'}
            onPress={submit}
            disabled={!canSubmit || creating}
            loading={creating}
          />
        </Card>
      </View>
    </Screen>
  );
}
