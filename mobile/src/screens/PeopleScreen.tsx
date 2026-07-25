import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { listEmployees } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'People'>;

type Person = {
  employeeId?: string;
  fullName?: string;
  position?: string;
  faceStatus?: string;
  employmentStatus?: string;
};

export default function PeopleScreen({ navigation }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState('');

  async function load(search = q) {
    setLoading(true);
    setError('');
    try {
      const res = await listEmployees(search);
      if (res.success) {
        setPeople((res.data?.users as Person[]) || []);
      } else {
        setError(res.message || 'Failed to load people');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Registered People</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search name or ID"
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => load(q)}
        />
        <Pressable style={styles.searchBtn} onPress={() => load(q)}>
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item, idx) => item.employeeId || String(idx)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.meta}>
                {item.employeeId} · {item.position || 'Staff'}
              </Text>
              <Text style={styles.meta}>
                Face: {item.faceStatus || '—'} · {item.employmentStatus || '—'}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No employees found</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.mist, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  back: { color: colors.blue, fontWeight: '700', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  searchBtn: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  searchText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { marginTop: 4, color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, marginTop: 16 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
});
