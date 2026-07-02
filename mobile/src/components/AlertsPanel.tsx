import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlertItem } from '../types/dashboard';
import { Colors, Spacing, TextStyles, Radius, Shadow } from '../theme';

const ALERT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  low_stock:       { icon: 'cube-outline',            label: 'Low Stock',       color: Colors.warning },
  pending_changes: { icon: 'git-pull-request-outline', label: 'Pending Changes', color: Colors.info    },
  unread:          { icon: 'notifications-outline',    label: 'Unread',          color: Colors.navy    },
};

interface AlertsPanelProps {
  alerts:   AlertItem[];
  onPress?: (type: string) => void;
}

export function AlertsPanel({ alerts, onPress }: AlertsPanelProps) {
  const active = alerts.filter((a) => a.count > 0);
  if (active.length === 0) return null;

  return (
    <View style={styles.container}>
      {active.map((alert) => {
        const cfg = ALERT_CONFIG[alert.type] ?? {
          icon:  'alert-circle-outline',
          label: alert.type,
          color: Colors.warning,
        };
        const content = (
          <View style={[styles.item, { borderLeftColor: cfg.color }]}>
            <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
            <Text style={[styles.label, { color: cfg.color }]}>
              {alert.count} {cfg.label}
            </Text>
            {onPress ? <Ionicons name="chevron-forward" size={14} color={cfg.color} /> : null}
          </View>
        );

        return onPress ? (
          <TouchableOpacity key={alert.type} onPress={() => onPress(alert.type)} activeOpacity={0.8}>
            {content}
          </TouchableOpacity>
        ) : (
          <View key={alert.type}>{content}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  item: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.xs,
    backgroundColor: Colors.card,
    borderRadius:    Radius.sm,
    borderLeftWidth: 3,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  label: {
    ...TextStyles.body,
    fontWeight: '600',
    flex: 1,
  },
});
