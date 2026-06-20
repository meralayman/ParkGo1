import React from 'react';
import { View } from 'react-native';
import { Colors } from '../utils/colors';

export function Card({ children, style, variant }) {
  const isElevated = variant === 'elevated';
  return (
    <View
      style={[
        {
          backgroundColor: isElevated ? Colors.elevated : Colors.card,
          borderColor: Colors.border,
          borderWidth: 1,
          borderRadius: Colors.radius.lg,
          padding: Colors.space.lg,
          gap: Colors.space.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
