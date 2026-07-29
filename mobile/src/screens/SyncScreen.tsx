import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { syncFaces, todayAttendance } from '../api';
import { RootStackParamList } from '../navigation';
import Screen from '../components/Screen';
import { alertPrintError, printHtml } from '../utils/printHtml';

type Props = NativeStackScreenProps<RootStackParamList, 'Sync'>;

type AttendanceRow = {
  employeeId?: string;
  memberId?: string;
  fullName?: string;
  phone?: string;
  town?: string;
  stampedTime?: string;
  stampedAt?: string;
  status?: string;
  clockOut?: { stampedTime?: string; stampedAt?: string } | null;
};

const LIVE_POLL_MS = 5000;

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSessionReportHtml(opts: {
  dateKey: string;
  assembly: string;
  scheduleNote: string;
  summary: {
    present: number;
    late: number;
    absent: number;
    attended: number;
    totalRegistered: number;
  };
  present: AttendanceRow[];
  late: AttendanceRow[];
  absent: AttendanceRow[];
  serviceEnded: boolean;
}) {
  const rows = (list: AttendanceRow[], kind: string) =>
    list.length === 0
      ? `<tr><td colspan="4" style="color:#666;padding:8px;">None</td></tr>`
      : list
          .map(
            (item, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(item.fullName || '—')}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(item.town || '—')}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(item.phone || 'Not registered')}</td>
        ${
          kind === 'absent'
            ? ''
            : `<td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(
                item.stampedTime || item.stampedAt || '—',
              )}</td>`
        }
      </tr>`,
          )
          .join('');

  const presentCols = `
    <tr style="background:#0B2E8C;color:#fff;">
      <th style="text-align:left;padding:8px;">#</th>
      <th style="text-align:left;padding:8px;">Name</th>
      <th style="text-align:left;padding:8px;">Town</th>
      <th style="text-align:left;padding:8px;">Phone</th>
      <th style="text-align:left;padding:8px;">Clock-in</th>
    </tr>`;

  const absentCols = `
    <tr style="background:#444;color:#fff;">
      <th style="text-align:left;padding:8px;">#</th>
      <th style="text-align:left;padding:8px;">Name</th>
      <th style="text-align:left;padding:8px;">Town</th>
      <th style="text-align:left;padding:8px;">Phone</th>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Session Report — ${escapeHtml(opts.dateKey)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; color: #0B2E8C; }
    h2 { margin: 28px 0 10px; font-size: 16px; }
    .meta { color: #444; font-size: 13px; margin-bottom: 4px; }
    .summary { display: flex; gap: 12px; margin: 18px 0 8px; }
    .box { border: 1px solid #ccc; border-radius: 8px; padding: 10px 14px; min-width: 90px; }
    .box b { display: block; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Church Session Report</h1>
  <div class="meta"><strong>${escapeHtml(opts.assembly)}</strong></div>
  <div class="meta">Date (Ghana): ${escapeHtml(opts.dateKey)}</div>
  <div class="meta">${escapeHtml(opts.scheduleNote)}</div>
  <div class="meta">${opts.serviceEnded ? 'Status: Service ended · Auto clock-out done' : 'Status: Service in progress'}</div>

  <div class="summary">
    <div class="box"><b>${opts.summary.totalRegistered}</b>Registered</div>
    <div class="box"><b>${opts.summary.attended}</b>Present</div>
    <div class="box"><b>${opts.summary.present}</b>On time</div>
    <div class="box"><b>${opts.summary.late}</b>Late</div>
    <div class="box"><b>${opts.summary.absent}</b>Absent</div>
  </div>

  <h2>Present (on time) — ${opts.present.length}</h2>
  <table>${presentCols}${rows(opts.present, 'present')}</table>

  <h2>Late — ${opts.late.length}</h2>
  <table>${presentCols}${rows(opts.late, 'late')}</table>

  <h2>Absent (with phone) — ${opts.absent.length}</h2>
  <table>${absentCols}${rows(opts.absent, 'absent')}</table>

  <p style="margin-top:28px;font-size:11px;color:#666;">
    Printed from Kasse Church of Pentecost attendance · ${new Date().toLocaleString()}
  </p>
</body>
</html>`;
}

export default function SyncScreen({ navigation }: Props) {
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingToday, setLoadingToday] = useState(true);
  const [live, setLive] = useState(true);
  const [sessionCleared, setSessionCleared] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [dateQuery, setDateQuery] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [message, setMessage] = useState('Today’s live service register.');
  const [present, setPresent] = useState<AttendanceRow[]>([]);
  const [late, setLate] = useState<AttendanceRow[]>([]);
  const [absent, setAbsent] = useState<AttendanceRow[]>([]);
  const [dateKey, setDateKey] = useState('');
  const [assembly, setAssembly] = useState('Church of Pentecost Kasse Assembly Kumasi');
  const [serviceEnded, setServiceEnded] = useState(false);
  const [summary, setSummary] = useState({
    present: 0,
    late: 0,
    absent: 0,
    attended: 0,
    totalRegistered: 0,
  });
  const [scheduleNote, setScheduleNote] = useState(
    'Service 7:30 AM · Late from 9:30 AM · Auto clock-out 2:00 PM (Ghana)',
  );

  const applyReport = useCallback((data: NonNullable<Awaited<ReturnType<typeof todayAttendance>>['data']>) => {
    setPresent((data.present as AttendanceRow[]) || []);
    setLate((data.late as AttendanceRow[]) || []);
    setAbsent((data.absent as AttendanceRow[]) || []);
    setDateKey(data.dateKey || '');
    setLive(!!data.live);
    setSessionCleared(!!data.sessionCleared);
    setServiceEnded(!!data.serviceEnded);
    setSummary({
      present: data.summary?.present || 0,
      late: data.summary?.late || 0,
      absent: data.summary?.absent || 0,
      attended: data.summary?.attended || 0,
      totalRegistered: data.summary?.totalRegistered || 0,
    });
    if (data.schedule) {
      if (data.schedule.assembly) setAssembly(data.schedule.assembly);
      setScheduleNote(
        `Service ${data.schedule.serviceStart} · Late from ${data.schedule.lateAfter} · Auto out ${data.schedule.serviceEnd} (Ghana)`,
      );
    }
    setLastSyncAt(new Date().toLocaleTimeString());
    if (data.sessionCleared) {
      setMessage('Service ended. Live board cleared — search a date to view saved records.');
    } else if (data.live) {
      setMessage('Today (live) service register.');
    } else {
      setMessage(`Saved session for ${data.dateKey}.`);
    }
  }, []);

  const loadReport = useCallback(
    async (date?: string, silent = false) => {
      if (!silent) setLoadingToday(true);
      try {
        const res = await todayAttendance(date);
        if (res.success && res.data) applyReport(res.data);
        else if (!silent) setMessage(res.message || 'Could not load report');
      } catch {
        /* ignore — may need login */
      } finally {
        if (!silent) setLoadingToday(false);
      }
    },
    [applyReport],
  );

  useFocusEffect(
    useCallback(() => {
      loadReport(selectedDate);
      const timer = setInterval(() => {
        if (!selectedDate) loadReport(undefined, true);
      }, LIVE_POLL_MS);
      return () => clearInterval(timer);
    }, [loadReport, selectedDate]),
  );

  async function runSync() {
    setBusy(true);
    try {
      const res = await syncFaces();
      if (res.success) {
        await loadReport(selectedDate);
      } else {
        setMessage(res.message || 'Refresh failed — login in Settings first');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  function goLiveToday() {
    setDateQuery('');
    setSelectedDate(undefined);
    loadReport(undefined);
  }

  function searchByDate() {
    const raw = dateQuery.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      Alert.alert('Invalid date', 'Enter a date like 2026-07-29 (YYYY-MM-DD).');
      return;
    }
    setSelectedDate(raw);
    loadReport(raw);
  }

  async function printSession() {
    if (loadingToday) return;
    setPrinting(true);
    try {
      const html = buildSessionReportHtml({
        dateKey: dateKey || new Date().toISOString().slice(0, 10),
        assembly,
        scheduleNote,
        summary,
        present,
        late,
        absent,
        serviceEnded,
      });
      await printHtml(html, {
        dialogTitle: 'Print session report',
        onWebPrinted: () => setMessage('Print dialog opened'),
      });
      if (Platform.OS !== 'web') setMessage('Session report ready to print or share');
    } catch (e) {
      alertPrintError(e);
    } finally {
      setPrinting(false);
    }
  }

  function Row({
    item,
    kind,
  }: {
    item: AttendanceRow;
    kind: 'present' | 'late' | 'absent';
  }) {
    return (
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            kind === 'present' && styles.dotPresent,
            kind === 'late' && styles.dotLate,
            kind === 'absent' && styles.dotAbsent,
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>{item.fullName}</Text>
          <Text style={styles.rowMeta}>
            {kind !== 'absent'
              ? `In ${item.stampedTime || item.stampedAt || '—'}`
              : 'Did not clock in'}
            {item.clockOut
              ? ` · Out ${item.clockOut.stampedTime || item.clockOut.stampedAt}`
              : kind !== 'absent'
                ? ' · Still in'
                : ''}
          </Text>
          <Text style={styles.phone}>Phone: {item.phone || 'Not registered'}</Text>
          {!!item.town && <Text style={styles.town}>Town: {item.town}</Text>}
        </View>
        <Text
          style={[
            styles.tag,
            kind === 'present' && styles.tagPresent,
            kind === 'late' && styles.tagLate,
            kind === 'absent' && styles.tagAbsent,
          ]}
        >
          {kind === 'present' ? 'PRESENT' : kind === 'late' ? 'LATE' : 'ABSENT'}
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
          <Text style={styles.title}>Session Report</Text>
        </View>

        <View style={styles.card}>
          <Ionicons name="document-text" size={48} color={colors.accent} />
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.schedule}>{scheduleNote}</Text>
          {!!dateKey && <Text style={styles.dateKey}>Date: {dateKey} (Ghana)</Text>}
          {live && !sessionCleared && !selectedDate && (
            <Text style={styles.liveBanner}>
              Today (live) · last update {lastSyncAt || '—'}
            </Text>
          )}
          {sessionCleared && !selectedDate && (
            <Text style={styles.closedBanner}>Service ended · live board cleared for next service</Text>
          )}
          {serviceEnded && !!selectedDate && (
            <Text style={styles.closedBanner}>Saved session (service day closed)</Text>
          )}
          <View style={styles.btnRow}>
            <Pressable style={styles.btn} onPress={runSync} disabled={busy || printing}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Refresh</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.btn, styles.printBtn]}
              onPress={printSession}
              disabled={busy || printing || loadingToday || sessionCleared}
            >
              {printing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="print" size={18} color={colors.white} />
                  <Text style={styles.btnText}>Print session</Text>
                </>
              )}
            </Pressable>
          </View>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('Analytics')}>
            <Ionicons name="pie-chart" size={18} color={colors.accent} />
            <Text style={styles.linkText}>Punctuality analysis (pie chart)</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Find a service date</Text>
        <View style={styles.searchRow}>
          <Pressable
            style={[styles.todayBtn, !selectedDate && styles.todayBtnActive]}
            onPress={goLiveToday}
          >
            <Text style={[styles.todayBtnText, !selectedDate && styles.todayBtnTextActive]}>
              Today (live)
            </Text>
          </Pressable>
          <TextInput
            style={styles.dateInput}
            value={dateQuery}
            onChangeText={setDateQuery}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            onSubmitEditing={searchByDate}
          />
          <Pressable style={styles.searchBtn} onPress={searchByDate}>
            <Ionicons name="search" size={18} color={colors.white} />
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>
        <Text style={styles.searchHint}>
          Search past services by date (example 2026-07-26). Live board only shows today.
        </Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryRegistered]}>
            <Text style={styles.summaryNum}>{summary.totalRegistered}</Text>
            <Text style={styles.summaryLabel}>Registered</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{summary.attended}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryLate]}>
            <Text style={styles.summaryNum}>{summary.late}</Text>
            <Text style={styles.summaryLabel}>Late</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryAbsent]}>
            <Text style={styles.summaryNum}>{summary.absent}</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </View>
        </View>

        {loadingToday ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : sessionCleared && !selectedDate ? (
          <Text style={styles.empty}>
            Waiting for the next service. Search a past date to view saved present, late, and absent
            lists.
          </Text>
        ) : (
          <>
            <Text style={styles.section}>Present (on time) — name + phone</Text>
            {present.length === 0 ? (
              <Text style={styles.empty}>No on-time clock-ins for this session.</Text>
            ) : (
              present.map((item, idx) => (
                <Row key={`p-${item.employeeId || idx}`} item={item} kind="present" />
              ))
            )}

            <Text style={styles.section}>Late — name + phone</Text>
            {late.length === 0 ? (
              <Text style={styles.empty}>No late clock-ins for this session.</Text>
            ) : (
              late.map((item, idx) => (
                <Row key={`l-${item.employeeId || idx}`} item={item} kind="late" />
              ))
            )}

            <Text style={styles.section}>Absent — name + phone</Text>
            {absent.length === 0 ? (
              <Text style={styles.empty}>Everyone registered has clocked in for this session.</Text>
            ) : (
              absent.map((item, idx) => (
                <Row
                  key={`a-${item.memberId || item.employeeId || idx}`}
                  item={item}
                  kind="absent"
                />
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
  dateKey: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  liveBanner: {
    color: colors.bg,
    backgroundColor: colors.success,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: '800',
    fontSize: 12,
  },
  closedBanner: {
    color: colors.white,
    backgroundColor: colors.accentRed,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: '800',
    fontSize: 12,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  btn: {
    backgroundColor: colors.tileClock,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  printBtn: { backgroundColor: colors.tileSync },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 8,
  },
  linkText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  todayBtn: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayBtnActive: { backgroundColor: colors.tileSync, borderColor: colors.tileSync },
  todayBtnText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  todayBtnTextActive: { color: colors.white },
  dateInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tilePeople,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  searchHint: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.success,
  },
  summaryRegistered: { borderColor: colors.accent },
  summaryLate: { borderColor: colors.accentRed },
  summaryAbsent: { borderColor: colors.textMuted },
  summaryNum: { color: colors.white, fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: colors.textMuted, marginTop: 4, fontWeight: '600', fontSize: 10 },
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
  dotAbsent: { backgroundColor: colors.textMuted },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  phone: { color: colors.accent, fontSize: 12, marginTop: 4, fontWeight: '700' },
  town: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.white,
  },
  tagPresent: { backgroundColor: colors.success },
  tagLate: { backgroundColor: colors.accentRed },
  tagAbsent: { backgroundColor: colors.tileSettings },
});
