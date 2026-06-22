import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../../screens/auth/LoginScreen';
import { RegisterScreen } from '../../screens/auth/RegisterScreen';
import { WelcomeScreen } from '../../screens/welcome/WelcomeScreen';
import { BookParkingScreen } from '../../screens/welcome/BookParkingScreen';
import { AlexandriaSlotsScreen } from '../../screens/welcome/AlexandriaSlotsScreen';
import { ANUParkingMapScreen } from '../../screens/welcome/ANUParkingMapScreen';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="BookParking" component={BookParkingScreen} />
      <Stack.Screen name="AlexandriaSlots" component={AlexandriaSlotsScreen} />
      <Stack.Screen name="ANUParkingMap" component={ANUParkingMapScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
