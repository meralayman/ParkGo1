import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { Colors } from '../../utils/colors';
import { gatePreviewQr, gateCheckIn, gateCheckOut } from '../../services/parkgo.service';
import { gateStorage } from '../../services/gateStorage';

const SAME_QR_COOLDOWN_MS = 4000;

function DetailRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: Colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600' }}>{value || '—'}</Text>
    </View>
  );
}

export function GateQrScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const previewInFlightRef = useRef(false);
  const lastQrRef = useRef({ payload: '', at: 0 });

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setError('');
      setPreview(null);
      previewInFlightRef.current = false;
      lastQrRef.current = { payload: '', at: 0 };
    }, [])
  );

  const resetScanner = () => {
    setScanned(false);
    setError('');
    setPreview(null);
    lastQrRef.current = { payload: '', at: 0 };
    previewInFlightRef.current = false;
  };

  const onScanned = useCallback(async ({ data }) => {
    const qr = String(data || '').trim();
    if (!qr) return;

    const now = Date.now();
    if (
      lastQrRef.current.payload === qr &&
      now - lastQrRef.current.at < SAME_QR_COOLDOWN_MS
    ) {
      return;
    }
    if (previewInFlightRef.current) return;

    lastQrRef.current = { payload: qr, at: now };
    previewInFlightRef.current = true;
    setScanned(true);
    setError('');
    setLoading(true);
    try {
      const result = await gatePreviewQr(qr);
      setPreview({ scannedQr: qr, ...result });
    } catch (e) {
      const msg = e?.message || 'Invalid QR';
      setError(msg);
      if (e?.code === 'RATE_LIMIT') {
        Alert.alert('Too many scans', 'Wait up to a minute, then tap Scan again.');
      }
    } finally {
      previewInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const runAction = async (action) => {
    if (!preview?.reservation?.id) return;
    setActionLoading(true);
    try {
      const id = preview.reservation.id;
      const result = action === 'check-in'
        ? await gateCheckIn(id)
        : await gateCheckOut(id);
      await gateStorage.addScanRecord(preview, action);
      Alert.alert('Success', result?.message || 'Done');
      resetScanner();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (!permission) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.text }}>Requesting camera permission…</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Card>
          <Text style={{ color: Colors.text, fontWeight: '900' }}>Camera permission required</Text>
          <Text style={{ color: Colors.muted }}>Enable camera permission to scan booking QR codes.</Text>
          <Button title="Grant permission" onPress={requestPermission} />
        </Card>
      </Screen>
    );
  }

  const reservation = preview?.reservation || null;
  const nextAction = preview?.nextAction || null;
  const nextIsCheckIn = nextAction === 'check-in';
  const nextIsCheckOut = nextAction === 'check-out';

  return (
    <Screen scroll={false} style={{ padding: 0 }}>
      <View style={{ flex: 1 }}>
        {!preview && (
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={scanned ? undefined : onScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        {preview && reservation && (
          <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700' }}>
                  Booking #{reservation.id}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: Colors.radius.full,
                    backgroundColor: nextIsCheckIn ? 'rgba(16,185,129,0.15)' : nextIsCheckOut ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.1)',
                    borderWidth: 1,
                    borderColor: nextIsCheckIn ? Colors.success : nextIsCheckOut ? Colors.warning : Colors.border,
                  }}
                >
                  <Text style={{
                    color: nextIsCheckIn ? Colors.successLight : nextIsCheckOut ? Colors.warningLight : Colors.muted,
                    fontSize: 11, fontWeight: '700', textTransform: 'capitalize',
                  }}>
                    {nextAction || 'No action'}
                  </Text>
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 }}>
                <DetailRow label="Bay" value={reservation.slot_no} />
                <DetailRow label="Status" value={reservation.status} />
                <DetailRow label="User" value={reservation.user_id} />
              </View>
            </Card>

            <Button
              title="Check In"
              onPress={() => runAction('check-in')}
              disabled={actionLoading || !nextIsCheckIn}
              loading={actionLoading && nextIsCheckIn}
              tone={nextIsCheckIn ? 'success' : 'secondary'}
              size="lg"
            />
            <Button
              title="Check Out"
              onPress={() => runAction('check-out')}
              tone={nextIsCheckOut ? 'warning' : 'secondary'}
              disabled={actionLoading || !nextIsCheckOut}
              loading={actionLoading && nextIsCheckOut}
              size="lg"
            />
            <Button title="Scan another" tone="secondary" size="sm" onPress={resetScanner} />
          </View>
        )}

        {!preview && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 10 }}>
            <Banner tone="danger" text={error} />
            <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}>
              <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 16 }}>
                {scanned ? 'QR Scanned' : 'Point at a booking QR'}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 13.5, lineHeight: 20 }}>
                Hold steady — the scan is automatic.
              </Text>
              <Button
                title={scanned ? 'Scan again' : 'Ready — waiting for QR'}
                tone={scanned ? 'warning' : 'secondary'}
                onPress={resetScanner}
                disabled={loading}
                loading={loading}
              />
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}
