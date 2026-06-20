import React, { useMemo } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Colors } from '../utils/colors';
import { sortSlotsForAlexandriaGrid } from '../utils/slotSorting';

function stateKey(state) {
  const n = Number(state);
  if (n === 0) return 'available';
  if (n === 2) return 'reserved';
  return 'occupied';
}

const SLOT_STYLES = {
  available: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.55)',
    text: '#6ee7b7',
  },
  occupied: {
    bg: Colors.elevated,
    border: Colors.border,
    text: Colors.muted,
  },
  reserved: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.5)',
    text: '#fbbf24',
  },
  selected: {
    bg: 'rgba(37, 99, 235, 0.28)',
    border: '#60a5fa',
    text: '#e0f2fe',
  },
};

function LegendItem({ label, swatch }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: swatch.border,
          backgroundColor: swatch.bg,
        }}
      />
      <Text style={{ color: Colors.muted, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

export function AlexandriaParkingGrid({
  slots,
  selectedSlotNo,
  onSlotPress,
  showLegend = true,
  columns = 4,
}) {
  const { width } = useWindowDimensions();
  const ordered = useMemo(() => sortSlotsForAlexandriaGrid(slots), [slots]);
  const availableCount = slots.filter((s) => Number(s.state) === 0).length;
  const takenCount = slots.length - availableCount;

  const gap = 8;
  const slotWidth = Math.floor((width - 32 - gap * (columns - 1)) / columns);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Text style={{ color: Colors.muted, fontSize: 14 }}>
          <Text style={{ color: Colors.success, fontWeight: '700' }}>{availableCount}</Text> available
        </Text>
        <Text style={{ color: Colors.muted, fontSize: 14 }}>
          <Text style={{ fontWeight: '700' }}>{takenCount}</Text> taken
        </Text>
      </View>

      {showLegend ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <LegendItem label="Available" swatch={SLOT_STYLES.available} />
          <LegendItem label="Occupied" swatch={SLOT_STYLES.occupied} />
          <LegendItem label="Reserved" swatch={SLOT_STYLES.reserved} />
          <LegendItem label="Selected" swatch={SLOT_STYLES.selected} />
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: Colors.card,
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: Colors.radius.lg,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {ordered.map((slot) => {
            const key = stateKey(slot.state);
            const isSelectable = Number(slot.state) === 0;
            const isSelected = String(selectedSlotNo) === String(slot.slot_no);
            const tone = isSelected ? SLOT_STYLES.selected : SLOT_STYLES[key];
            const canPress = isSelectable && onSlotPress;

            return (
              <Pressable
                key={String(slot.slot_no)}
                accessibilityRole="button"
                accessibilityLabel={`Slot ${slot.slot_no}, ${key}`}
                accessibilityState={{ disabled: !canPress, selected: isSelected }}
                disabled={!canPress}
                onPress={() => canPress && onSlotPress(slot.slot_no)}
                style={({ pressed }) => ({
                  width: slotWidth,
                  minHeight: 56,
                  borderRadius: Colors.radius.sm,
                  borderWidth: isSelected ? 2.5 : 2,
                  borderColor: tone.border,
                  backgroundColor: tone.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !isSelectable ? 0.85 : pressed ? 0.88 : 1,
                  transform: [{ scale: isSelected ? 1.02 : pressed && isSelectable ? 0.97 : 1 }],
                  ...(isSelected
                    ? {
                        shadowColor: '#3b82f6',
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 6,
                      }
                    : {}),
                })}
              >
                <Text style={{ color: tone.text, fontWeight: '700', fontSize: 14 }}>{slot.slot_no}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
