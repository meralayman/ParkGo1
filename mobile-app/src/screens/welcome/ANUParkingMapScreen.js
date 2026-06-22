import React, { useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { PublicNavbar } from '../../components/PublicNavbar';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Colors } from '../../utils/colors';
import { LOT_NAME } from '../../constants/alexandriaLot';
import { PARKGO_PENDING_SLOT_KEY } from '../../constants/pendingSlot';

const PARKING_AREAS = {
  A: { name: 'Parking Area A', totalSlots: 90, color: '#22c55e' },
  B: { name: 'Parking Area B', totalSlots: 45, color: '#f59e0b' },
  C: { name: 'Parking Area C', totalSlots: 28, color: '#ef4444' },
  D: { name: 'Parking Area D', totalSlots: 16, color: '#3b82f6' },
};

function generateSlots(areaKey, total) {
  const slots = [];
  for (let i = 1; i <= total; i++) {
    slots.push({ slot_no: `${areaKey}${i}` });
  }
  return slots;
}

function AreaCard({ areaKey, area, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 14,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: area.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{areaKey}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 15 }}>{area.name}</Text>
          <Text style={{ color: Colors.muted, fontSize: 12 }}>{area.totalSlots} slots</Text>
        </View>
        <Text style={{ color: Colors.muted, fontSize: 18 }}>›</Text>
      </Card>
    </Pressable>
  );
}

function SlotGrid({ slots, selectedSlot, onSlotSelect, width }) {
  const cols = width < 360 ? 5 : width < 500 ? 6 : 8;
  const gap = 6;
  const slotSize = Math.floor((width - 64 - gap * (cols - 1)) / cols);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {slots.map((slot) => {
        const isSelected = selectedSlot === slot.slot_no;
        return (
          <Pressable
            key={slot.slot_no}
            onPress={() => onSlotSelect(slot.slot_no)}
            style={{
              width: slotSize,
              height: slotSize * 0.75,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: isSelected ? '#60a5fa' : 'rgba(16, 185, 129, 0.35)',
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(16, 185, 129, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: isSelected ? '#e0f2fe' : '#6ee7b7',
                fontSize: slotSize < 50 ? 10 : 11,
                fontWeight: '700',
              }}
            >
              {slot.slot_no}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ANUParkingMapScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const areaSlots = useMemo(() => {
    if (!selectedArea) return [];
    return generateSlots(selectedArea, PARKING_AREAS[selectedArea].totalSlots);
  }, [selectedArea]);

  const handleAreaPress = useCallback((key) => {
    setSelectedSlot(null);
    setSelectedArea(key);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedArea(null);
    setSelectedSlot(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedSlot) return;
    try {
      await AsyncStorage.setItem(PARKGO_PENDING_SLOT_KEY, selectedSlot);
    } catch { /* ignore */ }
    navigation.navigate('Login');
  }, [selectedSlot, navigation]);

  const area = selectedArea ? PARKING_AREAS[selectedArea] : null;

  return (
    <>
      <PublicNavbar navigation={navigation} />
      <Screen contentContainerStyle={{ paddingTop: 8 }}>
        <Pressable onPress={() => navigation.navigate('BookParking')}>
          <Text style={{ color: Colors.logoBlueLight, fontWeight: '600', marginBottom: 12 }}>
            ← Book parking
          </Text>
        </Pressable>

        <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
          {LOT_NAME}
        </Text>
        <Text style={{ color: Colors.muted, marginBottom: 14, fontSize: 14 }}>
          Tap a parking area to view and reserve available slots.
        </Text>

        {!selectedArea && (
          <>
            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 4 }}>
              <Image
                source={require('../../../assets/anu-parking-map.jpg')}
                style={{ width: '100%', height: width * 1.1, resizeMode: 'cover' }}
              />
            </Card>

            <View style={{ gap: 8 }}>
              {Object.entries(PARKING_AREAS).map(([key, a]) => (
                <AreaCard
                  key={key}
                  areaKey={key}
                  area={a}
                  onPress={() => handleAreaPress(key)}
                />
              ))}
            </View>
          </>
        )}

        {selectedArea && (
          <Card style={{ gap: 14 }}>
            <Pressable onPress={handleBack}>
              <Text style={{ color: Colors.logoBlueLight, fontWeight: '600', fontSize: 14 }}>
                ← Back to Full Map
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: area.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
                  {selectedArea}
                </Text>
              </View>
              <View>
                <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 18 }}>
                  {area.name}
                </Text>
                <Text style={{ color: Colors.muted, fontSize: 13 }}>
                  {area.totalSlots} total slots
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Text style={{ color: Colors.muted, fontSize: 13 }}>
                <Text style={{ color: '#6ee7b7', fontWeight: '700' }}>{area.totalSlots}</Text> total slots
              </Text>
              {selectedSlot && (
                <Text style={{ color: Colors.muted, fontSize: 13 }}>
                  Selected: <Text style={{ color: '#93c5fd', fontWeight: '700' }}>{selectedSlot}</Text>
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'rgba(16,185,129,0.3)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)' }} />
                <Text style={{ color: Colors.muted, fontSize: 12 }}>Available</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'rgba(59,130,246,0.4)', borderWidth: 1, borderColor: '#3b82f6' }} />
                <Text style={{ color: Colors.muted, fontSize: 12 }}>Selected</Text>
              </View>
            </View>

            <SlotGrid
              slots={areaSlots}
              selectedSlot={selectedSlot}
              onSlotSelect={setSelectedSlot}
              width={width}
            />

            {selectedSlot && (
              <View
                style={{
                  marginTop: 4,
                  padding: 14,
                  backgroundColor: Colors.elevated,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  gap: 10,
                }}
              >
                <Text style={{ color: Colors.text, fontSize: 14 }}>
                  Slot <Text style={{ fontWeight: '800' }}>{selectedSlot}</Text> in{' '}
                  <Text style={{ fontWeight: '800' }}>{area.name}</Text> selected.
                </Text>
                <Button title="Confirm Reservation" onPress={handleConfirm} />
              </View>
            )}
          </Card>
        )}
      </Screen>
    </>
  );
}
