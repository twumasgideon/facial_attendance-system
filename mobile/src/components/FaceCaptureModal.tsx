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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + SCREEN_TOP_GAP,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{title || 'Capture face'}</Text>
          </View>

          <View style={styles.cameraWrap}>
            {permission?.granted ? (
              <CameraView ref={cameraRef} style={styles.camera} facing="front" active={visible} />
            ) : (
              <View style={styles.fallback}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
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

          <Text style={styles.hint}>Center face in the small frame, then capture.</Text>

          <Pressable
            style={[styles.captureBtn, (!permission?.granted || busy) && styles.disabled]}
            onPress={capture}
            disabled={!permission?.granted || busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={styles.captureText}>Capture face</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 16,
    maxWidth: 380,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  close: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  cameraWrap: {
    height: 200,
    width: '100%',
    maxWidth: 260,
    alignSelf: 'center',
    borderRadius: 16,
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
    width: 110,
    height: 140,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,209,0,0.9)',
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 },
  fallbackText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  allowBtn: {
    backgroundColor: colors.tileClock,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  allowText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  hint: { color: colors.textMuted, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  captureBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.tileClock,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.6 },
});
