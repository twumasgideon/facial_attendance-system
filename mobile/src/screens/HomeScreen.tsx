import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Network from 'expo-network';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { AppSettings, loadSettings, saveSettings } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type Action = {
  title: string;
  subtitle: string;
  route?: keyof RootStackParamList;
};

const ACTIONS: Action[] = [
  { title: 'Clock In / Out', subtitle: 'Face camera attendance', route: 'Clock' },
  { title: 'Registered People', subtitle: 'Browse synced employees', route: 'People' },
  { title: 'Face Sync', subtitle: 'Pull users from server', route: 'Sync' },
  { title: 'Settings', subtitle: 'API, login, device', route: 'Settings' },
  { title: 'System Status', subtitle: 'Network and health', route: 'Status' },
];

export default function HomeScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const [network, setNetwork] = useState('…');
  const [battery, setBattery] = useState('…');

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadSettings();
      if (!s.deviceId) {
        const id = `MOB-${(Device.osInternalBuildId || Device.modelId || 'DEVICE')
          .toString()
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(-6)
          .toUpperCase()}`;
        await saveSettings({ deviceId: id });
        s.deviceId = id;
      }
      if (alive) setSettings(s);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(async () => {
      setNow(new Date());
      try {
        const state = await Network.getNetworkStateAsync();
        setNetwork(
          state.isConnected
            ? state.type === Network.NetworkStateType.WIFI
              ? 'Wi-Fi'
              : state.type === Network.NetworkStateType.CELLULAR
                ? 'Cellular'
                : 'Online'
            : 'Offline',
        );
      } catch {
        setNetwork('Unknown');
      }
      try {
        const level = await Battery.getBatteryLevelAsync();
        setBattery(level >= 0 ? `${Math.round(level * 100)}%` : '--');
      } catch {
        setBattery('--');
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const time = useMemo(
    () =>
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [now],
  );
  const date = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [now],
  );

  if (!settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>Presence</Text>
        <Text style={styles.org}>{settings.organizationName}</Text>
        <Text style={styles.branch}>{settings.branchName}</Text>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.date}>{date}</Text>

        <View style={styles.metaRow}>
          <Meta label="Network" value={network} />
          <Meta label="Battery" value={battery} />
          <Meta label="Device" value={settings.deviceId} />
        </View>

        <View style={styles.grid}>
          {ACTIONS.map((action) => (
            <Pressable
              key={action.title}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => action.route && navigation.navigate(action.route)}
            >
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardSub}>{action.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.mist },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mist },
  container: { padding: 20, paddingBottom: 40 },
  brand: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  org: { marginTop: 4, fontSize: 18, fontWeight: '600', color: colors.navy },
  branch: { marginTop: 2, fontSize: 15, color: colors.blue, fontWeight: '600' },
  time: { marginTop: 18, fontSize: 42, fontWeight: '700', color: colors.ink },
  date: { marginTop: 4, fontSize: 16, color: colors.muted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 8 },
  meta: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase' },
  metaValue: { marginTop: 2, fontSize: 13, fontWeight: '700', color: colors.ink },
  grid: { marginTop: 16, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  cardSub: { marginTop: 4, fontSize: 13, color: colors.muted },
});
