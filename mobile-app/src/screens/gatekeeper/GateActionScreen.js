import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { Colors } from '../../utils/colors';
import { gateCheckIn, gateCheckOut } from '../../services/parkgo.service';
import { gateStorage } from '../../services/gateStorage';

function gateBookingId(raw) {
  const s = String(raw ?? '').trim();
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

function DetailRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ color: Colors.muted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>{value || '—'}</Text>
    </View>
  );
}

export function GateActionScreen() {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const p = await gateStorage.getLastPreview();
    setPreview(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const reservation = preview?.reservation || null;
  const nextAction = preview?.nextAction || null;

  const run = async (action) => {
    setError('');
    if (!reservation?.id) {
      setError('No scanned reservation. Go to Scan first.');
      return;
    }
    setLoading(true);
    try {
      const id = gateBookingId(reservation.id);
      const out = action === 'check-in' ? await gateCheckIn(id) : await gateCheckOut(id);
      await gateStorage.addScanRecord(preview, action);
      Alert.alert('Success', out?.message || 'Done');
      await gateStorage.clear();
      setPreview(null);
    } catch (e) {
      const msg = e?.message || 'Gate action failed';
      setError(msg);
      Alert.alert('Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const nextIsCheckIn = nextAction === 'check-in';
  const nextIsCheckOut = nextAction === 'check-out';

  return (
    <Screen contentContainerStyle={{ paddingTop: Colors.space.xl, gap: Colors.space.lg }}>
      <Banner tone="danger" text={error} />

      {reservation ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700' }}>Scanned Booking</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: Colors.radius.full,
                backgroundColor: nextIsCheckIn
                  ? 'rgba(16, 185, 129, 0.15)'
                  : nextIsCheckOut
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(148, 163, 184, 0.1)',
                borderWidth: 1,
                borderColor: nextIsCheckIn ? Colors.success : nextIsCheckOut ? Colors.warning : Colors.border,
              }}
            >
              <Text
                style={{
                  color: nextIsCheckIn ? Colors.successLight : nextIsCheckOut ? Colors.warningLight : Colors.muted,
                  fontSize: 12,
                  fontWeight: '700',
                  textTransform: 'capitalize',
                }}
              >
                {nextAction || 'No action'}
              </Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 }}>
            <DetailRow label="Booking ID" value={`#${reservation.id}`} />
            <DetailRow label="Bay" value={reservation.slot_no} />
            <DetailRow label="Status" value={reservation.status} />
            <DetailRow label="User" value={reservation.user_id} />
          </View>
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ color: Colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
            No booking scanned yet.{'\n'}Go to the Scan tab and point at a booking QR.
          </Text>
        </Card>
      )}

      {reservation ? (
        <View style={{ gap: Colors.space.md }}>
          <Button
            title="Check In"
            onPress={() => run('check-in')}
            disabled={loading || !nextIsCheckIn}
            loading={loading && nextIsCheckIn}
            tone={nextIsCheckIn ? 'success' : 'secondary'}
            size="lg"
          />
          <Button
            title="Check Out"
            onPress={() => run('check-out')}
            tone={nextIsCheckOut ? 'warning' : 'secondary'}
            disabled={loading || !nextIsCheckOut}
            loading={loading && nextIsCheckOut}
            size="lg"
          />
          <Button
            title="Clear scan"
            tone="danger"
            size="sm"
            onPress={() => gateStorage.clear().then(() => setPreview(null))}
          />
        </View>
      ) : null}
    </Screen>
  );
}
