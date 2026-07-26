import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { AppSettings, listEmployees, loadSettings, saveSettings } from '../api';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [battery, setBattery] = useState('--');
  const [faceCount, setFaceCount] = useState(0);

  const refresh = useCallback(async () => {
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
    setSettings(s);
    if (s.token) {
      try {
        const res = await listEmployees();
        if (res.success) setFaceCount(res.data?.users?.length || 0);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const tick = setInterval(async () => {
      setNow(new Date());
      try {
        const state = await Network.getNetworkStateAsync();
        setOnline(!!state.isConnected);
      } catch {
        setOnline(false);
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
    () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [now],
  );
  const date = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
    [now],
  );

  if (!settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  const tiles = [
    {
      key: 'clock',
      title: 'Clock In/Out',
      subtitle: 'Facial Scanner',
      color: colors.tileClock,
      icon: <MaterialCommunityIcons name="face-recognition" size={36} color={colors.white} />,
      onPress: () => navigation.navigate('Clock'),
    },
    {
      key: 'register',
      title: 'Register Member',
      subtitle: 'Add face & profile',
      color: '#2563EB',
      icon: <Ionicons name="person-add" size={36} color={colors.white} />,
      onPress: () => navigation.navigate('RegisterMember'),
    },
    {
      key: 'people',
      title: 'View People',
      subtitle: `${faceCount} synced faces`,
      color: colors.tilePeople,
      icon: <Ionicons name="people" size={36} color={colors.white} />,
      onPress: () => navigation.navigate('People'),
    },
    {
      key: 'sync',
      title: 'Sync Faces',
      subtitle: 'Update Database',
      color: colors.tileSync,
      icon: <Ionicons name="sync" size={36} color={colors.white} />,
      onPress: () => navigation.navigate('Sync'),
    },
    {
      key: 'settings',
      title: 'Settings',
      subtitle: 'Configuration',
      color: colors.tileSettings,
      icon: <Ionicons name="settings" size={36} color={colors.white} />,
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.org}>
              {settings.organizationName
                ? settings.organizationName.toUpperCase()
                : 'PRESENCE'}
            </Text>
            <Text style={styles.branch}>
              {settings.branchName
                ? settings.branchName.toUpperCase()
                : 'Register device in Settings'}
            </Text>
          </View>
          <Pressable
            style={styles.powerBtn}
            onPress={() => BackHandler.exitApp()}
            accessibilityLabel="Power"
          >
            <Ionicons name="power" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{time}</Text>
          <Text style={styles.statusDot}>·</Text>
          <Text style={styles.statusText}>{date}</Text>
          <View style={styles.statusIcons}>
            <Pressable onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
            </Pressable>
            <Ionicons
              name={online ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={16}
              color={online ? colors.teal : colors.danger}
            />
            <Text style={styles.battery}>{battery}</Text>
          </View>
        </View>

        <View style={styles.banner}>
          <View style={styles.logoMark}>
            <Text style={styles.logoP}>P</Text>
          </View>
          <View>
            <Text style={styles.logoTitle}>Presence</Text>
            <Text style={styles.logoTag}>ALWAYS THERE...</Text>
          </View>
        </View>

        <View style={[styles.grid, isWide && styles.gridWide]}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.key}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: tile.color },
                isWide && styles.tileWide,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={tile.onPress}
            >
              {tile.icon}
              <Text style={styles.tileTitle}>{tile.title}</Text>
              <Text style={styles.tileSub}>{tile.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  org: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  branch: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  powerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  statusText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  statusDot: { color: colors.textMuted },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  battery: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  banner: {
    marginTop: 18,
    backgroundColor: colors.banner,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logoMark: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoP: { color: colors.tileClock, fontSize: 28, fontWeight: '900' },
  logoTitle: { color: colors.white, fontSize: 28, fontWeight: '800' },
  logoTag: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  grid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    flex: 1,
  },
  gridWide: { alignContent: 'flex-start' },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 150,
    borderRadius: 22,
    padding: 18,
    justifyContent: 'space-between',
  },
  tileWide: { width: '22%', minWidth: 160, minHeight: 180 },
  tileTitle: { color: colors.white, fontSize: 20, fontWeight: '800', marginTop: 18 },
  tileSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 4 },
});
