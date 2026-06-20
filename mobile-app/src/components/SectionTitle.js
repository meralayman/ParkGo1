import React from 'react';
import { Text, View } from 'react-native';
import { Colors } from '../utils/colors';

export function SectionTitle({ title, children }) {
  return (
    <View style={{ gap: 8, marginBottom: 6 }}>
      <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 }}>{title}</Text>
      {children}
    </View>
  );
}

export function SectionHint({ children }) {
  return <View style={{ gap: 2 }}>{children}</View>;
}

export function HintGreen({ children }) {
  return <Text style={{ color: Colors.successLight, fontWeight: '700' }}>{children}</Text>;
}
