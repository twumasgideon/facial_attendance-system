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
import { attendanceAnalytics } from '../api';
import { RootStackParamList } from '../navigation';
import Screen from '../components/Screen';
import PieChart from '../components/PieChart';

type Props = NativeStackScreenProps<RootStackParamList, 'Analytics'>;

type MemberRow = {
  fullName?: string;
  phone?: string;
  town?: string;
  onTime?: number;
  late?: number;
  absent?: number;
  punctualRate?: number;
  attendanceRate?: number;
  servicesExpected?: number;
};

export default function AnalyticsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [servicesCounted, setServicesCounted] = useState(0);
  const [pie, setPie] = useState<
    Array<{ key: string; label: string; value: number; percent: number; color: string }>
  >([]);
  const [mostPunctual, setMostPunctual] = useState<MemberRow[]>([]);
  const [oftenLate, setOftenLate] = useState<MemberRow[]>([]);
  const [oftenAbsent, setOftenAbsent] = useState<MemberRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceAnalytics();
      if (res.success && res.data) {
        setRange(res.data.range);
        setServicesCounted(res.data.servicesCounted || 0);
        setPie(res.data.pie || []);
        setMostPunctual((res.data.mostPunctual as MemberRow[]) || []);
        setOftenLate((res.data.oftenLate as MemberRow[]) || []);
        setOftenAbsent((res.data.oftenAbsent as MemberRow[]) || []);
        setMessage(
          `Analysis across ${res.data.servicesCounted || 0} saved service day(s) · ${res.data.range.from} → ${res.data.range.to}`,
        );
      } else {
        setMessage(res.message || 'Could not load analytics — login in Settings');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function MemberList({ title, rows, tone }: { title: string; rows: MemberRow[]; tone: string }) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: tone }]}>{title}</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No data yet.</Text>
        ) : (
          rows.slice(0, 8).map((m, i) => (
            <View key={`${title}-${m.fullName}-${i}`} style={styles.memberRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.fullName}</Text>
                <Text style={styles.memberMeta}>
                  On time {m.onTime || 0} · Late {m.late || 0} · Absent {m.absent || 0}
                  {m.town ? ` · ${m.town}` : ''}
                </Text>
                {!!m.phone && <Text style={styles.phone}>{m.phone}</Text>}
              </View>
              <Text style={[styles.rate, { color: tone }]}>{m.punctualRate ?? 0}%</Text>
            </View>
          ))
        )}
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
          <Text style={styles.title}>Punctuality Analysis</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.body}>
            See who is punctual to church vs late or absent — same data from Android and desktop.
          </Text>
          {!!message && <Text style={styles.meta}>{message}</Text>}
          <Pressable style={styles.btn} onPress={load} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Refresh analysis</Text>
            )}
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.chartCard}>
              <PieChart
                title="Church attendance pattern"
                slices={pie}
                size={180}
              />
              <Text style={styles.footnote}>
                Based on {servicesCounted} service date(s)
                {range.from ? ` (${range.from} → ${range.to})` : ''}. Punctual = clock-in before
                9:30 AM Ghana time.
              </Text>
            </View>

            <MemberList title="Most punctual" rows={mostPunctual} tone={colors.success} />
            <MemberList title="Often late" rows={oftenLate} tone={colors.accentRed} />
            <MemberList title="Often absent" rows={oftenAbsent} tone={colors.textMuted} />
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
    padding: 20,
    gap: 10,
    alignItems: 'center',
  },
  body: { color: colors.text, textAlign: 'center', lineHeight: 22 },
  meta: { color: colors.accent, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  btn: {
    marginTop: 6,
    backgroundColor: colors.tileSync,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 160,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontWeight: '800' },
  chartCard: {
    marginTop: 16,
    backgroundColor: colors.panel,
    borderRadius: 22,
    padding: 20,
  },
  footnote: {
    marginTop: 14,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  section: { marginTop: 20 },
  sectionTitle: { fontWeight: '800', fontSize: 14, marginBottom: 10, letterSpacing: 0.3 },
  empty: { color: colors.textMuted },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  memberName: { color: colors.text, fontWeight: '700' },
  memberMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  phone: { color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '700' },
  rate: { fontWeight: '800', fontSize: 16 },
});
