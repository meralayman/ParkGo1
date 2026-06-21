import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { GateQrScannerScreen } from '../../screens/gatekeeper/GateQrScannerScreen';
import { GateActionScreen } from '../../screens/gatekeeper/GateActionScreen';
import { GateScanHistoryScreen } from '../../screens/gatekeeper/GateScanHistoryScreen';
import { GateIncidentScreen } from '../../screens/gatekeeper/GateIncidentScreen';
import { HeaderRightLogout } from '../widgets/HeaderRightLogout';
import { navScreenOptions } from '../widgets/navScreenOptions';

const Tab = createBottomTabNavigator();

export function GatekeeperTabs() {
  return (
    <Tab.Navigator screenOptions={{ ...navScreenOptions, headerRight: () => <HeaderRightLogout /> }}>
      <Tab.Screen name="Scan" component={GateQrScannerScreen} options={{ title: 'QR Scanner' }} />
      <Tab.Screen name="Gate" component={GateActionScreen} options={{ title: 'Check-in/out' }} />
      <Tab.Screen name="History" component={GateScanHistoryScreen} options={{ title: 'Scan History' }} />
      <Tab.Screen name="Incident" component={GateIncidentScreen} options={{ title: 'Report Incident' }} />
    </Tab.Navigator>
  );
}
