import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { UserDashboardScreen } from '../../screens/user/UserDashboardScreen';
import { BookingScreen } from '../../screens/user/BookingScreen';
import { QrCodeScreen } from '../../screens/user/QrCodeScreen';
import { BookingHistoryScreen } from '../../screens/user/BookingHistoryScreen';
import { UserIncidentScreen } from '../../screens/user/UserIncidentScreen';
import { navScreenOptions } from '../widgets/navScreenOptions';

const Tab = createBottomTabNavigator();

const tabIcon = (emoji) => ({
  tabBarIcon: ({ color }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  ),
});

export function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...navScreenOptions,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={UserDashboardScreen}
        options={{ title: 'Dashboard', ...tabIcon('🏠') }}
      />
      <Tab.Screen
        name="Book"
        component={BookingScreen}
        options={{ title: 'Booking', ...tabIcon('🅿️') }}
      />
      <Tab.Screen name="QR" component={QrCodeScreen} options={{ title: 'My QR', ...tabIcon('📱') }} />
      <Tab.Screen
        name="History"
        component={BookingHistoryScreen}
        options={{ title: 'Bookings', ...tabIcon('📋') }}
      />
      <Tab.Screen
        name="Incident"
        component={UserIncidentScreen}
        options={{ title: 'Report', headerShown: true, headerTitle: 'Report Incident', ...tabIcon('🚨') }}
      />
    </Tab.Navigator>
  );
}
