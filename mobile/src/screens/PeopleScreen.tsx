import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
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
import Screen from '../components/Screen';
import { alertPrintError, printHtml } from '../utils/printHtml';

type Props = NativeStackScreenProps<RootStackParamList, 'People'>;

type Person = {
  employeeId?: string;
  fullName?: string;
  position?: string;
  faceStatus?: string;
  employmentStatus?: string;
  photoUrl?: string;
  phone?: string;
  town?: string;
};

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMembersPrintHtml(people: Person[]) {
  const rows = people
    .map(
      (p, i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${i + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(p.fullName || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(p.town || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(p.phone || 'Not registered')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(p.position || 'Member')}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Church Members</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 22px; color: #0B2E8C; }
    .meta { color: #444; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px; background: #0B2E8C; color: #fff; }
  </style>
</head>
<body>
  <h1>Church Members Directory</h1>
  <div class="meta">Church of Pentecost Kasse Assembly Kumasi · ${people.length} member(s)</div>
  <table>
    <tr>
      <th>#</th>
      <th>Name</th>
      <th>Town / Location</th>
      <th>Phone</th>
      <th>Position</th>
    </tr>
    ${rows || '<tr><td colspan="5" style="padding:8px;">No members</td></tr>'}
  </table>
  <p style="margin-top:24px;font-size:11px;color:#666;">Printed ${new Date().toLocaleString()}</p>
</body>
</html>`;
}

export default function PeopleScreen({ navigation }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
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

  async function printMembers() {
    if (!people.length) {
      Alert.alert('No members', 'There are no members to print.');
      return;
    }
    setPrinting(true);
    try {
      await printHtml(buildMembersPrintHtml(people), { dialogTitle: 'Print members' });
    } catch (e) {
      alertPrintError(e);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Church Members</Text>
        <Pressable
          style={[styles.printBtn, printing && styles.disabled]}
          onPress={printMembers}
          disabled={printing || loading}
        >
          {printing ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="print" size={16} color={colors.white} />
              <Text style={styles.addText}>Print</Text>
            </>
          )}
        </Pressable>
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
          placeholder="Search name, town, or phone"
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
            <Pressable
              style={styles.card}
              onPress={() => {
                if (item.employeeId) {
                  navigation.navigate('MemberProfile', { employeeId: item.employeeId });
                }
              }}
            >
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.fullName || '?').slice(0, 1)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.meta}>{item.position || 'Member'}</Text>
                {!!item.town && <Text style={styles.meta}>Town: {item.town}</Text>}
                {!!item.phone && <Text style={styles.phone}>Phone: {item.phone}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No members found</Text>
              <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('RegisterMember')}>
                <Text style={styles.emptyBtnText}>Register first member</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 4, flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tilePeople,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
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
  disabled: { opacity: 0.6 },
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
  phone: { marginTop: 3, color: colors.accent, fontSize: 13, fontWeight: '700' },
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
