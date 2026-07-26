import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { APP_NAME, colors, DEFAULT_API_URL } from '../theme';
import { loadSettings, login, saveSettings } from '../api';
import { RootStackParamList } from '../navigation';
import Screen from '../components/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState('admin@presence.local');
  const [password, setPassword] = useState('Admin123!');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tokenSet, setTokenSet] = useState(false);

  React.useEffect(() => {
    loadSettings().then((s) => {
      setApiUrl(s.apiUrl);
      setTokenSet(!!s.token);
    });
  }, []);

  async function onSave() {
    await saveSettings({ apiUrl: apiUrl.trim() });
    setMessage('Settings saved');
  }

  async function onLogin() {
    setBusy(true);
    setMessage('Signing in…');
    try {
      await saveSettings({ apiUrl: apiUrl.trim() });
      const res = await login(email.trim(), password, apiUrl.trim());
      if (res.success && res.data?.token) {
        await saveSettings({
          token: res.data.token,
          organizationName: APP_NAME,
          branchName: 'Kasse Assembly',
          branchCode: 'KASSE',
        });
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

        <Text style={styles.hint}>
          Sign in as admin once. Device and branch are handled automatically for Kasse Assembly.
        </Text>

        <Field label="API URL" value={apiUrl} onChangeText={setApiUrl} />
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

        {!!message && <Text style={styles.message}>{message}</Text>}
        <Text style={styles.meta}>Status: {tokenSet ? 'Logged in' : 'Not logged in'}</Text>
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
  hint: { color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
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
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  message: { marginTop: 14, color: colors.teal, fontWeight: '600' },
  meta: { marginTop: 8, color: colors.textMuted },
});
