import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, TextStyles, Typography, Radius, Shadow } from '../theme';
import { TrendBadge } from './TrendBadge';
import { Trend } from '../types/dashboard';

export interface KpiCardProps {
  title:     string;
  value:     string | number;
  icon?:     string;
  color?:    string;
  subtitle?: string;
  trend?:    Trend;
  badge?:    number;
  onPress?:  () => void;
  loading?:  boolean;
  // Enterprise UI/UX Standardization Phase 1, Workstream B — 'tile' is the
  // compact grid tile several dashboards (Mechanician, Procurement) already
  // hand-roll as local MiniKpi/statTileAlt components; added here so those
  // screens can adopt the shared component instead of re-inventing it,
  // without forcing them into the full-width 'row' layout below (a real
  // layout, not just a style, so it can't be a style prop on 'row').
  variant?:  'row' | 'tile';
  // 'sm' matches the Mechanician dashboard's original MiniKpi (radius md,
  // base font); 'md' matches the Procurement dashboard's original
  // statTileAlt (radius lg, larger font) — kept as a size option rather than
  // silently picking one, since forcing either dashboard onto the other's
  // proportions would be a visible, unrequested size change.
  tileSize?: 'sm' | 'md';
  warn?:       boolean;
  danger?:     boolean;
  style?:      StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
}

export function KpiCard({
  title, value, icon, color, subtitle, trend, badge, onPress, loading,
  variant = 'row', tileSize = 'sm', warn, danger, style, valueStyle,
}: KpiCardProps) {
  if (variant === 'tile') {
    const md = tileSize === 'md';
    const tileBody = (
      <>
        {loading ? (
          <ActivityIndicator size="small" color={color || Colors.textMuted} />
        ) : (
          <Text style={[styles.tileValue, md && styles.tileValueMd, warn && styles.tileValueWarn, danger && styles.tileValueDanger, valueStyle]}>{value}</Text>
        )}
        <Text style={styles.tileLabel}>{title}</Text>
      </>
    );
    const tileStyle = [styles.tile, md && styles.tileMd, style];
    const tileA11yLabel = `${title}: ${value}`;
    return onPress ? (
      <TouchableOpacity style={tileStyle} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={tileA11yLabel}>{tileBody}</TouchableOpacity>
    ) : (
      <View style={tileStyle} accessible accessibilityLabel={tileA11yLabel}>{tileBody}</View>
    );
  }

  const rowColor = color || Colors.navy;
  const content = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: rowColor + '22' }]}>
        <Ionicons name={(icon || 'stats-chart-outline') as any} size={24} color={rowColor} />
      </View>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={rowColor} style={styles.spinner} />
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

  const rowA11yLabel = `${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`;
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: rowColor }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={rowA11yLabel}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, { borderLeftColor: rowColor }]} accessible accessibilityLabel={rowA11yLabel}>{content}</View>;
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

  // 'tile' variant — matches the MiniKpi/statTileAlt markup this replaces.
  tile: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm,
    minWidth: '30%', flexGrow: 1, alignItems: 'center', ...Shadow.sm,
  },
  tileMd: { borderRadius: Radius.lg, flex: 1, minWidth: undefined },
  tileValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  tileValueMd: { fontSize: Typography.lg },
  tileValueWarn: { color: Colors.warning },
  tileValueDanger: { color: Colors.error },
  tileLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
});
