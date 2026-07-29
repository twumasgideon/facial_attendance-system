import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { deactivateMember, getEmployee, updateMember } from '../api';
import { RootStackParamList } from '../navigation';
import FaceCaptureModal from '../components/FaceCaptureModal';
import Screen from '../components/Screen';
import { confirmAction, notify } from '../utils/printHtml';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberProfile'>;

export default function MemberProfileScreen({ navigation, route }: Props) {
  const { employeeId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [town, setTown] = useState('');
  const [position, setPosition] = useState('Member');
  const [photoUri, setPhotoUri] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [showFaceCam, setShowFaceCam] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmployee(employeeId);
      if (res.success && res.data?.user) {
        const u = res.data.user as Record<string, unknown>;
        setFullName(String(u.fullName || ''));
        setPhone(String(u.phone || ''));
        setTown(String(u.town || ''));
        setPosition(String(u.position || 'Member'));
        setPhotoUri(String(u.photoUrl || ''));
        setPhotoBase64('');
        setMessage('');
      } else {
        setMessage(res.message || 'Member not found');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onSave() {
    if (!fullName.trim()) {
      notify('Name required', 'Full name cannot be empty.');
      return;
    }
    if (!phone.trim()) {
      notify('Phone required', 'Phone number is required.');
      return;
    }
    if (!town.trim()) {
      notify('Town required', 'Town / location is required.');
      return;
    }

    setSaving(true);
    try {
      const body: {
        fullName: string;
        phone: string;
        town: string;
        position: string;
        photoBase64?: string;
      } = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        town: town.trim(),
        position: position.trim() || 'Member',
      };
      if (photoBase64) body.photoBase64 = photoBase64;

      const res = await updateMember(employeeId, body);
      if (res.success) {
        notify('Successful', 'Member profile updated successfully.', () => {
          navigation.navigate('People');
        });
      } else {
        notify('Update failed', res.message || 'Could not save');
      }
    } catch (e) {
      notify('Error', e instanceof Error ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    confirmAction(
      'Delete member?',
      `Remove ${fullName || employeeId} from the church register?`,
      async () => {
        setSaving(true);
        try {
          const res = await deactivateMember(employeeId);
          if (res.success) {
            notify('Deleted', 'Member removed successfully.', () => {
              navigation.navigate('People');
            });
          } else {
            notify('Delete failed', res.message || 'Could not delete');
          }
        } catch (e) {
          notify('Error', e instanceof Error ? e.message : 'Network error');
        } finally {
          setSaving(false);
        }
      },
    );
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <Screen padding={0}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Member profile</Text>
        </View>

        <View style={styles.photoCard}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={40} color={colors.textMuted} />
            </View>
          )}
          <Pressable style={styles.photoBtn} onPress={() => setShowFaceCam(true)}>
            <Ionicons name="camera" size={16} color={colors.white} />
            <Text style={styles.photoBtnText}>Update face</Text>
          </Pressable>
        </View>

        <FaceCaptureModal
          visible={showFaceCam}
          title="Update face"
          onClose={() => setShowFaceCam(false)}
          onCapture={(base64, uri) => {
            setPhotoBase64(base64);
            setPhotoUri(uri);
            setShowFaceCam(false);
          }}
        />

        <Text style={styles.idNote}>Internal ID: {employeeId}</Text>

        <Field label="Full name *" value={fullName} onChangeText={setFullName} />
        <Field label="Phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Town / Location *" value={town} onChangeText={setTown} />
        <Field label="Position" value={position} onChangeText={setPosition} />

        {/* Sticky-feeling action block — always at end of form so desktop users see it */}
        <View style={styles.actions}>
          <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={onSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveText}>Save changes</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.deleteBtn, saving && styles.disabled]}
            onPress={onDelete}
            disabled={saving}
          >
            <Ionicons name="trash" size={18} color={colors.white} />
            <Text style={styles.deleteText}>Delete member</Text>
          </Pressable>
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}
        {Platform.OS === 'web' && (
          <Text style={styles.hint}>Scroll down if needed to reach Save changes.</Text>
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
  container: { paddingHorizontal: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, fontSize: 20, fontWeight: '800', color: colors.text },
  photoCard: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  photo: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.inputBg },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: colors.tileClock,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  photoBtnText: { color: colors.white, fontWeight: '700' },
  idNote: { color: colors.textMuted, marginBottom: 12, fontSize: 12, fontWeight: '600' },
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
  actions: { marginTop: 16, gap: 12 },
  saveBtn: {
    backgroundColor: colors.tileSync,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  deleteBtn: {
    backgroundColor: colors.accentRed,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.6 },
  message: { marginTop: 12, color: colors.accent, fontWeight: '600' },
  hint: { marginTop: 10, color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
