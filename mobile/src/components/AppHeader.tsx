import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Layout } from '../theme';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface Action {
  icon:    IoniconName;
  onPress: () => void;
  badge?:  number;
}

interface Props {
  title:      string;
  subtitle?:  string;
  onBack?:    () => void;
  actions?:   Action[];
  dark?:      boolean;
}

export function AppHeader({ title, subtitle, onBack, actions = [], dark = true }: Props) {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === 'android' ? insets.top + Spacing.sm : insets.top;
  const fgColor  = dark ? Colors.textOnDark : Colors.textPrimary;
  const bg       = dark ? Colors.navy : Colors.white;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: topPad }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={Layout.iconSize.lg} color={fgColor} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}

        <View style={styles.center}>
          <Text style={[styles.title, { color: fgColor }]} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: dark ? Colors.textOnDarkMuted : Colors.textMuted }]}
              numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          {actions.map((a, i) => (
            <TouchableOpacity key={i} style={styles.actionBtn} onPress={a.onPress} activeOpacity={0.7}>
              <Ionicons name={a.icon} size={Layout.iconSize.lg} color={fgColor} />
              {a.badge != null && a.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{a.badge > 99 ? '99+' : a.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  row: {
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  subtitle: {
    fontSize: Typography.xs,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    width: 40,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.orange,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: Typography.bold,
  },
});
