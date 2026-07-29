import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../theme';

export type PieSlice = {
  key: string;
  label: string;
  value: number;
  percent?: number;
  color: string;
};

type Props = {
  slices: PieSlice[];
  size?: number;
  title?: string;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${e.x} ${e.y} A ${r} ${r} 0 ${large} 1 ${s.x} ${s.y} Z`;
}

export default function PieChart({ slices, size = 200, title }: Props) {
  const total = useMemo(
    () => slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0),
    [slices],
  );

  const paths = useMemo(() => {
    if (total <= 0) return [];
    let angle = 0;
    return slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const sweep = (s.value / total) * 360;
        const start = angle;
        const end = angle + sweep;
        angle = end;
        return {
          ...s,
          d: sweep >= 359.9
            ? undefined
            : arcPath(size / 2, size / 2, size / 2 - 4, start, end),
          full: sweep >= 359.9,
        };
      });
  }, [slices, total, size]);

  return (
    <View style={styles.wrap}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.row}>
        <Svg width={size} height={size}>
          {total <= 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill={colors.panel} />
          ) : (
            <G>
              {paths.map((p) =>
                p.full ? (
                  <Circle
                    key={p.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={size / 2 - 4}
                    fill={p.color}
                  />
                ) : (
                  <Path key={p.key} d={p.d} fill={p.color} />
                ),
              )}
              <Circle cx={size / 2} cy={size / 2} r={size * 0.28} fill={colors.bg} />
            </G>
          )}
        </Svg>
        <View style={styles.legend}>
          {slices.map((s) => {
            const pct = s.percent ?? (total ? Math.round((s.value / total) * 1000) / 10 : 0);
            return (
              <View key={s.key} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: s.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendLabel}>{s.label}</Text>
                  <Text style={styles.legendValue}>
                    {s.value} · {pct}%
                  </Text>
                </View>
              </View>
            );
          })}
          {total <= 0 && <Text style={styles.empty}>No service data in this range yet.</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  legend: { flex: 1, minWidth: 160, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  legendLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  legendValue: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, fontSize: 13 },
});
