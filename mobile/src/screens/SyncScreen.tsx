import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { syncFaces, todayAttendance } from '../api';
import { RootStackParamList } from '../navigation';
import Screen from '../components/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Sync'>;

type AttendanceRow = {
  employeeId?: string;
  fullName?: string;
  stampedTime?: string;
  stampedAt?: string;
  status?: string;
  clockOut?: { stampedTime?: string; stampedAt?: string } | null;
};

export default function SyncScreen({ navigation }: Props) {
  const [busy, setBusy] = useState(false);
  const [loadingToday, setLoadingToday] = useState(true);
  const [message, setMessage] = useState(
    'Pull members and refresh today’s present / late register.',
  );
  const [present, setPresent] = useState<AttendanceRow[]>([]);
  const [late, setLate] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState({ present: 0, late: 0, total: 0 });
  const [scheduleNote, setScheduleNote] = useState(
    'Service 7:30 AM · Late from 9:30 AM · Auto clock-out 2:00 PM (Ghana)',
  );

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const res = await todayAttendance();
      if (res.success && res.data) {
        setPresent((res.data.present as AttendanceRow[]) || []);
        setLate((res.data.late as AttendanceRow[]) || []);
        setSummary(res.data.summary || { present: 0, late: 0, total: 0 });
        if (res.data.schedule) {
          setScheduleNote(
            `Service ${res.data.schedule.serviceStart} · Late from ${res.data.schedule.lateAfter} · Auto out ${res.data.schedule.serviceEnd} (Ghana)`,
          );
        }
      }
    } catch {
      /* ignore — may need login */
    } finally {
      setLoadingToday(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday]),
  );

  async function runSync() {
    setBusy(true);
    setMessage('Syncing…');
    try {
      const res = await syncFaces();
      if (res.success) {
        const count = res.data?.users?.length || 0;
        setMessage(`Synced ${count} users at ${res.data?.syncedAt || 'now'}`);
        await loadToday();
      } else {
        setMessage(res.message || 'Sync failed — login in Settings first');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  function Row({ item, lateFlag }: { item: AttendanceRow; lateFlag?: boolean }) {
    return (
      <View style={styles.row}>
        <View style={[styles.dot, lateFlag ? styles.dotLate : styles.dotPresent]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>{item.fullName}</Text>
          <Text style={styles.rowMeta}>
            {item.employeeId} · In {item.stampedTime || item.stampedAt || '—'}
            {item.clockOut
              ? ` · Out ${item.clockOut.stampedTime || item.clockOut.stampedAt}`
              : ' · Still in'}
          </Text>
        </View>
        <Text style={[styles.tag, lateFlag ? styles.tagLate : styles.tagPresent]}>
          {lateFlag ? 'LATE' : 'PRESENT'}
        </Text>
      </View>
    );
  }

  return (
    <Screen padding={0}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Sync & Today</Text>
        </View>

        <View style={styles.card}>
          <Ionicons name="sync-circle" size={48} color={colors.accent} />
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.schedule}>{scheduleNote}</Text>
          <Pressable style={styles.btn} onPress={runSync} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Update Database</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{summary.present}</Text>
            <Text style={styles.summaryLabel}>Present (on time)</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryLate]}>
            <Text style={styles.summaryNum}>{summary.late}</Text>
            <Text style={styles.summaryLabel}>Late</Text>
          </View>
        </View>

        {loadingToday ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : (
          <>
            <Text style={styles.section}>Present — with stamp time</Text>
            {present.length === 0 ? (
              <Text style={styles.empty}>No on-time clock-ins yet today.</Text>
            ) : (
              present.map((item) => (
                <Row key={`p-${item.employeeId}`} item={item} />
              ))
            )}

            <Text style={styles.section}>Late — with stamp time</Text>
            {late.length === 0 ? (
              <Text style={styles.empty}>No late clock-ins yet today.</Text>
            ) : (
              late.map((item) => (
                <Row key={`l-${item.employeeId}`} item={item} lateFlag />
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.text, fontWeight: '700', fontSize: 16 },
  title: { marginLeft: 8, fontSize: 20, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  body: { fontSize: 15, color: colors.text, lineHeight: 22, textAlign: 'center' },
  schedule: { fontSize: 12, color: colors.accent, textAlign: 'center', fontWeight: '600' },
  btn: {
    marginTop: 8,
    backgroundColor: colors.tileClock,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 180,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.success,
  },
  summaryLate: { borderColor: colors.accentRed },
  summaryNum: { color: colors.white, fontSize: 28, fontWeight: '800' },
  summaryLabel: { color: colors.textMuted, marginTop: 4, fontWeight: '600', fontSize: 12 },
  section: {
    marginTop: 22,
    marginBottom: 10,
    color: colors.accent,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  empty: { color: colors.textMuted, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotPresent: { backgroundColor: colors.success },
  dotLate: { backgroundColor: colors.accentRed },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tag: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.white,
  },
  tagPresent: { backgroundColor: colors.success },
  tagLate: { backgroundColor: colors.accentRed },
});
