import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { AlexandriaParkingGrid } from '../../components/AlexandriaParkingGrid';
import { DashboardMasthead } from '../../components/DashboardMasthead';
import { SectionTitle, SectionHint, HintGreen } from '../../components/SectionTitle';
import { Colors } from '../../utils/colors';
import { LOT_NAME } from '../../constants/alexandriaLot';
import { useAuth } from '../../store/AuthContext';
import { onReservationsChanged } from '../../constants/parkgoEvents';
import { getSlots, getUserReservations } from '../../services/parkgo.service';

function displayName(user) {
  if (!user) return 'there';
  const combined = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return combined || user.username || 'there';
}

function formatTs(value) {
  if (value == null) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function UserDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [slots, setSlots] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    setLoading(true);
    const problems = [];

    try {
      const s = await getSlots();
      setSlots(Array.isArray(s) ? s : []);
    } catch (e) {
      setSlots([]);
      problems.push(e?.message || 'Failed to load slots');
    }

    try {
      const raw = await getUserReservations(user.id);
      const list = Array.isArray(raw) ? raw : [];
      const active = list.filter((x) => ['confirmed', 'checked_in'].includes(String(x.status || '').trim()));
      const hist = list
        .filter((x) => !['confirmed', 'checked_in'].includes(String(x.status || '').trim()))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setActiveBookings(active);
      setHistory(hist);
    } catch (e) {
      setActiveBookings([]);
      setHistory([]);
      problems.push(e?.message || 'Failed to load bookings');
    }

    setError(problems.join('\n'));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => onReservationsChanged(load), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const subtitle = `Welcome back, ${displayName(user)}.\nChoose your parking spot to begin.`;

  const goBookWithSlot = (slotNo) => {
    navigation.navigate('Book', { presetSlot: String(slotNo).trim() });
  };

  return (
    <Screen
      contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0, gap: 0 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.logoBlueLight} />
      }
    >
      <DashboardMasthead
        title="User Dashboard"
        subtitle={subtitle}
        onLogout={() => logout()}
        onReportIncident={() => navigation.navigate('History')}
      />

      <View style={{ padding: 16, gap: 14 }}>
        <Banner tone="danger" text={error} />

        <Card>
          <SectionTitle title="Parking map — choose your bay">
            <SectionHint>
              <Text style={{ color: Colors.muted, fontSize: 15, lineHeight: 22 }}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>{LOT_NAME}</Text>
                {' — tap a '}
                <HintGreen>green</HintGreen>
                {' bay, then open the Booking tab to set your time.'}
              </Text>
            </SectionHint>
          </SectionTitle>

          {loading && slots.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.logoBlueLight} />
              <Text style={{ color: Colors.muted, marginTop: 8 }}>Loading slots…</Text>
            </View>
          ) : slots.length === 0 ? (
            <Text style={{ color: Colors.muted }}>No slots available</Text>
          ) : (
            <AlexandriaParkingGrid
              slots={slots}
              selectedSlotNo={null}
              onSlotPress={(slotNo) => goBookWithSlot(slotNo)}
              showLegend
            />
          )}
        </Card>

        <Card>
          <SectionTitle title="Current bookings" />
          {loading && activeBookings.length === 0 ? (
            <Text style={{ color: Colors.muted }}>Loading bookings…</Text>
          ) : activeBookings.length === 0 ? (
            <Text style={{ color: Colors.muted }}>No current bookings</Text>
          ) : (
            activeBookings.map((b, idx) => (
              <View
                key={String(b.id)}
                style={{
                  paddingTop: idx === 0 ? 0 : 12,
                  marginTop: idx === 0 ? 0 : 12,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: Colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ color: Colors.text, fontWeight: '800' }}>
                  #{b.id} · Bay {b.slot_no}
                </Text>
                <Text style={{ color: Colors.muted }}>Status: {String(b.status)}</Text>
                <Text style={{ color: Colors.muted }}>Starts {formatTs(b.start_time)}</Text>
                <Button title="Open My QR" tone="secondary" onPress={() => navigation.navigate('QR')} />
              </View>
            ))
          )}
        </Card>

        <Card>
          <SectionTitle title="Reservation history" />
          {loading && history.length === 0 ? (
            <Text style={{ color: Colors.muted }}>Loading history…</Text>
          ) : history.length === 0 ? (
            <Text style={{ color: Colors.muted }}>No reservation history</Text>
          ) : (
            history.slice(0, 8).map((b, idx) => (
              <View
                key={String(b.id)}
                style={{
                  paddingTop: idx === 0 ? 0 : 10,
                  marginTop: idx === 0 ? 0 : 10,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: Colors.border,
                  gap: 2,
                }}
              >
                <Text style={{ color: Colors.text, fontWeight: '700' }}>
                  Bay {b.slot_no} · {String(b.status)}
                </Text>
                <Text style={{ color: Colors.muted, fontSize: 13 }}>{formatTs(b.start_time)}</Text>
              </View>
            ))
          )}
          {history.length > 0 ? (
            <Button title="View all bookings" tone="secondary" onPress={() => navigation.navigate('History')} />
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Book parking" onPress={() => navigation.navigate('Book')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="My QR" tone="secondary" onPress={() => navigation.navigate('QR')} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
