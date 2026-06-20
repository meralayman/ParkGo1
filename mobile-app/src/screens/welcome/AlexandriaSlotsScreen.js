import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { PublicNavbar } from '../../components/PublicNavbar';
import { Screen } from '../../components/Screen';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { AlexandriaParkingGrid } from '../../components/AlexandriaParkingGrid';
import { SectionTitle, SectionHint, HintGreen } from '../../components/SectionTitle';
import { Colors } from '../../utils/colors';
import { getSlots } from '../../services/parkgo.service';
import { LOT_NAME } from '../../constants/alexandriaLot';
import { PARKGO_PENDING_SLOT_KEY } from '../../constants/pendingSlot';

export function AlexandriaSlotsScreen({ navigation }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlotNo, setSelectedSlotNo] = useState(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await getSlots();
      setSlots(Array.isArray(s) ? s : []);
    } catch (e) {
      setError(e?.message || 'Cannot reach server');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(PARKGO_PENDING_SLOT_KEY);
        if (
          saved &&
          slots.some((s) => String(s.slot_no).trim() === String(saved).trim() && Number(s.state) === 0)
        ) {
          setSelectedSlotNo(String(saved).trim());
        }
      } catch {
        /* ignore */
      }
    })();
  }, [slots]);

  const handleSelect = async (slotNo) => {
    const key = String(slotNo || '').trim();
    setSelectedSlotNo(key);
    try {
      await AsyncStorage.setItem(PARKGO_PENDING_SLOT_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const handleClear = async () => {
    setSelectedSlotNo(null);
    try {
      await AsyncStorage.removeItem(PARKGO_PENDING_SLOT_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <PublicNavbar navigation={navigation} />
      <Screen contentContainerStyle={{ paddingTop: 8 }}>
        <Pressable onPress={() => navigation.navigate('BookParking')}>
          <Text style={{ color: Colors.logoBlueLight, fontWeight: '600', marginBottom: 12 }}>← Book parking</Text>
        </Pressable>

        <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '700', marginBottom: 6 }}>{LOT_NAME}</Text>
        <Text style={{ color: Colors.muted, marginBottom: 16 }}>Pick an available slot to continue booking.</Text>

        <Banner tone="danger" text={error} />

        <SectionTitle title="Parking map — choose your bay">
          <SectionHint>
            <Text style={{ color: Colors.muted, fontSize: 15, lineHeight: 22 }}>
              Tap a <HintGreen>green</HintGreen> bay to select it.
            </Text>
          </SectionHint>
        </SectionTitle>

        {loading ? (
          <ActivityIndicator color={Colors.logoBlueLight} style={{ marginVertical: 24 }} />
        ) : error ? null : (
          <AlexandriaParkingGrid
            slots={slots}
            selectedSlotNo={selectedSlotNo}
            onSlotPress={handleSelect}
            showLegend
          />
        )}

        {selectedSlotNo && !loading && !error ? (
          <View
            style={{
              marginTop: 16,
              padding: 14,
              backgroundColor: Colors.elevated,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: Colors.border,
              gap: 10,
            }}
          >
            <Text style={{ color: Colors.text, fontSize: 15 }}>
              Slot <Text style={{ fontWeight: '800' }}>{selectedSlotNo}</Text> selected. After you log in, this spot
              stays selected for your reservation.
            </Text>
            <Button title="Continue to login" onPress={() => navigation.navigate('Login')} />
            <Button title="Clear selection" onPress={handleClear} tone="secondary" />
          </View>
        ) : null}
      </Screen>
    </>
  );
}
