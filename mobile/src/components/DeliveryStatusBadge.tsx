import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors } from '../theme';

const INDIGO = '#4F46E5';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'Pending':      { label: 'Pending',      color: Colors.textMuted },
  'Assigned':     { label: 'Assigned',     color: Colors.info },
  'In Transit':   { label: 'In Transit',   color: INDIGO },
  'POD Recorded': { label: 'POD Recorded', color: Colors.success },
  'Failed':       { label: 'Failed',       color: Colors.error },
};

interface Props { status: string }

export function DeliveryStatusBadge({ status }: Props) {
  const { label, color } = STATUS_MAP[status] ?? { label: status, color: Colors.textMuted };
  return (
    <Text style={[s.badge, { color, backgroundColor: color + '22' }]}>{label}</Text>
  );
}

const s = StyleSheet.create({
  badge: {
    fontSize: 11, fontWeight: '600',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 100, alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});
