import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { StatusBadge }  from '../../components/StatusBadge';
import { ReasonModal }  from '../../components/ReasonModal';
import { usePayrollPeriodDetail, usePayrollPeriodApprove, usePayrollExportExcel } from '../../hooks/usePayroll';
import { useAuth } from '../../hooks/useAuth';
import { PayrollLine } from '../../types/api';
import { CasualLabourStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = CasualLabourStackScreenProps<'PayrollPeriodDetail'>;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

function LineRow({ line, onPress }: { line: PayrollLine; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.lineRow} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineName}>{line.person_name}</Text>
        <Text style={styles.lineMeta}>{line.rate_type_snapshot.replace('_', ' ')} @ {Number(line.rate_amount_snapshot).toLocaleString()} · qty {line.source_qty}</Text>
      </View>
      <Text style={styles.lineNet}>{Number(line.net_amount).toLocaleString()}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// The role assigned to the current pending approval stage is the ONLY thing
// that authorizes an approve/reject/return action server-side
// (procurement_approval_steps.assigned_role, checked by
// procurementApprovalAction) — this screen only decides whether to SHOW the
// buttons; the backend is the actual authority, same "show it, let the
// backend enforce it" pattern desktop's own Payroll page uses.
export function PayrollPeriodDetailScreen({ navigation, route }: Props) {
  const { periodId } = route.params;
  const { role } = useAuth();
  const { data, isLoading, isError, refetch } = usePayrollPeriodDetail(periodId);
  const { decide } = usePayrollPeriodApprove();
  const [showReject, setShowReject] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [deciding, setDeciding]     = useState(false);
  const [exporting, setExporting]   = useState(false);
  const { exportExcel } = usePayrollExportExcel();

  if (isLoading) return <LoadingState message="Loading payroll period…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load this payroll period" onRetry={refetch} fullScreen />;

  const { period, lines, approvalSteps } = data;
  const pendingStage = approvalSteps.find((s) => s.status === 'pending');
  const canAct = !!pendingStage && (role === pendingStage.assigned_role || role === 'admin');
  const totalNet = lines.reduce((s, l) => s + Number(l.net_amount), 0);

  async function handleExport() {
    setExporting(true);
    try {
      await exportExcel('lines', { period_id: periodId });
    } finally {
      setExporting(false);
    }
  }

  async function handleApprove() {
    setDeciding(true);
    try {
      const r = await decide(periodId, 'approved');
      if (!r.ok) { Alert.alert('Error', r.error ?? 'Could not approve.'); return; }
      Alert.alert('Success', r.nextStage ? `Approved — moved to ${r.nextStage} stage.` : 'Payroll period fully approved.');
    } finally {
      setDeciding(false);
    }
  }

  async function submitReject(notes: string) {
    setDeciding(true);
    try {
      const r = await decide(periodId, 'rejected', notes);
      setShowReject(false);
      if (!r.ok) { Alert.alert('Error', r.error ?? 'Could not reject.'); return; }
      Alert.alert('Rejected', 'This payroll period was rejected.');
    } finally {
      setDeciding(false);
    }
  }

  async function submitReturn(notes: string) {
    if (!notes.trim()) return;
    setDeciding(true);
    try {
      const r = await decide(periodId, 'returned_for_revision', notes);
      setShowReturn(false);
      if (!r.ok) { Alert.alert('Error', r.error ?? 'Could not return for correction.'); return; }
      Alert.alert('Returned', 'This payroll period was returned for correction.');
    } finally {
      setDeciding(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Payroll Period"
        dark
        onBack={() => navigation.goBack()}
        actions={[{
          icon: exporting ? 'hourglass-outline' : 'share-outline',
          label: 'Export Excel',
          onPress: exporting ? () => {} : handleExport,
        }]}
      />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Text style={styles.dateText}>{period.start_date} → {period.end_date}</Text>
          <StatusBadge status={period.status} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Overview</Text>
          <Row label="Workshop" value={period.workshop_name || 'Company-wide'} />
          <Row label="Lines" value={lines.length} />
          <Row label="Total Net" value={totalNet.toLocaleString()} />
          <Row label="Created By" value={period.created_by_name} />
          <Row label="Notes" value={period.notes} />
        </View>

        {approvalSteps.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Approval Timeline</Text>
            {approvalSteps.map((s, idx) => (
              <View key={idx} style={styles.stageRow}>
                <Text style={styles.stageKey}>{s.stage_key.replace(/_/g, ' ')} ({s.assigned_role})</Text>
                <StatusBadge status={s.status === 'pending' ? 'pending_approval' : s.status} size="sm" />
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lines ({lines.length})</Text>
          {lines.length === 0 ? (
            <Text style={styles.emptyText}>No lines calculated yet.</Text>
          ) : (
            lines.map((l) => (
              <LineRow key={l.id} line={l} onPress={() => navigation.navigate('PayrollLineDetail', { lineId: l.id })} />
            ))
          )}
        </View>

        {canAct && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={handleApprove} disabled={deciding}>
              <Ionicons name="checkmark" size={16} color={Colors.white} />
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => setShowReject(true)} disabled={deciding}>
              <Ionicons name="close" size={16} color={Colors.error} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.returnBtn]} onPress={() => setShowReturn(true)} disabled={deciding}>
              <Ionicons name="arrow-undo" size={16} color={Colors.textSecondary} />
              <Text style={styles.returnBtnText}>Return</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ReasonModal
        visible={showReject}
        title="Reject Payroll Period"
        message="Notes are optional."
        confirmLabel="Reject"
        allowEmpty
        loading={deciding}
        onCancel={() => setShowReject(false)}
        onConfirm={submitReject}
      />
      <ReasonModal
        visible={showReturn}
        title="Return for Correction"
        message="A reason is required."
        confirmLabel="Return"
        loading={deciding}
        onCancel={() => setShowReturn(false)}
        onConfirm={submitReturn}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  header: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm,
  },
  dateText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel:  { fontSize: Typography.sm, color: Colors.textSecondary },
  rowValue:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },

  stageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  stageKey: { fontSize: Typography.sm, color: Colors.textPrimary, textTransform: 'capitalize' },

  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  lineName: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  lineMeta: { fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  lineNet:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },

  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: Radius.lg, paddingVertical: Spacing.base,
  },
  approveBtn: { backgroundColor: Colors.success },
  approveBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.sm },
  rejectBtn: { backgroundColor: Colors.errorBg },
  rejectBtnText: { color: Colors.error, fontWeight: Typography.semibold, fontSize: Typography.sm },
  returnBtn: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  returnBtnText: { color: Colors.textSecondary, fontWeight: Typography.semibold, fontSize: Typography.sm },
});
