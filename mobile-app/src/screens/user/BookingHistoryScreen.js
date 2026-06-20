import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { DashboardMasthead } from '../../components/DashboardMasthead';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { emitReservationsChanged, onReservationsChanged } from '../../constants/parkgoEvents';
import { cancelReservation, getUserReservations } from '../../services/parkgo.service';

function StatusPill({ status }) {
  const s = String(status || '').toLowerCase();
  const tone =
    s === 'confirmed' || s === 'checked_in'
      ? Colors.warning
      : s === 'cancelled'
        ? Colors.muted
        : s === 'closed'
          ? Colors.success
          : Colors.danger;
  return (
    <View style={{ borderWidth: 1, borderColor: tone, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: tone, fontWeight: '900' }}>{s || 'unknown'}</Text>
    </View>
  );
}

function BookingRow({ item, onCancel }) {
  const canCancel = String(item.status) === 'confirmed';
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: Colors.text, fontWeight: '900' }}>#{item.id}</Text>
        <StatusPill status={item.status} />
      </View>
      <Text style={{ color: Colors.muted }}>Bay: {item.slot_no}</Text>
      <Text style={{ color: Colors.muted }}>
        Start: {item.start_time ? new Date(item.start_time).toLocaleString() : '-'}
      </Text>
      <Text style={{ color: Colors.muted }}>
        End: {item.end_time ? new Date(item.end_time).toLocaleString() : '-'}
      </Text>
      {canCancel ? <Button title="Cancel" tone="danger" onPress={() => onCancel(item.id)} /> : null}
    </Card>
  );
}

export function BookingHistoryScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    setLoading(true);
    try {
      const r = await getUserReservations(user.id);
      setItems(Array.isArray(r) ? r : []);
    } catch (e) {
      setError(e?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => onReservationsChanged(load), [load]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [items]);

  const onCancel = async (id) => {
    const ok = await new Promise((resolve) => {
      Alert.alert('Cancel booking?', 'This will release the spot.', [
        { text: 'Keep', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Cancel booking', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    try {
      await cancelReservation(id);
      emitReservationsChanged();
      await load();
    } catch (e) {
      Alert.alert('Cancel failed', e?.message || 'Cancel failed');
    }
  };

  return (
    <Screen contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0, gap: 0 }}>
      <DashboardMasthead title="Reservation history" subtitle="All bookings including cancelled." onLogout={() => logout()} />
      <View style={{ padding: 16, gap: 12 }}>
        <Banner tone="danger" text={error} />

        {loading && sorted.length === 0 ? (
          <ActivityIndicator color={Colors.logoBlueLight} />
        ) : sorted.length === 0 ? (
          <Text style={{ color: Colors.muted }}>No reservation history</Text>
        ) : (
          sorted.map((item) => <BookingRow key={String(item.id)} item={item} onCancel={onCancel} />)
        )}

        <Button title="Refresh" onPress={load} disabled={loading} loading={loading} tone="secondary" />
      </View>
    </Screen>
  );
}
