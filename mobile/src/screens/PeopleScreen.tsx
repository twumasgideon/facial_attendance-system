import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
  photoUrl?: string;
};

export default function PeopleScreen({ navigation }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (search = q) => {
    setLoading(true);
    setError('');
    try {
      const res = await listEmployees(search);
      if (res.success) setPeople((res.data?.users as Person[]) || []);
      else setError(res.message || 'Failed to load people');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      load('');
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>View People</Text>
        <Pressable style={styles.addBtn} onPress={() => navigation.navigate('RegisterMember')}>
          <Ionicons name="person-add" size={18} color={colors.white} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search name or ID"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => load(q)}
        />
        <Pressable style={styles.searchBtn} onPress={() => load(q)}>
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item, idx) => item.employeeId || String(idx)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.fullName || '?').slice(0, 1)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.meta}>
                  {item.employeeId} · {item.position || 'Staff'}
                </Text>
                <Text style={styles.meta}>
                  Face: {item.faceStatus || '—'} · {item.employmentStatus || '—'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No employees found</Text>
              <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('RegisterMember')}>
                <Text style={styles.emptyBtnText}>Register first member</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tileSync,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addText: { color: colors.white, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  searchBtn: {
    backgroundColor: colors.tilePeople,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  searchText: { color: colors.white, fontWeight: '700' },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tilePeople,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.inputBg },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { marginTop: 3, color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, marginTop: 16 },
  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 12 },
  empty: { textAlign: 'center', color: colors.textMuted },
  emptyBtn: {
    backgroundColor: colors.tileSync,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyBtnText: { color: colors.white, fontWeight: '700' },
});
