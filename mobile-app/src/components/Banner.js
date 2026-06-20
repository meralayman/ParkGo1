import React from 'react';
import { Text, View } from 'react-native';
import { Colors } from '../utils/colors';

const TONES = {
  danger: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', text: Colors.dangerLight },
  warning: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', text: Colors.warningLight },
  success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', text: Colors.successLight },
  info: { bg: 'rgba(96, 165, 250, 0.10)', border: 'rgba(96, 165, 250, 0.30)', text: Colors.info },
};

export function Banner({ tone = 'info', text }) {
  if (!text) return null;
  const t = TONES[tone] || TONES.info;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg,
        padding: 14,
        borderRadius: Colors.radius.md,
      }}
    >
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}
