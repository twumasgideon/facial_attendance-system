import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { createAttendance, loadSettings } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Clock'>;

export default function ClockScreen({ navigation }: Props) {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Enter Employee ID and position your face');
  const [welcomeName, setWelcomeName] = useState('');
  const [registeredPhoto, setRegisteredPhoto] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Stop camera after success, while leaving the screen, or during submit.
  const cameraOn = isFocused && !!permission?.granted && !showSuccess && !busy;

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      setShowSuccess(false);
    });
    return unsub;
  }, [navigation]);

  async function submit(type: 'CLOCK_IN' | 'CLOCK_OUT') {
    if (!employeeId.trim()) {
      setStatus('Enter the Employee ID first');
      return;
    }

    // Capture the live face while the camera is still on (before busy stops it).
    let faceImageBase64 = '';
    setStatus('Scanning face...');
    try {
      const pic = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 });
      faceImageBase64 = pic?.base64 || '';
    } catch {
      // proceed without image if capture is unavailable (e.g. web)
    }

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
        faceImageBase64: faceImageBase64 || undefined,
        branch: settings.branchCode,
        clientEventId: `mob-${Date.now()}`,
      });
      if (res.success) {
        const name = (res.data?.attendance?.fullName as string) || employeeId;
        setWelcomeName(name);
        setRegisteredPhoto(res.data?.employee?.photoUrl || '');
        setShowSuccess(true);
        setStatus('Attendance recorded');
      } else {
        setStatus(res.message || 'Attendance failed');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  function closeAndLeave() {
    setShowSuccess(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={closeAndLeave} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Facial Scanner</Text>
      </View>

      <View style={styles.cameraWrap}>
        {cameraOn ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" active={cameraOn} />
        ) : permission?.granted ? (
          <View style={styles.cameraFallback}>
            <Ionicons name="videocam-off" size={36} color={colors.textMuted} />
            <Text style={styles.fallbackText}>
              {showSuccess ? 'Camera off' : busy ? 'Processing…' : 'Camera paused'}
            </Text>
          </View>
        ) : (
          <View style={styles.cameraFallback}>
            <Text style={styles.fallbackText}>Camera permission needed</Text>
            <Pressable style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryText}>Allow camera</Text>
            </Pressable>
          </View>
        )}
        {cameraOn && (
          <View style={styles.overlay}>
            <View style={styles.frame} />
          </View>
        )}
      </View>

      <Text style={styles.status}>{status}</Text>
      <TextInput
        style={styles.input}
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="characters"
        placeholder="Employee ID"
        placeholderTextColor={colors.textMuted}
        editable={!busy && !showSuccess}
      />

      <View style={styles.row}>
        <Pressable
          style={[styles.primaryBtn, styles.flex, (busy || showSuccess) && styles.disabled]}
          disabled={busy || showSuccess}
          onPress={() => submit('CLOCK_IN')}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>Clock In</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, styles.flex, (busy || showSuccess) && styles.disabled]}
          disabled={busy || showSuccess}
          onPress={() => submit('CLOCK_OUT')}
        >
          <Text style={styles.secondaryText}>Clock Out</Text>
        </Pressable>
      </View>

      <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={closeAndLeave}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Attendance Recorded</Text>
            {registeredPhoto ? (
              <Image source={{ uri: registeredPhoto }} style={styles.registeredFace} />
            ) : (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={48} color={colors.white} />
              </View>
            )}
            <Text style={styles.welcome}>Welcome {welcomeName}!!</Text>
            <Text style={styles.modalBody}>
              Attendance data received and queued for processing.
            </Text>
            <Pressable style={styles.continueBtn} onPress={closeAndLeave}>
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
    height: 200,
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    borderRadius: 20,
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
    width: 140,
    height: 160,
    borderRadius: 18,
    borderWidth: 2,
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
  registeredFace: {
    marginTop: 22,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.success,
    backgroundColor: colors.inputBg,
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
