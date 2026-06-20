import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Banner } from '../../components/Banner';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { ParkingIllustration } from '../../components/ParkingIllustration';
import { LandingBackground } from '../../components/LandingBackground';
import { PublicNavbar } from '../../components/PublicNavbar';

export function LoginScreen({ navigation }) {
  const { login, busy } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    if (!usernameOrEmail.trim()) return 'Email/username is required';
    if (!password) return 'Password is required';
    return null;
  };

  const onSubmit = async () => {
    setError('');
    const v = validate();
    if (v) return setError(v);
    try {
      await login({ usernameOrEmail: usernameOrEmail.trim(), password });
    } catch (e) {
      const msg = e?.message || 'Login failed';
      setError(msg);
      if (e?.code === 'RATE_LIMIT') {
        Alert.alert('Too many attempts', msg);
      }
    }
  };

  return (
    <LandingBackground>
      <PublicNavbar navigation={navigation} />

      <Screen contentContainerStyle={{ paddingTop: 24, gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' }}>
            Welcome back
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 300 }}>
            Sign in to book, scan, and manage parking securely.
          </Text>
        </View>

        <ParkingIllustration height={140} />

        <Banner tone="danger" text={error} />

        <Card>
          <TextField
            label="Email or username"
            value={usernameOrEmail}
            onChangeText={setUsernameOrEmail}
            placeholder="example@email.com"
            autoCapitalize="none"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <View style={{ marginTop: 4 }}>
            <Button title="Login" onPress={onSubmit} loading={busy} size="lg" />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ color: Colors.muted, fontSize: 14 }}>No account?</Text>
            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
              <Text style={{ color: Colors.logoBlueLight, fontWeight: '700', fontSize: 14 }}>Register</Text>
            </Pressable>
          </View>
        </Card>
      </Screen>
    </LandingBackground>
  );
}

