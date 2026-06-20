import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { Colors } from '../../utils/colors';
import { bookingStorage } from '../../services/bookingStorage';
import { useAuth } from '../../store/AuthContext';
import { getUserReservations } from '../../services/parkgo.service';

function bestQrForReservation(r) {
  if (!r) return null;
  return r.qrJwt ?? r.qr_jwt ?? r.qrToken ?? null;
}

function normalizeStatus(st) {
  return String(st ?? '').trim().toLowerCase();
}

async function qrFromReservationList(userId) {
  const r = await getUserReservations(userId);
  const list = Array.isArray(r) ? r : [];
  const activeStatuses = ['confirmed', 'checked_in'];
  const active = list.filter((x) => activeStatuses.includes(normalizeStatus(x.status)));
  active.sort((a, b) => {
    const tb = new Date(b.created_at || b.createdAt || 0).getTime();
    const ta = new Date(a.created_at || a.createdAt || 0).getTime();
    return tb - ta;
  });
  for (const row of active) {
    const q = bestQrForReservation(row);
    if (q) return { qr: String(q), reservation: row };
  }
  const newest = active[0];
  return newest ? { qr: null, reservation: newest } : { qr: null, reservation: null };
}

function DetailRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: Colors.muted, fontSize: 13.5 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontSize: 13.5, fontWeight: '600' }}>{value || '—'}</Text>
    </View>
  );
}

export function QrCodeScreen({ navigation }) {
  const route = useRoute();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [reservation, setReservation] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    setLoading(true);
    try {
      let nextQr = null;
      let nextRes = null;

      const passthrough = route.params?.qrPass;
      const passRes = route.params?.resPass;
      if (passthrough != null && String(passthrough).trim() !== '') {
        nextQr = String(passthrough).trim();
        if (passRes && typeof passRes === 'object') nextRes = passRes;
        navigation.setParams({ qrPass: undefined, resPass: undefined });
      }

      const last = await bookingStorage.getLastBooking();
      const storedQr = last?.qrJwt ?? bestQrForReservation(last?.reservation);
      const storedRes = last?.reservation ?? null;
      if (storedQr && !nextQr) nextQr = String(storedQr);
      if (storedRes && !nextRes) nextRes = storedRes;

      if (!nextQr) {
        const { qr: q2, reservation: r2 } = await qrFromReservationList(user.id);
        if (q2) nextQr = q2;
        if (r2 && !nextRes) nextRes = r2;
      }

      setQr(nextQr || null);
      setReservation(nextRes || null);
    } catch (e) {
      setError(e?.message || 'Failed to load QR');
    } finally {
      setLoading(false);
    }
  }, [user?.id, navigation, route.params?.qrPass, route.params?.resPass]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clear = async () => {
    await bookingStorage.clear();
    setQr(null);
    setReservation(null);
  };

  const statusColor =
    normalizeStatus(reservation?.status) === 'confirmed'
      ? Colors.success
      : normalizeStatus(reservation?.status) === 'checked_in'
        ? Colors.info
        : Colors.muted;

  return (
    <Screen contentContainerStyle={{ paddingTop: Colors.space.xl, gap: Colors.space.lg }}>
      <Banner tone="danger" text={error} />

      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
          Your Booking QR
        </Text>
        <Text style={{ color: Colors.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
          Hold this QR to the gate camera or gatekeeper scanner for check-in and check-out.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator color={Colors.logoBlueLight} size="large" />
          </View>
        ) : qr ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              padding: 20,
              borderRadius: Colors.radius.lg,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <QRCode value={String(qr)} size={220} />
          </View>
        ) : (
          <View
            style={{
              paddingVertical: 32,
              paddingHorizontal: 24,
              borderRadius: Colors.radius.md,
              backgroundColor: 'rgba(148, 163, 184, 0.06)',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: Colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
              No active booking QR found.{'\n'}Complete a booking, then tap Refresh.
            </Text>
          </View>
        )}
      </Card>

      {reservation ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>Booking Details</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: Colors.radius.full,
                borderWidth: 1,
                borderColor: statusColor,
              }}
            >
              <Text style={{ color: statusColor, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
                {normalizeStatus(reservation.status)}
              </Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 }}>
            <DetailRow label="Booking ID" value={`#${reservation.id}`} />
            <DetailRow label="Bay" value={reservation.slot_no ?? reservation.slotNo} />
            <DetailRow
              label="Start"
              value={
                reservation.start_time || reservation.startTime
                  ? new Date(reservation.start_time || reservation.startTime).toLocaleString()
                  : null
              }
            />
            <DetailRow
              label="End"
              value={
                reservation.end_time || reservation.endTime
                  ? new Date(reservation.end_time || reservation.endTime).toLocaleString()
                  : null
              }
            />
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Refresh" onPress={load} disabled={loading} loading={loading} tone="secondary" />
        </View>
        {qr ? (
          <View style={{ flex: 1 }}>
            <Button title="Clear QR" onPress={clear} tone="warning" size="md" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
