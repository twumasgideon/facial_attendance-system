import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { syncFaces } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sync'>;

export default function SyncScreen({ navigation }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Pull employees, departments, and branches from the server.');

  async function runSync() {
    setBusy(true);
    setMessage('Syncing…');
    try {
      const res = await syncFaces();
      if (res.success) {
        const count = res.data?.users?.length || 0;
        setMessage(`Synced ${count} users at ${res.data?.syncedAt || 'now'}`);
      } else {
        setMessage(res.message || 'Sync failed — login in Settings first');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Face Sync</Text>
      </View>
      <Text style={styles.body}>{message}</Text>
      <Pressable style={styles.btn} onPress={runSync} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sync now</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.mist, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  back: { color: colors.blue, fontWeight: '700', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22, marginBottom: 20 },
  btn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
