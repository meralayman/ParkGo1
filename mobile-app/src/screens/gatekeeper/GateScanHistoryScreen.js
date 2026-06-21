import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Colors } from '../../utils/colors';
import { gateStorage } from '../../services/gateStorage';

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date}  ${time}`;
  } catch {
    return iso || '—';
  }
}

function actionColor(action) {
  if (action === 'check-in') return { bg: 'rgba(16, 185, 129, 0.15)', border: Colors.success, text: Colors.successLight };
  if (action === 'check-out') return { bg: 'rgba(245, 158, 11, 0.15)', border: Colors.warning, text: Colors.warningLight };
  return { bg: 'rgba(148, 163, 184, 0.1)', border: Colors.border, text: Colors.muted };
}

function ScanItem({ item }) {
  const ac = actionColor(item.action);
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>
          Booking #{item.bookingId}
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: Colors.radius.full,
            backgroundColor: ac.bg,
            borderWidth: 1,
            borderColor: ac.border,
          }}
        >
          <Text style={{ color: ac.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
            {item.action?.replace('-', ' ') || '—'}
          </Text>
        </View>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <Text style={{ color: Colors.muted, fontSize: 13 }}>Bay</Text>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600' }}>{item.slotNo}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <Text style={{ color: Colors.muted, fontSize: 13 }}>Status</Text>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{item.status}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <Text style={{ color: Colors.muted, fontSize: 13 }}>User</Text>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600' }}>{item.userId}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <Text style={{ color: Colors.muted, fontSize: 13 }}>Scanned at</Text>
          <Text style={{ color: Colors.logoBlueLight, fontSize: 13, fontWeight: '600' }}>{formatTime(item.scannedAt)}</Text>
        </View>
      </View>
    </Card>
  );
}

export function GateScanHistoryScreen() {
  const [history, setHistory] = useState([]);

  useFocusEffect(
    useCallback(() => {
      gateStorage.getScanHistory().then(setHistory);
    }, [])
  );

  const clearAll = () => {
    Alert.alert('Clear History', 'Delete all scan records?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await gateStorage.clearHistory();
          setHistory([]);
        },
      },
    ]);
  };

  return (
    <Screen scroll={false} contentContainerStyle={{ padding: 0 }}>
      <View style={{ flex: 1, padding: 16 }}>
        {history.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: Colors.muted, fontSize: 13 }}>
              {history.length} scan{history.length !== 1 ? 's' : ''} recorded
            </Text>
            <Button title="Clear all" tone="danger" size="sm" onPress={clearAll} />
          </View>
        )}

        {history.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: Colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              No scans yet.{'\n'}Scan a booking QR to see history here.
            </Text>
          </Card>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ScanItem item={item} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Screen>
  );
}
