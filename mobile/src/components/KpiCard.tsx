import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, TextStyles, Typography, Radius, Shadow } from '../theme';
import { TrendBadge } from './TrendBadge';
import { Trend } from '../types/dashboard';

export interface KpiCardProps {
  title:     string;
  value:     string;
  icon:      string;
  color:     string;
  subtitle?: string;
  trend?:    Trend;
  badge?:    number;
  onPress?:  () => void;
  loading?:  boolean;
}

export function KpiCard({ title, value, icon, color, subtitle, trend, badge, onPress, loading }: KpiCardProps) {
  const content = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={color} style={styles.spinner} />
        ) : (
          <Text style={styles.value}>{value}</Text>
        )}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trend ? (
        <TrendBadge percent={trend.percent} direction={trend.direction} />
      ) : null}
      {badge != null && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.chevron} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: color }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, { borderLeftColor: color }]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius:    Radius.md,
    borderLeftWidth: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom:    Spacing.sm,
    ...Shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  iconWrap: {
    width:         44,
    height:        44,
    borderRadius:  Radius.sm,
    alignItems:    'center',
    justifyContent:'center',
    marginRight:   Spacing.sm,
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize:   Typography.xl,
    fontWeight: Typography.bold,
    color:      Colors.textPrimary,
  },
  title: {
    ...TextStyles.caption,
    color:     Colors.textMuted,
    marginTop: 2,
  },
  subtitle: {
    ...TextStyles.caption,
    color:      Colors.textMuted,
    fontStyle:  'italic',
  },
  spinner: {
    alignSelf: 'flex-start',
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius:    10,
    minWidth:        20,
    height:          20,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
    marginLeft:      Spacing.xs,
  },
  badgeText: {
    color:      Colors.white,
    fontSize:   11,
    fontWeight: Typography.bold,
  },
  chevron: {
    marginLeft: Spacing.xs,
  },
});
