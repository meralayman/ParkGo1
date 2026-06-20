import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../utils/colors';

export function Button({ title, onPress, disabled, loading, tone = 'primary', size = 'md', icon }) {
  const isPrimary = tone === 'primary';
  const isDanger = tone === 'danger';
  const isWarning = tone === 'warning';
  const isSuccess = tone === 'success';

  const padV = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;
  const padH = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14.5;

  const solidBg = isDanger
    ? Colors.danger
    : isWarning
      ? Colors.warning
      : isSuccess
        ? Colors.success
        : Colors.elevated;

  const innerStyle = {
    paddingVertical: padV,
    paddingHorizontal: padH,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };

  const labelStyle = {
    fontWeight: '700',
    fontSize,
    letterSpacing: 0.2,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        borderRadius: Colors.radius.md,
        overflow: 'hidden',
        borderWidth: isPrimary ? 0 : 1,
        borderColor: isPrimary ? 'transparent' : Colors.border,
        opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[Colors.logoBlue, Colors.accentPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={innerStyle}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              {icon || null}
              <Text style={[labelStyle, { color: '#ffffff' }]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      ) : (
        <View style={[innerStyle, { backgroundColor: solidBg }]}>
          {loading ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <>
              {icon || null}
              <Text style={[labelStyle, { color: isDanger || isWarning || isSuccess ? '#ffffff' : Colors.text }]}>
                {title}
              </Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}
