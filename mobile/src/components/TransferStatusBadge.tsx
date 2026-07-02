import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '../theme';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:            { label: 'Pending',           color: Colors.warning },
  approved:           { label: 'Approved',          color: Colors.success },
  in_transit:         { label: 'In Transit',        color: Colors.statusInTransitText },
  partially_received: { label: 'Partial',           color: Colors.warning },
  completed:          { label: 'Completed',         color: Colors.success },
  rejected:           { label: 'Rejected',          color: Colors.error },
  cancelled:          { label: 'Cancelled',         color: Colors.error },
};

interface Props {
  status: string;
}

export function TransferStatusBadge({ status }: Props) {
  const entry = STATUS_MAP[status] ?? { label: status, color: Colors.textMuted };
  return (
    <View style={[s.badge, { backgroundColor: entry.color + '22', borderColor: entry.color }]}>
      <Text style={[s.text, { color: entry.color }]}>{entry.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs, paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: Typography.semibold },
});
