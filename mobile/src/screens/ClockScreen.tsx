import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { createAttendance, loadSettings } from '../api';
import { RootStackParamList } from '../navigation';
import Screen from '../components/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Clock'>;

export default function ClockScreen({ navigation }: Props) {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Position your face in the frame, then Clock In or Out');
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeBody, setWelcomeBody] = useState('');
  const [stampTime, setStampTime] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState('');
  const [attendanceType, setAttendanceType] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
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
    let faceImageBase64 = '';
    setStatus('Scanning face...');
    try {
      const pic = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.55 });
      faceImageBase64 = pic?.base64 || '';
    } catch {
      // capture may fail on some browsers
    }

    if (!faceImageBase64) {
      setStatus(
        Platform.OS === 'web'
          ? 'Could not capture face. Allow camera access and try again.'
          : 'Could not capture face. Check camera permission and try again.',
      );
      return;
    }

    setBusy(true);
    setStatus('Recognizing face...');
    try {
      const settings = await loadSettings();
      if (!settings.token) {
        setStatus('Login required — open Settings first');
        return;
      }
      const res = await createAttendance({
        deviceId: settings.deviceId || 'KASSE-PHONE',
        attendanceType: type,
        timestamp: new Date().toISOString(),
        faceImageBase64,
        clientEventId: `mob-${Date.now()}`,
      });
      if (res.success) {
        const name =
          (res.data?.attendance?.fullName as string) ||
          (res.data?.employee?.fullName as string) ||
          'Member';
        const attStatus = String(res.data?.attendance?.status || '');
        const stamped =
          String(res.data?.attendance?.stampedAt || '') ||
          String(res.data?.attendance?.stampedTime || '');
        setWelcomeName(res.data?.welcome?.title || `Welcome ${name}!`);
        setWelcomeBody(
          res.data?.welcome?.body ||
            (type === 'CLOCK_IN'
              ? 'Your presence welcome to the Church of Pentecost Kasse Assembly Kumasi'
              : 'You have been clocked out. God bless you.'),
        );
        setStampTime(stamped);
        setAttendanceStatus(attStatus);
        setAttendanceType(type);
        setRegisteredPhoto(res.data?.employee?.photoUrl || '');
        setShowSuccess(true);
        setStatus(
          type === 'CLOCK_IN'
            ? attStatus === 'LATE'
              ? `Recognized ${name} — LATE`
              : `Recognized ${name} — On time`
            : `Recognized ${name} — Clocked out`,
        );
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
    <Screen>
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
      <Text style={styles.hint}>No Member ID needed — your face identifies you.</Text>

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
            <Text style={styles.modalTitle}>
              {attendanceType === 'CLOCK_IN' ? 'Clock-in recorded' : 'Clock-out recorded'}
            </Text>
            {registeredPhoto ? (
              <Image source={{ uri: registeredPhoto }} style={styles.registeredFace} />
            ) : (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={48} color={colors.white} />
              </View>
            )}
            <Text style={styles.welcome}>{welcomeName}</Text>
            <Text style={styles.modalBody}>{welcomeBody}</Text>
            {!!stampTime && (
              <Text style={styles.stamp}>Stamp: {stampTime} (Ghana)</Text>
            )}
            {attendanceType === 'CLOCK_IN' && !!attendanceStatus && (
              <View
                style={[
                  styles.badge,
                  attendanceStatus === 'LATE' ? styles.badgeLate : styles.badgeOnTime,
                ]}
              >
                <Text style={styles.badgeText}>
                  {attendanceStatus === 'LATE' ? 'LATE' : 'ON TIME / PRESENT'}
                </Text>
              </View>
            )}
            <Pressable style={styles.continueBtn} onPress={closeAndLeave}>
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, fontSize: 20, fontWeight: '800', color: colors.text },
  cameraWrap: {
    height: 280,
    width: '100%',
    maxWidth: 360,
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
    width: 160,
    height: 190,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.85)',
  },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  fallbackText: { color: colors.textMuted },
  status: { marginTop: 14, fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  hint: {
    marginTop: 6,
    marginBottom: 4,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
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
  welcome: { marginTop: 18, color: colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalBody: {
    marginTop: 10,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  stamp: {
    marginTop: 12,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  badge: {
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeOnTime: { backgroundColor: colors.success },
  badgeLate: { backgroundColor: colors.accentRed },
  badgeText: { color: colors.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
  continueBtn: {
    marginTop: 24,
    alignSelf: 'stretch',
    backgroundColor: colors.tileClock,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
