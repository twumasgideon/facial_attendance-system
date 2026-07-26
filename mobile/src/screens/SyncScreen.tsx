import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { syncFaces } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sync'>;

export default function SyncScreen({ navigation }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'Pull employees, departments, and branches from the server.',
  );

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
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Sync Faces</Text>
      </View>
      <View style={styles.card}>
        <Ionicons name="sync-circle" size={48} color={colors.tileSync} />
        <Text style={styles.body}>{message}</Text>
        <Pressable style={styles.btn} onPress={runSync} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Update Database</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, fontSize: 20, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  body: { fontSize: 15, color: colors.text, lineHeight: 22, textAlign: 'center' },
  btn: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: colors.tileSync,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
