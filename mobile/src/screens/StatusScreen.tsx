import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, DEFAULT_API_URL } from '../theme';
import { loadSettings } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Status'>;

export default function StatusScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [health, setHealth] = useState('Checking…');

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setApiUrl(s.apiUrl);
      try {
        const base = s.apiUrl.replace(/\/api\/v1\/?$/, '');
        const res = await fetch(`${base}/health`);
        const json = await res.json();
        setHealth(json?.data?.status === 'ok' ? 'API healthy' : JSON.stringify(json));
      } catch (e) {
        setHealth(e instanceof Error ? e.message : 'Unreachable');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>System Status</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>API URL</Text>
        <Text style={styles.value}>{apiUrl}</Text>
        <Text style={[styles.label, { marginTop: 14 }]}>Health</Text>
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Text style={styles.value}>{health}</Text>
        )}
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
    borderRadius: 16,
    padding: 16,
  },
  label: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', fontWeight: '700' },
  value: { marginTop: 6, color: colors.text, fontSize: 15, fontWeight: '600' },
});
