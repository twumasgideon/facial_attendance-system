import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Extra gap below the status-bar clock so content never sits under the time. */
export const SCREEN_TOP_GAP = 16;

type Props = ViewProps & {
  children: React.ReactNode;
  /** Horizontal/bottom padding. Default 16. Pass 0 when the screen manages its own padding. */
  padding?: number;
  /** Extra space under the status bar beyond the safe inset. */
  topGap?: number;
};

/**
 * Shared page shell: clears the system status bar / clock, then adds a consistent gap
 * before headers and content on every screen.
 */
export default function Screen({
  children,
  style,
  padding = 16,
  topGap = SCREEN_TOP_GAP,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + topGap,
          paddingBottom: Math.max(insets.bottom, padding),
          paddingHorizontal: padding,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
