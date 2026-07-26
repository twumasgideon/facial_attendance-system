import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, DEFAULT_API_URL } from '../theme';
import { listBranches, loadSettings, login, registerDevice, saveSettings } from '../api';
import { RootStackParamList } from '../navigation';
import Screen from '../components/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type BranchOption = { code: string; name: string; organizationName: string };

export default function SettingsScreen({ navigation }: Props) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState('admin@presence.local');
  const [password, setPassword] = useState('Admin123!');
  const [branchCode, setBranchCode] = useState('');
  const [deviceName, setDeviceName] = useState('Kasse CoP Phone');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tokenSet, setTokenSet] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const refreshBranches = React.useCallback(async (preferred?: string) => {
    const s = await loadSettings();
    if (!s.token) return;
    try {
      const res = await listBranches();
      if (res.success && res.data?.branches) {
        const list = res.data.branches as BranchOption[];
        setBranches(list);
        setBranchCode((current) => {
          const next = preferred || current;
          if (next && list.some((b) => b.code === next)) return next;
          return list.length === 1 ? list[0].code : next;
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    loadSettings().then((s) => {
      setApiUrl(s.apiUrl);
      setBranchCode(s.branchCode);
      setDeviceName(s.deviceName);
      setTokenSet(!!s.token);
      setDeviceId(s.deviceId);
      if (s.token) refreshBranches(s.branchCode);
    });
  }, [refreshBranches]);

  async function onSave() {
    await saveSettings({
      apiUrl: apiUrl.trim(),
      branchCode: branchCode.trim().toUpperCase(),
      deviceName: deviceName.trim(),
    });
    setMessage('Settings saved');
  }

  async function onLogin() {
    setBusy(true);
    setMessage('Signing in…');
    try {
      await saveSettings({ apiUrl: apiUrl.trim() });
      const res = await login(email.trim(), password, apiUrl.trim());
      if (res.success && res.data?.token) {
        await saveSettings({ token: res.data.token });
        setTokenSet(true);
        setMessage(`Logged in as ${res.data.user.fullName}`);
        await refreshBranches();
      } else {
        setMessage(res.message || 'Login failed');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Login error');
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterDevice() {
    const code = branchCode.trim().toUpperCase();
    if (!code) {
      setMessage('Select or enter a branch code first');
      Alert.alert(
        'Branch required',
        'Pick a branch below. If none exist, create one in Register Member first.',
        [
          { text: 'OK' },
          { text: 'Create branch', onPress: () => navigation.navigate('RegisterMember') },
        ],
      );
      return;
    }
    setBusy(true);
    setMessage('Registering device…');
    try {
      await saveSettings({
        apiUrl: apiUrl.trim(),
        branchCode: code,
        deviceName: deviceName.trim(),
      });
      const s = await loadSettings();
      const platform = Device.osName?.toLowerCase().includes('ios') ? 'IOS' : 'ANDROID';
      const res = await registerDevice({
        deviceId: s.deviceId || 'MOB001',
        name: s.deviceName,
        branchCode: s.branchCode,
        platform,
        model: Device.modelName || '',
        osVersion: Device.osVersion || '',
      });
      if (res.success && res.data?.device) {
        const d = res.data.device;
        await saveSettings({
          deviceId: d.deviceId || s.deviceId,
          organizationName: d.branch?.organizationName || s.organizationName,
          branchName: d.branch?.name || s.branchName,
          branchCode: d.branch?.code || s.branchCode,
        });
        setDeviceId(d.deviceId || s.deviceId);
        setMessage(`Device registered: ${d.deviceId}`);
        Alert.alert('Device ready', `${d.deviceId} linked to ${d.branch?.name || 'branch'}`);
      } else {
        setMessage(res.message || 'Registration failed');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Register error');
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
          <Text style={styles.title}>Settings</Text>
        </View>

        <Field label="API URL" value={apiUrl} onChangeText={setApiUrl} />
        <Field
          label="Branch code"
          value={branchCode}
          onChangeText={(t) => setBranchCode(t.toUpperCase())}
          placeholder="e.g. HQ01"
          autoCapitalize="characters"
        />

        {tokenSet ? (
          <View style={styles.branchBox}>
            <View style={styles.branchHeader}>
              <Text style={styles.label}>Your branches</Text>
              <Pressable onPress={() => refreshBranches()}>
                <Text style={styles.refresh}>Refresh</Text>
              </Pressable>
            </View>
            {branches.length === 0 ? (
              <Pressable onPress={() => navigation.navigate('RegisterMember')}>
                <Text style={styles.branchEmpty}>
                  No branches yet. Tap to create one in Register Member.
                </Text>
              </Pressable>
            ) : (
              <View style={styles.branchList}>
                {branches.map((b) => (
                  <Pressable
                    key={b.code}
                    style={[styles.chip, branchCode === b.code && styles.chipActive]}
                    onPress={() => setBranchCode(b.code)}
                  >
                    <Text style={[styles.chipText, branchCode === b.code && styles.chipTextActive]}>
                      {b.code} · {b.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.hint}>Login below to load and pick your branch.</Text>
        )}

        <Field label="Device name" value={deviceName} onChangeText={setDeviceName} />
        <Field label="Admin email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <Field
          label="Admin password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.btn} onPress={onSave} disabled={busy}>
          <Text style={styles.btnText}>Save settings</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onLogin} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
        </Pressable>
        <Pressable style={[styles.btn, styles.secondary]} onPress={onRegisterDevice} disabled={busy}>
          <Text style={[styles.btnText, { color: colors.teal }]}>Register this device</Text>
        </Pressable>

        {!!message && <Text style={styles.message}>{message}</Text>}
        <Text style={styles.meta}>Token: {tokenSet ? 'saved' : 'not set'}</Text>
        <Text style={styles.meta}>Device ID: {deviceId || '—'}</Text>
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
  btn: {
    backgroundColor: colors.tileClock,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.teal },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  message: { marginTop: 14, color: colors.teal, fontWeight: '600' },
  meta: { marginTop: 8, color: colors.textMuted },
  branchBox: { marginBottom: 12 },
  branchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refresh: { color: colors.teal, fontWeight: '700', marginBottom: 6 },
  branchEmpty: {
    color: colors.textMuted,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  branchList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.tileClock, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.white },
  hint: { color: colors.textMuted, marginBottom: 12, fontSize: 13 },
});
