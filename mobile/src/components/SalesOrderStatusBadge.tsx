import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '../theme';

const INDIGO = '#4F46E5';
const TEAL   = '#0D9488';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'Pending':             { label: 'Pending',           color: Colors.warning },
  'Confirmed':           { label: 'Confirmed',          color: Colors.navy },
  'In Progress':         { label: 'In Progress',        color: INDIGO },
  'Dispatched':          { label: 'Dispatched',         color: INDIGO },
  'Partially Delivered': { label: 'Partial Delivery',   color: Colors.warning },
  'Fully Delivered':     { label: 'Fully Delivered',    color: Colors.success },
  'Delivered':           { label: 'Delivered',          color: Colors.success },
  'Closed (Short)':      { label: 'Closed Short',       color: TEAL },
  'Cancelled':           { label: 'Cancelled',          color: Colors.error },
};

interface Props { status: string }

export function SalesOrderStatusBadge({ status }: Props) {
  const entry = STATUS_MAP[status] ?? { label: status, color: Colors.textMuted };
  return (
    <View style={[s.badge, { backgroundColor: entry.color + '22', borderColor: entry.color + '55' }]}>
      <Text style={[s.label, { color: entry.color }]}>{entry.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    borderRadius: Radius.sm, borderWidth: 1,
    paddingHorizontal: Spacing.xs, paddingVertical: 2, alignSelf: 'flex-start',
  },
  label: { fontSize: 10, fontWeight: Typography.semibold, letterSpacing: 0.2 },
});
