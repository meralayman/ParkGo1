import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/store/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Chatbot } from './src/components/Chatbot';

function ChatbotGuard() {
  const { role } = useAuth();
  if (String(role || '').toLowerCase() === 'admin') return null;
  return <Chatbot />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <ChatbotGuard />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
