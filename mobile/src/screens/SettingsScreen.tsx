import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, DEFAULT_API_URL } from '../theme';
import { loadSettings, login, registerDevice, saveSettings } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState('admin@presence.local');
  const [password, setPassword] = useState('Admin123!');
  const [branchCode, setBranchCode] = useState('HQ01');
  const [deviceName, setDeviceName] = useState('Presence Phone');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tokenSet, setTokenSet] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  React.useEffect(() => {
    loadSettings().then((s) => {
      setApiUrl(s.apiUrl);
      setBranchCode(s.branchCode);
      setDeviceName(s.deviceName);
      setTokenSet(!!s.token);
      setDeviceId(s.deviceId);
    });
  }, []);

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
    setBusy(true);
    setMessage('Registering device…');
    try {
      await saveSettings({
        apiUrl: apiUrl.trim(),
        branchCode: branchCode.trim().toUpperCase(),
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Settings</Text>
        </View>

        <Field label="API URL" value={apiUrl} onChangeText={setApiUrl} />
        <Field label="Branch code" value={branchCode} onChangeText={setBranchCode} />
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
          <Text style={[styles.btnText, { color: colors.blue }]}>Register this device</Text>
        </Pressable>

        {!!message && <Text style={styles.message}>{message}</Text>}
        <Text style={styles.meta}>Token: {tokenSet ? 'saved' : 'not set'}</Text>
        <Text style={styles.meta}>Device ID: {deviceId || '—'}</Text>
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
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.mist },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  back: { color: colors.blue, fontWeight: '700', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  label: { marginBottom: 6, color: colors.muted, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
  },
  btn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.blue },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  message: { marginTop: 14, color: colors.blue, fontWeight: '600' },
  meta: { marginTop: 8, color: colors.muted },
});
