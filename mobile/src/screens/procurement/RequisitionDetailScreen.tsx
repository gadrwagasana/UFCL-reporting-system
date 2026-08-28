import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { ApprovalTimeline } from '../../components/ApprovalTimeline';
import { useProcurementRequisitionDetail, useProcurementRequisitionActions } from '../../hooks/useProcurementRequisitions';
import { useAuth } from '../../hooks/useAuth';
import { ProcurementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'RequisitionDetail'>;
type RouteType = RouteProp<ProcurementStackParamList, 'RequisitionDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function RequisitionDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { role } = useAuth();
  const { data, isLoading, isError, refetch } = useProcurementRequisitionDetail(params.requisitionId);
  const { submit, cancel, decide } = useProcurementRequisitionActions();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <LoadingState message="Loading requisition…" fullScreen />;
  if (isError) return <ErrorState message="Could not load requisition" onRetry={refetch} fullScreen />;

  const { requisition, items, steps, revisions } = data;
  const currentStep = steps.find((s) => s.status === 'pending');
  const canAct = !!currentStep && (currentStep.assigned_role === role || role === 'admin');
  const canEdit = ['draft', 'returned_for_revision'].includes(requisition.status);
  const canSubmit = ['draft', 'returned_for_revision'].includes(requisition.status);
  const canCancel = ['draft', 'submitted', 'in_approval', 'returned_for_revision'].includes(requisition.status);
  const canCreateRfq = requisition.status === 'approved';

  async function onSubmit() {
    setBusy(true);
    try { await submit(requisition.id); refetch(); }
    catch (e: any) { Alert.alert('Could not submit', e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  }

  function onCancel() {
    Alert.alert('Cancel requisition?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Requisition', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try { await cancel(requisition.id); refetch(); }
          catch (e: any) { Alert.alert('Could not cancel', e?.message ?? 'Please try again.'); }
          finally { setBusy(false); }
        },
      },
    ]);
  }

  async function onDecide(decision: 'approved' | 'rejected' | 'returned_for_revision') {
    if (decision === 'returned_for_revision' && !notes.trim()) {
      Alert.alert('Reason required', 'Enter a reason before returning this requisition for revision.');
      return;
    }
    setBusy(true);
    try {
      await decide(requisition.id, decision, notes.trim() || undefined);
      setNotes('');
      refetch();
    }
    catch (e: any) { Alert.alert('Could not record decision', e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  }

  function onEdit() {
    navigation.navigate('RequisitionForm', { requisition, items });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title={requisition.requisition_number ?? `Requisition #${requisition.id}`}
        dark
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.title}>{requisition.title}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {requisition.revision_number > 0 ? (
                <View style={styles.revisionBadge}><Text style={styles.revisionBadgeText}>Rev {requisition.revision_number}</Text></View>
              ) : null}
              <StatusBadge status={requisition.status} withIcon />
            </View>
          </View>
          {requisition.description ? <Text style={styles.description}>{requisition.description}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <View style={styles.divider} />
          <Row label="Requester" value={requisition.requester_name ?? '—'} />
          <View style={styles.rowDivider} />
          <Row label="Department" value={requisition.department ?? '—'} />
          <View style={styles.rowDivider} />
          <Row label="Priority" value={requisition.priority.toUpperCase()} />
          <View style={styles.rowDivider} />
          <Row label="Estimated Total" value={Number(requisition.total_estimated_amount).toLocaleString()} />
          {requisition.budget_code ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Budget Code" value={requisition.budget_code} />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Line Items ({items.length})</Text>
          <View style={styles.divider} />
          {items.map((it, i) => (
            <View key={it.id} style={[styles.itemRow, i > 0 && styles.rowDivider]}>
              <Text style={styles.itemDesc}>{it.description}</Text>
              <Text style={styles.itemMeta}>
                {it.quantity} {it.unit ?? ''} × {Number(it.estimated_unit_price).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {steps.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Approval Timeline</Text>
            <View style={styles.divider} />
            <ApprovalTimeline steps={steps} />
          </View>
        ) : null}

        {canAct ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Decision — {currentStep!.assigned_role}</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (required for Return for Revision)"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <View style={styles.decisionRow}>
              <Button label="Reject" icon="close" variant="outline" color={Colors.error} disabled={busy} onPress={() => onDecide('rejected')} style={{ flex: 1 }} />
              <Button label="Approve" icon="checkmark" color={Colors.success} disabled={busy} onPress={() => onDecide('approved')} style={{ flex: 1 }} />
            </View>
            <Button label="Return for Revision" icon="arrow-undo" variant="outline" color={Colors.warning} disabled={busy} onPress={() => onDecide('returned_for_revision')} fullWidth style={{ marginTop: Spacing.sm }} />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revision Timeline</Text>
          <View style={styles.divider} />
          {revisions.length === 0 ? (
            <Text style={styles.itemMeta}>Never returned for revision.</Text>
          ) : revisions.map((rv) => (
            <View key={rv.id} style={[styles.itemRow, styles.rowDivider]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.itemDesc}>Revision {rv.revision_number}</Text>
                {rv.resubmitted_at ? <StatusBadge status="approved" withIcon /> : <StatusBadge status="pending" withIcon />}
              </View>
              <Text style={styles.itemMeta}>Returned by {rv.returned_by_name ?? '—'} on {new Date(rv.returned_at).toLocaleString()}</Text>
              <Text style={[styles.itemMeta, { color: Colors.textPrimary, marginTop: 2 }]}>Reviewer comments: {rv.reviewer_notes}</Text>
              {rv.resubmitted_at ? (
                <Text style={styles.itemMeta}>Resubmitted by {rv.resubmitted_by_name ?? '—'} on {new Date(rv.resubmitted_at).toLocaleString()}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {canCreateRfq ? (
          <Button label="Create RFQ" color={Colors.navy} disabled={busy} onPress={() => navigation.navigate('RfqCreate', { requisitionId: requisition.id })} fullWidth />
        ) : null}
        {canEdit ? (
          <Button label="Edit" variant="outline" color={Colors.navy} disabled={busy} onPress={onEdit} fullWidth />
        ) : null}
        {canSubmit ? (
          <Button label={requisition.status === 'returned_for_revision' ? 'Resubmit for Approval' : 'Submit for Approval'} color={Colors.navy} disabled={busy} onPress={onSubmit} fullWidth />
        ) : null}
        {canCancel ? (
          <Button label="Cancel Requisition" variant="outline" color={Colors.error} disabled={busy} onPress={onCancel} fullWidth />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { height: 1, backgroundColor: Colors.divider },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, flex: 1 },
  description: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, gap: Spacing.base },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  itemRow: { paddingVertical: Spacing.sm, gap: 2 },
  itemDesc: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  itemMeta: { fontSize: Typography.xs, color: Colors.textMuted },
  notesInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary, minHeight: 60, textAlignVertical: 'top', marginBottom: Spacing.sm },
  decisionRow: { flexDirection: 'row', gap: Spacing.sm },
  revisionBadge: { backgroundColor: Colors.warning + '20', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  revisionBadgeText: { fontSize: 10, fontWeight: Typography.semibold, color: Colors.warning },
});
