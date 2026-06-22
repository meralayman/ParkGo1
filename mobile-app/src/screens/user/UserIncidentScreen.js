import React, { useEffect, useState } from 'react';
import { Alert, Image, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { api } from '../../services/apiClient';
import { getUserReservations } from '../../services/parkgo.service';

const inputStyle = {
  backgroundColor: Colors.elevated,
  color: Colors.text,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: Colors.radius.md,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
};

export function UserIncidentScreen() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    if (user?.id) {
      getUserReservations(user.id)
        .then((r) => setReservations(r || []))
        .catch(() => {});
    }
  }, [user?.id]);

  const activeReservations = reservations.filter(
    (r) => r.status === 'confirmed' || r.status === 'checked_in'
  );

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const submit = async () => {
    setError('');
    setSuccess('');

    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!mobile.trim()) { setError('Mobile number is required.'); return; }
    if (!reservationId.trim()) { setError('Reservation ID is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('mobile', mobile.trim());
      formData.append('reservationId', reservationId.trim());
      formData.append('description', description.trim());
      if (user?.id) formData.append('userId', String(user.id));

      if (photo) {
        const ext = photo.uri.split('.').pop() || 'jpg';
        formData.append('photo', {
          uri: photo.uri,
          name: `incident_${Date.now()}.${ext}`,
          type: photo.mimeType || `image/${ext}`,
        });
      }

      const res = await api.post('/incidents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.data?.ok) {
        setSuccess('Incident reported successfully.');
        setFullName('');
        setMobile('');
        setReservationId('');
        setDescription('');
        setPhoto(null);
        Alert.alert('Success', 'Your incident report has been submitted.');
      } else {
        throw new Error(res?.data?.error || 'Failed to submit report');
      }
    } catch (e) {
      setError(e?.message || 'Failed to submit. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ paddingTop: Colors.space.xl, gap: Colors.space.lg }}>
      <Banner tone="danger" text={error} />
      <Banner tone="success" text={success} />

      <Card>
        <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700' }}>Report an Incident</Text>
        <Text style={{ color: Colors.muted, fontSize: 13, lineHeight: 19 }}>
          Report parking violations, vehicle damage, safety concerns, or any issues related to your booking.
        </Text>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: Colors.muted, fontSize: 13, fontWeight: '600' }}>Full Name *</Text>
            <TextInput
              style={inputStyle}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={Colors.muted}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: Colors.muted, fontSize: 13, fontWeight: '600' }}>Mobile Number *</Text>
            <TextInput
              style={inputStyle}
              value={mobile}
              onChangeText={setMobile}
              placeholder="Your phone number"
              placeholderTextColor={Colors.muted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: Colors.muted, fontSize: 13, fontWeight: '600' }}>Reservation *</Text>
            {reservations.length > 0 ? (
              <View style={{ gap: 6 }}>
                {reservations.map((r) => {
                  const isActive = String(r.id) === reservationId;
                  const slot = r.slot_no || '?';
                  const date = r.start_time ? new Date(r.start_time).toLocaleDateString() : '';
                  const status = (r.status || '').replace('_', ' ');
                  return (
                    <Button
                      key={r.id}
                      title={`Slot ${slot} — ${date} (${status})`}
                      tone={isActive ? 'primary' : 'secondary'}
                      size="sm"
                      onPress={() => setReservationId(String(r.id))}
                    />
                  );
                })}
              </View>
            ) : (
              <TextInput
                style={inputStyle}
                value={reservationId}
                onChangeText={setReservationId}
                placeholder="Enter your booking ID"
                placeholderTextColor={Colors.muted}
              />
            )}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: Colors.muted, fontSize: 13, fontWeight: '600' }}>Description *</Text>
            <TextInput
              style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the incident in detail..."
              placeholderTextColor={Colors.muted}
              multiline
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: Colors.muted, fontSize: 13, fontWeight: '600' }}>Photo (optional)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Take photo" tone="secondary" size="sm" onPress={takePhoto} />
              <Button title="Pick from gallery" tone="secondary" size="sm" onPress={pickPhoto} />
            </View>
            {photo && (
              <View style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{
                    width: 200,
                    height: 150,
                    borderRadius: Colors.radius.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                  resizeMode="cover"
                />
                <Button title="Remove photo" tone="danger" size="sm" onPress={() => setPhoto(null)} />
              </View>
            )}
          </View>
        </View>
      </Card>

      <Button
        title={loading ? 'Submitting...' : 'Submit Report'}
        onPress={submit}
        disabled={loading}
        loading={loading}
        size="lg"
      />
    </Screen>
  );
}
