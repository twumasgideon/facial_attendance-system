import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { createAttendance, loadSettings } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Clock'>;

export default function ClockScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [employeeId, setEmployeeId] = useState('EMP001');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Position your face, then confirm clock action.');

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  async function submit(type: 'CLOCK_IN' | 'CLOCK_OUT') {
    setBusy(true);
    setMessage('Recording attendance…');
    try {
      const settings = await loadSettings();
      if (!settings.token) {
        Alert.alert('Login required', 'Open Settings and login first.');
        setMessage('Login required in Settings');
        return;
      }
      const res = await createAttendance({
        employeeId: employeeId.trim().toUpperCase(),
        deviceId: settings.deviceId || 'MOB001',
        attendanceType: type,
        timestamp: new Date().toISOString(),
        faceScore: 98.5,
        branch: settings.branchCode,
        clientEventId: `mob-${Date.now()}`,
      });
      if (res.success) {
        const name = (res.data?.attendance?.fullName as string) || employeeId;
        setMessage(`Attendance recorded — welcome ${name}`);
        Alert.alert('Success', `${type.replace('_', ' ')} saved for ${name}`);
      } else {
        setMessage(res.message || 'Failed');
        Alert.alert('Failed', res.message || 'Could not record attendance');
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Clock In / Out</Text>
      </View>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView style={styles.camera} facing="front" />
        ) : (
          <View style={styles.cameraFallback}>
            <Text style={styles.fallbackText}>Camera permission needed</Text>
            <Pressable style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Allow camera</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.message}>{message}</Text>
      <TextInput
        style={styles.input}
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="characters"
        placeholder="Employee ID (face match in Phase 1)"
        placeholderTextColor={colors.muted}
      />

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.primary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => submit('CLOCK_IN')}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Clock In</Text>}
        </Pressable>
        <Pressable
          style={[styles.btn, styles.secondary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => submit('CLOCK_OUT')}
        >
          <Text style={[styles.btnText, { color: colors.blue }]}>Clock Out</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Live camera is ready. Full on-device face matching lands in Phase 1 — for now enter employee ID
        after visual check.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.mist, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  back: { color: colors.blue, fontWeight: '700', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  cameraWrap: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.navy,
  },
  camera: { flex: 1 },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  fallbackText: { color: colors.mist },
  message: { marginTop: 14, fontSize: 15, fontWeight: '600', color: colors.ink },
  input: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.blue },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.blue },
  disabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { marginTop: 12, color: colors.muted, fontSize: 13, lineHeight: 18 },
});
