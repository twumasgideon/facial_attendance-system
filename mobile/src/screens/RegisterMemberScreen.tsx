import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
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
import { createBranch, listBranches, loadSettings, registerMember } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterMember'>;

type BranchOption = {
  code: string;
  name: string;
  organizationName: string;
};

export default function RegisterMemberScreen({ navigation }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [departmentName, setDepartmentName] = useState('General');
  const [branchCode, setBranchCode] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [photoUri, setPhotoUri] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newOrgName, setNewOrgName] = useState('');

  const refreshBranches = useCallback(async () => {
    const settings = await loadSettings();
    if (!settings.token) {
      setMessage('Login as admin in Settings first');
      return;
    }
    try {
      const res = await listBranches();
      if (res.success && res.data?.branches) {
        const list = res.data.branches as BranchOption[];
        setBranches(list);
        if (!branchCode) {
          const preferred =
            list.find((b) => b.code === settings.branchCode)?.code || list[0]?.code || '';
          setBranchCode(preferred);
        }
      } else {
        setMessage(res.message || 'Could not load branches');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    }
  }, [branchCode]);

  useFocusEffect(
    useCallback(() => {
      refreshBranches();
    }, [refreshBranches]),
  );

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required to capture a face photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
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

  async function onCreateBranch() {
    if (!newBranchCode.trim() || !newBranchName.trim() || !newOrgName.trim()) {
      Alert.alert('Missing fields', 'Branch code, name, and organization are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await createBranch({
        code: newBranchCode.trim().toUpperCase(),
        name: newBranchName.trim(),
        organizationName: newOrgName.trim(),
      });
      if (res.success) {
        setShowNewBranch(false);
        setBranchCode(newBranchCode.trim().toUpperCase());
        setNewBranchCode('');
        setNewBranchName('');
        setNewOrgName('');
        await refreshBranches();
        setMessage('Branch created');
      } else {
        Alert.alert('Failed', res.message || 'Could not create branch');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!employeeId.trim() || !fullName.trim() || !branchCode.trim()) {
      Alert.alert('Missing fields', 'Employee ID, full name, and branch are required.');
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
        employeeId: employeeId.trim().toUpperCase(),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        position: position.trim(),
        departmentCode: 'GEN',
        departmentName: departmentName.trim() || 'General',
        branchCode: branchCode.trim().toUpperCase(),
        photoBase64,
      });
      if (res.success) {
        const name = (res.data?.user?.fullName as string) || fullName;
        Alert.alert('Member registered', `${name} is now in the directory.`, [
          {
            text: 'Register another',
            onPress: () => {
              setEmployeeId('');
              setFullName('');
              setEmail('');
              setPhone('');
              setPosition('');
              setPhotoUri('');
              setPhotoBase64('');
              setMessage('Ready for next member');
            },
          },
          {
            text: 'View people',
            onPress: () => navigation.navigate('People'),
          },
        ]);
        setMessage(`Registered ${name}`);
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
    <SafeAreaView style={styles.safe}>
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
              <Ionicons name="person" size={56} color={colors.textMuted} />
              <Text style={styles.photoHint}>Face photo required</Text>
            </View>
          )}
          <View style={styles.photoActions}>
            <Pressable style={styles.photoBtn} onPress={pickFromCamera}>
              <Ionicons name="camera" size={18} color={colors.white} />
              <Text style={styles.photoBtnText}>Camera</Text>
            </Pressable>
            <Pressable style={[styles.photoBtn, styles.photoBtnAlt]} onPress={pickFromGallery}>
              <Ionicons name="images" size={18} color={colors.teal} />
              <Text style={[styles.photoBtnText, { color: colors.teal }]}>Gallery</Text>
            </Pressable>
          </View>
        </View>

        <Field label="Employee ID *" value={employeeId} onChangeText={setEmployeeId} autoCapitalize="characters" placeholder="EMP004" />
        <Field label="Full name *" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="optional" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Position" value={position} onChangeText={setPosition} placeholder="Teller" />
        <Field label="Department" value={departmentName} onChangeText={setDepartmentName} />

        <Text style={styles.label}>Branch *</Text>
        <View style={styles.branchList}>
          {branches.length === 0 ? (
            <Text style={styles.emptyBranches}>No branches yet — create one below.</Text>
          ) : (
            branches.map((b) => (
              <Pressable
                key={b.code}
                style={[styles.branchChip, branchCode === b.code && styles.branchChipActive]}
                onPress={() => setBranchCode(b.code)}
              >
                <Text style={[styles.branchChipText, branchCode === b.code && styles.branchChipTextActive]}>
                  {b.code} · {b.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable onPress={() => setShowNewBranch((v) => !v)}>
          <Text style={styles.link}>{showNewBranch ? 'Hide new branch' : '+ Create new branch'}</Text>
        </Pressable>

        {showNewBranch && (
          <View style={styles.newBranchBox}>
            <Field label="Branch code" value={newBranchCode} onChangeText={setNewBranchCode} autoCapitalize="characters" placeholder="BR02" />
            <Field label="Branch name" value={newBranchName} onChangeText={setNewBranchName} placeholder="Main Branch" />
            <Field label="Organization name" value={newOrgName} onChangeText={setNewOrgName} placeholder="Your Organization" />
            <Pressable style={[styles.submit, styles.secondary]} onPress={onCreateBranch} disabled={busy}>
              <Text style={[styles.submitText, { color: colors.teal }]}>Save branch</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={[styles.submit, busy && styles.disabled]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Register member</Text>}
        </Pressable>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {Platform.OS === 'web' && (
          <Text style={styles.hint}>On web, use Gallery if camera is unavailable in the browser.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
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
  branchList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  branchChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  branchChipActive: { backgroundColor: colors.tileClock, borderColor: colors.tileClock },
  branchChipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  branchChipTextActive: { color: colors.white },
  emptyBranches: { color: colors.textMuted, marginBottom: 8 },
  link: { color: colors.teal, fontWeight: '700', marginBottom: 12 },
  newBranchBox: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  submit: {
    marginTop: 8,
    backgroundColor: colors.tileSync,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.teal },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  message: { marginTop: 12, color: colors.teal, fontWeight: '600' },
  hint: { marginTop: 10, color: colors.textMuted, fontSize: 12 },
});
