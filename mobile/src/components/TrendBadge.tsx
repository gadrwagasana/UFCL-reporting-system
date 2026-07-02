import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrendDirection, TrendDirectionValue } from '../constants/dashboardEnums';
import { Colors, TextStyles } from '../theme';

interface TrendBadgeProps {
  percent:  number;
  direction: TrendDirectionValue;
  // goodDir: the direction that is considered a positive outcome for this metric.
  // 'up' (default) = increase is good (e.g. production). 'down' = decrease is good (e.g. downtime).
  goodDir?: 'up' | 'down';
}

export function TrendBadge({ percent, direction, goodDir = 'up' }: TrendBadgeProps) {
  if (direction === TrendDirection.UNCHANGED) {
    return (
      <View style={[styles.badge, styles.neutral]}>
        <Ionicons name="remove" size={12} color={Colors.textMuted} />
        <Text style={[styles.text, styles.neutralText]}>—</Text>
      </View>
    );
  }

  const isPositive = direction === goodDir;
  const iconName   = direction === TrendDirection.UP ? 'trending-up' : 'trending-down';
  const color      = isPositive ? Colors.success : Colors.error;
  const bg         = isPositive ? Colors.successBg : Colors.errorBg;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Ionicons name={iconName} size={12} color={color} />
      <Text style={[styles.text, { color }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    gap:             3,
  },
  neutral: {
    backgroundColor: Colors.borderLight,
  },
  text: {
    ...TextStyles.caption,
    fontWeight: '600',
    fontSize:   11,
  },
  neutralText: {
    color: Colors.textMuted,
  },
});
