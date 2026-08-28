import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { EP } from '../api/endpoints';
import type { LogisticsHistoryResponse } from '../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

interface Props {
  // Master Professionalization Phase C1 — 'sales' added; Sales Orders had
  // real captured audit rows all along but no permission entry ever let a
  // Sales user read them back (data.js's logisticsRecordHistory permission
  // map) and thus no viewing surface anywhere. Same generic component, no
  // second history implementation.
  module:   'deliveries' | 'dispatch' | 'transport' | 'transport-jobs' | 'logistics' | 'sales';
  recordId: number | string;
}

// Phase 2 — generic per-record audit history, mobile equivalent of the
// desktop detail overlay's history section. Reused across every Logistics
// detail screen that has a stable record id.
export function LogisticsHistoryCard({ module, recordId }: Props) {
  const { data, isLoading, isError } = useQuery<LogisticsHistoryResponse>({
    queryKey: ['logistics-history', module, recordId],
    queryFn:  () => get<LogisticsHistoryResponse>(EP.LOGISTICS_HISTORY(module, recordId)),
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];

  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>History</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.navy} />
      ) : isError ? (
        <Text style={s.emptyText}>Could not load history.</Text>
      ) : rows.length === 0 ? (
        <Text style={s.emptyText}>No history recorded yet.</Text>
      ) : (
        rows.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={s.action} numberOfLines={2}>{r.action}</Text>
            <Text style={s.meta}>{r.full_name || r.username || 'System'} · {new Date(r.created_at).toLocaleString()}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  emptyText:    { fontSize: Typography.sm, color: Colors.textMuted },
  row:          { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  action:       { fontSize: Typography.sm, color: Colors.textPrimary },
  meta:         { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
