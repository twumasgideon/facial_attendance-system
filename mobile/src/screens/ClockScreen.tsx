import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [status, setStatus] = useState('Position your face in the frame');
  const [welcomeName, setWelcomeName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  async function submit(type: 'CLOCK_IN' | 'CLOCK_OUT') {
    setBusy(true);
    setStatus('Recording attendance...');
    try {
      const settings = await loadSettings();
      if (!settings.token) {
        setStatus('Login required — open Settings first');
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
        setWelcomeName(name);
        setShowSuccess(true);
        setStatus('Recording attendance...');
      } else {
        setStatus(res.message || 'Attendance failed');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Facial Scanner</Text>
      </View>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView style={styles.camera} facing="front" />
        ) : (
          <View style={styles.cameraFallback}>
            <Text style={styles.fallbackText}>Camera permission needed</Text>
            <Pressable style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryText}>Allow camera</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.overlay}>
          <View style={styles.frame} />
        </View>
      </View>

      <Text style={styles.status}>{status}</Text>
      <TextInput
        style={styles.input}
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="characters"
        placeholder="Employee ID"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.row}>
        <Pressable
          style={[styles.primaryBtn, styles.flex, busy && styles.disabled]}
          disabled={busy}
          onPress={() => submit('CLOCK_IN')}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>Clock In</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, styles.flex, busy && styles.disabled]}
          disabled={busy}
          onPress={() => submit('CLOCK_OUT')}
        >
          <Text style={styles.secondaryText}>Clock Out</Text>
        </Pressable>
      </View>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Attendance Recorded</Text>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={48} color={colors.white} />
            </View>
            <Text style={styles.welcome}>Welcome {welcomeName}!!</Text>
            <Text style={styles.modalBody}>
              Attendance data received and queued for processing.
            </Text>
            <Pressable
              style={styles.continueBtn}
              onPress={() => {
                setShowSuccess(false);
                navigation.navigate('Home');
              }}
            >
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, fontSize: 20, fontWeight: '800', color: colors.text },
  cameraWrap: {
    height: 340,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 220,
    height: 260,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(20,184,166,0.85)',
  },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  fallbackText: { color: colors.textMuted },
  status: { marginTop: 14, fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    marginTop: 10,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flex: { flex: 1 },
  primaryBtn: {
    backgroundColor: colors.tileClock,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.teal,
  },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  secondaryText: { color: colors.teal, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
  },
  modalTitle: { color: colors.white, fontSize: 22, fontWeight: '800' },
  checkCircle: {
    marginTop: 22,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: { marginTop: 18, color: colors.white, fontSize: 24, fontWeight: '800' },
  modalBody: {
    marginTop: 10,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  continueBtn: {
    marginTop: 24,
    alignSelf: 'stretch',
    backgroundColor: colors.teal,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
