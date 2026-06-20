import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../utils/colors';

export function DashboardMasthead({ title, subtitle, onReportIncident, onLogout }) {
  return (
    <LinearGradient
      colors={['rgba(37, 99, 235, 0.12)', 'rgba(99, 102, 241, 0.06)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingHorizontal: Colors.space.lg,
        paddingTop: Colors.space.lg,
        paddingBottom: Colors.space.xl,
        gap: Colors.space.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: Colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.3 }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 22 }}>{subtitle}</Text>
          ) : null}
        </View>
        {onLogout ? (
          <Pressable
            onPress={onLogout}
            hitSlop={8}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: Colors.radius.sm,
              borderWidth: 1,
              borderColor: Colors.border,
              backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
            })}
          >
            <Text style={{ color: Colors.muted, fontWeight: '600', fontSize: 13 }}>Logout</Text>
          </Pressable>
        ) : null}
      </View>
      {onReportIncident ? (
        <Pressable
          onPress={onReportIncident}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: Colors.radius.full,
            borderWidth: 1,
            borderColor: Colors.borderMedium,
            backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
          })}
        >
          <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Report an incident</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}
