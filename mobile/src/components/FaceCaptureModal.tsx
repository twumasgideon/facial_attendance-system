import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { SCREEN_TOP_GAP } from './Screen';

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onCapture: (base64: string, uri: string) => void;
};

export default function FaceCaptureModal({ visible, title, onClose, onCapture }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = React.useState(false);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  async function capture() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (pic?.base64) {
        onCapture(pic.base64, pic.uri);
      }
    } catch {
      // ignore capture failures; user can retry
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + SCREEN_TOP_GAP,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{title || 'Capture face'}</Text>
        </View>

        <View style={styles.cameraWrap}>
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="front" active={visible} />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={styles.fallbackText}>Camera permission needed</Text>
              <Pressable style={styles.allowBtn} onPress={requestPermission}>
                <Text style={styles.allowText}>Allow camera</Text>
              </Pressable>
            </View>
          )}
          {permission?.granted && (
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
            </View>
          )}
        </View>

        <Text style={styles.hint}>Center the face inside the frame, then capture.</Text>

        <Pressable
          style={[styles.captureBtn, (!permission?.granted || busy) && styles.disabled]}
          onPress={capture}
          disabled={!permission?.granted || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="camera" size={20} color={colors.white} />
              <Text style={styles.captureText}>Capture face</Text>
            </>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  close: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  cameraWrap: {
    flex: 1,
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
    height: 280,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(20,184,166,0.85)',
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  fallbackText: { color: colors.textMuted },
  allowBtn: {
    backgroundColor: colors.tileClock,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  allowText: { color: colors.white, fontWeight: '700' },
  hint: { color: colors.textMuted, textAlign: 'center', marginVertical: 14 },
  captureBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.tileClock,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
