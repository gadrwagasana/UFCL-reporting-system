import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Spacing, Radius } from '../theme';

interface Props {
  rows?: number;
}

// Static placeholder rows — this app has no shimmer/skeleton pattern anywhere
// yet, so this stays deliberately simple (no new animation dependency).
export function SearchSkeleton({ rows = 6 }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.iconWrap} />
          <View style={styles.content}>
            <View style={[styles.bar, styles.barWide]} />
            <View style={[styles.bar, styles.barMedium]} />
            <View style={[styles.bar, styles.barNarrow]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderLight,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  bar: {
    height: 10,
    borderRadius: Radius.xs,
    backgroundColor: Colors.borderLight,
  },
  barWide:   { width: '70%' },
  barMedium: { width: '50%' },
  barNarrow: { width: '35%' },
});
