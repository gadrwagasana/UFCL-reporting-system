import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { StatusBadge }  from '../../components/StatusBadge';
import { usePayrollLineDetail } from '../../hooks/usePayroll';
import { CasualLabourStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = CasualLabourStackScreenProps<'PayrollLineDetail'>;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

// Mobile's read-only view of "every amount traceable" (Priority 10 —
// Calculation Inspection) and adjustment history — creating a new
// adjustment remains desktop-only (see PayrollStack comment in
// navigation/types.ts), matching the same admin-vs-review split already
// drawn for rate setting and period calculation.
export function PayrollLineDetailScreen({ navigation, route }: Props) {
  const { lineId } = route.params;
  const { data, isLoading, isError, refetch } = usePayrollLineDetail(lineId);

  if (isLoading) return <LoadingState message="Loading payroll line…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load this payroll line" onRetry={refetch} fullScreen />;

  const { line, adjustments } = data;
  const attRows = line.source_summary?.attendance ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={line.person_name} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calculation</Text>
          <Row label="Rate" value={`${line.rate_type_snapshot.replace('_', ' ')} @ ${Number(line.rate_amount_snapshot).toLocaleString()}`} />
          <Row label="Quantity" value={line.source_qty} />
          <Row label="Gross" value={Number(line.gross_amount).toLocaleString()} />
          <Row label="Adjustments" value={Number(line.adjustments_total).toLocaleString()} />
          <Row label="Net" value={Number(line.net_amount).toLocaleString()} />
          {line.source_summary?.note && (
            <Text style={styles.note}>{line.source_summary.note}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Source (Attendance)</Text>
          {attRows.length === 0 ? (
            <Text style={styles.emptyText}>No attendance records — quantity was entered manually.</Text>
          ) : (
            attRows.map((a, idx) => (
              <View key={idx} style={styles.attRow}>
                <Text style={styles.attDate}>{a.date}</Text>
                <Text style={styles.attStatus}>{a.status}</Text>
                <Text style={styles.attHours}>{a.hours != null ? `${a.hours}h` : '—'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Adjustments ({adjustments.length})</Text>
          {adjustments.length === 0 ? (
            <Text style={styles.emptyText}>No adjustments recorded.</Text>
          ) : (
            adjustments.map((a) => (
              <View key={a.id} style={styles.adjRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adjCategory}>{a.category}</Text>
                  <Text style={styles.adjReason}>{a.reason}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.adjAmount, { color: Number(a.amount) < 0 ? Colors.error : Colors.success }]}>
                    {Number(a.amount).toLocaleString()}
                  </Text>
                  <StatusBadge status={a.status === 'pending' ? 'pending_approval' : a.status} size="sm" />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel:  { fontSize: Typography.sm, color: Colors.textSecondary },
  rowValue:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  note:      { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },

  attRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  attDate:   { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  attStatus: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },
  attHours:  { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },

  adjRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  adjCategory: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, textTransform: 'capitalize' },
  adjReason:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  adjAmount:   { fontSize: Typography.sm, fontWeight: Typography.semibold },
});
