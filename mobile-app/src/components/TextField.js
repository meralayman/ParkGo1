import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Colors } from '../utils/colors';

export function TextField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType,
  editable = true,
  multiline,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ color: Colors.muted, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? Colors.logoBlue : Colors.border,
          backgroundColor: Colors.elevated,
          color: Colors.text,
          paddingHorizontal: 14,
          paddingVertical: 13,
          borderRadius: Colors.radius.md,
          fontSize: 15,
          opacity: editable ? 1 : 0.5,
        }}
      />
      {hint ? (
        <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
