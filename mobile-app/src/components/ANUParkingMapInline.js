import React, { useState, useMemo, useCallback } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Card } from './Card';
import { Colors } from '../utils/colors';

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

function SlotGrid({ slots, selectedSlot, onSlotSelect, width }) {
  const cols = width < 360 ? 5 : width < 500 ? 6 : 8;
  const gap = 5;
  const slotSize = Math.floor((width - 80 - gap * (cols - 1)) / cols);

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
              height: slotSize * 0.72,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: isSelected ? '#60a5fa' : 'rgba(16, 185, 129, 0.25)',
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: isSelected ? '#e0f2fe' : 'rgba(110, 231, 183, 0.85)',
                fontSize: slotSize < 48 ? 9 : 10,
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

export function ANUParkingMapInline({ selectedSlot, onSlotSelect }) {
  const { width } = useWindowDimensions();
  const [selectedArea, setSelectedArea] = useState(null);

  const areaSlots = useMemo(() => {
    if (!selectedArea) return [];
    return generateSlots(selectedArea, PARKING_AREAS[selectedArea].totalSlots);
  }, [selectedArea]);

  const handleAreaPress = useCallback((key) => {
    setSelectedArea(key);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedArea(null);
  }, []);

  const area = selectedArea ? PARKING_AREAS[selectedArea] : null;

  if (!selectedArea) {
    return (
      <View style={{ gap: 8 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Image
            source={require('../../assets/anu-parking-map.jpg')}
            style={{ width: '100%', height: width * 0.85, resizeMode: 'cover' }}
          />
        </Card>

        {Object.entries(PARKING_AREAS).map(([key, a]) => (
          <Pressable key={key} onPress={() => handleAreaPress(key)}>
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderLeftWidth: 3,
                borderLeftColor: a.color,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: a.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{key}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 14 }}>{a.name}</Text>
                <Text style={{ color: Colors.muted, fontSize: 11 }}>{a.totalSlots} slots</Text>
              </View>
              <Text style={{ color: Colors.muted, fontSize: 16 }}>›</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={handleBack}>
        <Text style={{ color: Colors.logoBlueLight, fontWeight: '600', fontSize: 13 }}>
          ← Back to Full Map
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: area.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{selectedArea}</Text>
        </View>
        <View>
          <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 17 }}>{area.name}</Text>
          <Text style={{ color: Colors.muted, fontSize: 12 }}>{area.totalSlots} total slots</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(16,185,129,0.35)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)' }} />
          <Text style={{ color: Colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}>Available</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(59,130,246,0.45)', borderWidth: 1, borderColor: '#3b82f6' }} />
          <Text style={{ color: Colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}>Selected</Text>
        </View>
      </View>

      <SlotGrid
        slots={areaSlots}
        selectedSlot={selectedSlot}
        onSlotSelect={onSlotSelect}
        width={width}
      />
    </View>
  );
}
