import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { loadSettings, registerMember } from '../api';
import { RootStackParamList } from '../navigation';
import FaceCaptureModal from '../components/FaceCaptureModal';
import Screen from '../components/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterMember'>;

export default function RegisterMemberScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('Member');
  const [departmentName, setDepartmentName] = useState('General');
  const [photoUri, setPhotoUri] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showFaceCam, setShowFaceCam] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadSettings().then((s) => {
        if (!s.token) setMessage('Login as admin in Settings first');
        else setMessage('');
      });
    }, []),
  );

  function onFaceCaptured(base64: string, uri: string) {
    setPhotoUri(uri);
    setPhotoBase64(base64);
    setShowFaceCam(false);
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 || '');
    }
  }

  async function onSubmit() {
    if (!fullName.trim()) {
      Alert.alert('Missing fields', 'Full name is required.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Add the member’s registered phone number.');
      return;
    }
    if (!photoBase64) {
      Alert.alert('Face photo required', 'Capture or select a face photo before registering.');
      return;
    }

    setBusy(true);
    setMessage('Registering member…');
    try {
      const res = await registerMember({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        position: position.trim() || 'Member',
        departmentCode: 'GEN',
        departmentName: departmentName.trim() || 'General',
        photoBase64,
      });
      if (res.success) {
        const name = (res.data?.user?.fullName as string) || fullName;
        const savedId = String(
          res.data?.memberId || res.data?.user?.employeeId || '',
        ).toUpperCase();
        Alert.alert(
          'Member registered',
          `${name}\nChurch Member ID: ${savedId}\n\nUse this ID to clock in / out.`,
          [
            {
              text: 'Register another',
              onPress: () => {
                setFullName('');
                setEmail('');
                setPhone('');
                setPosition('Member');
                setPhotoUri('');
                setPhotoBase64('');
                setMessage('Ready for next member');
              },
            },
            {
              text: 'Go to clock',
              onPress: () => navigation.navigate('Clock'),
            },
          ],
        );
        setMessage(`Registered ${name} · ID ${savedId}`);
      } else {
        setMessage(res.message || 'Registration failed');
        Alert.alert('Failed', res.message || 'Could not register member');
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Network error';
      setMessage(err);
      Alert.alert('Error', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padding={0}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Register Member</Text>
        </View>

        <View style={styles.photoCard}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="scan-outline" size={56} color={colors.textMuted} />
              <Text style={styles.photoHint}>Register face for clock-in</Text>
            </View>
          )}
          <Text style={styles.photoCaption}>
            {photoUri
              ? 'Face registered — used for clock-in / clock-out'
              : 'Capture the member’s face. A Church Member ID will be generated automatically.'}
          </Text>
          <View style={styles.photoActions}>
            <Pressable style={styles.photoBtn} onPress={() => setShowFaceCam(true)}>
              <Ionicons name="camera" size={18} color={colors.white} />
              <Text style={styles.photoBtnText}>{photoUri ? 'Retake face' : 'Register face'}</Text>
            </Pressable>
            <Pressable style={[styles.photoBtn, styles.photoBtnAlt]} onPress={pickFromGallery}>
              <Ionicons name="images" size={18} color={colors.teal} />
              <Text style={[styles.photoBtnText, { color: colors.teal }]}>Gallery</Text>
            </Pressable>
          </View>
        </View>

        <FaceCaptureModal
          visible={showFaceCam}
          title="Register face"
          onClose={() => setShowFaceCam(false)}
          onCapture={onFaceCaptured}
        />

        <Text style={styles.autoIdNote}>Church Member ID is generated automatically (e.g. CM001).</Text>

        <Field label="Full name *" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
        <Field
          label="Phone *"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="024xxxxxxx"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="optional"
        />
        <Field label="Position" value={position} onChangeText={setPosition} placeholder="Member" />
        <Field label="Department" value={departmentName} onChangeText={setDepartmentName} />

        <Pressable style={[styles.submit, busy && styles.disabled]} onPress={onSubmit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>Register member</Text>
          )}
        </Pressable>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {Platform.OS === 'web' && (
          <Text style={styles.hint}>On web, use Gallery if camera is unavailable in the browser.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, fontSize: 20, fontWeight: '800', color: colors.text },
  photoCard: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  photo: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.inputBg },
  photoPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoHint: { color: colors.textMuted, fontSize: 12 },
  photoCaption: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  photoBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: colors.tileClock,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  photoBtnAlt: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  photoBtnText: { color: colors.white, fontWeight: '700' },
  autoIdNote: {
    color: colors.accent,
    fontWeight: '700',
    marginBottom: 14,
    fontSize: 13,
  },
  label: { marginBottom: 6, color: colors.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
  },
  submit: {
    marginTop: 8,
    backgroundColor: colors.tileSync,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  message: { marginTop: 12, color: colors.teal, fontWeight: '600' },
  hint: { marginTop: 10, color: colors.textMuted, fontSize: 12 },
});
