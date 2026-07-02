import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PendingItem } from '../types/dashboard';
import { Priority } from '../constants/dashboardEnums';
import { Colors, Spacing, TextStyles, Radius, Shadow } from '../theme';

const PRIORITY_COLOR: Record<string, string> = {
  [Priority.HIGH]:   Colors.error,
  [Priority.MEDIUM]: Colors.warning,
  [Priority.LOW]:    Colors.textMuted,
};

const PRIORITY_ICON: Record<string, string> = {
  [Priority.HIGH]:   'alert-circle',
  [Priority.MEDIUM]: 'time-outline',
  [Priority.LOW]:    'ellipse-outline',
};

interface PendingActionItemProps {
  item:    PendingItem;
  onPress: (item: PendingItem) => void;
}

export function PendingActionItem({ item, onPress }: PendingActionItemProps) {
  const color = PRIORITY_COLOR[item.priority] ?? Colors.textMuted;
  const icon  = PRIORITY_ICON[item.priority]  ?? 'ellipse-outline';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
        <View style={styles.meta}>
          <Ionicons name={icon as any} size={12} color={color} />
          <Text style={[styles.priority, { color }]}>
            {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} priority
          </Text>
          {item.created_at ? (
            <Text style={styles.time}>{item.created_at}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom:    Spacing.xs,
    gap:             Spacing.sm,
    ...Shadow.sm,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    flexShrink:   0,
  },
  content: {
    flex: 1,
  },
  title: {
    ...TextStyles.bodyMedium,
    color: Colors.textPrimary,
  },
  body: {
    ...TextStyles.caption,
    color:     Colors.textMuted,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
  },
  priority: {
    ...TextStyles.caption,
    fontWeight: '600',
    flex:       1,
  },
  time: {
    ...TextStyles.caption,
    color: Colors.textMuted,
  },
});
