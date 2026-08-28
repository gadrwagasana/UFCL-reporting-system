import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }   from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ReasonModal }  from '../../components/ReasonModal';
import { useVatList, useVatInspect, useVatReport, useVatReconciliation } from '../../hooks/useVat';
import { useRejectionHoldsList, useRejectionHoldActions, useResolutionCreate } from '../../hooks/useTimberLifecycle';
import { VapBatch, VapBatchOutputLine, RejectionHoldRow, ResolutionDestination } from '../../types/api';
import { VatEntriesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<VatEntriesStackParamList, 'VatProcessingList'>;

// Nyanza Value-Added Production Completion Phase — Inspect is now per output
// line rather than per raw VAT entry (a batch can have multiple output
// lines), matching the same precedent Sawmill's Quality Inspection already
// established.
//
// ERP UI/UX Completion Phase 8 (audit finding H-13 pattern) — Alert.prompt
// is iOS-only; this now lives as state inside VatProcessingScreen (below)
// so it can render the cross-platform ReasonModal replacement.

function OutputRow({ output, onInspect }: { output: VapBatchOutputLine; onInspect: () => void }) {
  return (
    <View style={styles.outputRow}>
      <Text style={styles.outputLabel}>{output.type}{output.sub_type ? ` ${output.sub_type}` : ''} {output.size} × {output.quantity}</Text>
      {output.status === 'inspected' ? (
        <View style={styles.inspectedBadge}>
          <Text style={styles.inspectedText}>
            Inspected — {output.inspection_approved_qty ?? 0} ok / {output.inspection_rejected_qty ?? 0} rej
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.inspectBtn} onPress={onInspect}>
          <Text style={styles.inspectBtnText}>Inspect</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BatchCard({
  item, onPress, onInspectOutput,
}: { item: VapBatch; onPress: () => void; onInspectOutput: (output: VapBatchOutputLine) => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.typeText}>{item.production_type || 'Production Batch'}</Text>
        <Text style={styles.dateText}>{item.date_fmt ?? '—'}</Text>
      </View>
      {item.customer_name ? <Text style={styles.customerText}>{item.customer_name}</Text> : null}
      {item.outputs.map(o => (
        <OutputRow key={o.id} output={o} onInspect={() => onInspectOutput(o)} />
      ))}
    </TouchableOpacity>
  );
}

const REJECTION_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', rework: 'In Rework', downgraded: 'Downgraded', returned: 'Returned', resolved: 'Resolved',
};
const REJECTED_DESTINATIONS: ResolutionDestination[] = ['Firewood', 'Scrap Sale', 'Disposal'];

function VatRejectionHoldsCard({ onChanged }: { onChanged: () => void }) {
  const { data } = useRejectionHoldsList(undefined, 'value_added');
  const { rework, returnToInventory } = useRejectionHoldActions();
  const { resolve } = useResolutionCreate();
  const rows = data?.rows ?? [];

  // ERP UI/UX Completion Phase 8 (audit finding H-13 pattern) — Alert.prompt
  // is iOS-only; state for the cross-platform ReasonModal replacement.
  const [returnTarget, setReturnTarget] = useState<RejectionHoldRow | null>(null);
  const [returning, setReturning] = useState(false);

  if (!rows.length) return null;

  function handleRework(hold: RejectionHoldRow) {
    Alert.alert('Send to Rework', `Re-enter ${hold.quantity} unit(s) for reprocessing?`, [
      { text: 'Rework', onPress: async () => { try { await rework(hold.id); onChanged(); } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed.'); } } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  function handleReturn(hold: RejectionHoldRow) {
    setReturnTarget(hold);
  }
  async function submitReturn(reason: string) {
    if (!returnTarget || !reason.trim()) return;
    setReturning(true);
    try {
      await returnToInventory(returnTarget.id, reason.trim());
      setReturnTarget(null);
      onChanged();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to return to inventory.');
    } finally {
      setReturning(false);
    }
  }
  function handleResolve(hold: RejectionHoldRow) {
    Alert.alert('Resolve To', `Choose a destination for ${hold.quantity} unit(s).`, [
      ...REJECTED_DESTINATIONS.map(dest => ({
        text: dest,
        onPress: async () => {
          if (dest !== 'Disposal') { Alert.alert('Use Desktop', 'This destination needs a warehouse — please use the desktop app.'); return; }
          try { await resolve({ source_type: 'rejected_timber', source_id: hold.id, destination: dest, volume: hold.quantity }); onChanged(); }
          catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to resolve.'); }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.rhCard}>
      <Text style={styles.rhTitle}>Rejection holds</Text>
      {rows.map(h => (
        <View key={h.id} style={styles.rhRow}>
          <View style={{ flex: 1 }}>
            {/* Nyanza Value-Added Production Completion Phase — output_product_id
                is chosen directly at output-line creation, so product_type
                always resolves for VAT-origin holds now (no more "vat_type"
                no-catalog-match fallback needed). */}
            <Text style={styles.rhLabel}>{h.product_type ?? 'Unknown'} {h.product_size ?? ''}</Text>
            <Text style={styles.rhMeta}>{h.quantity} units · {REJECTION_STATUS_LABEL[h.status] ?? h.status}</Text>
          </View>
          {h.status === 'pending' ? (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity style={styles.rhBtn} onPress={() => handleRework(h)}><Text style={styles.rhBtnText}>Rework</Text></TouchableOpacity>
              <TouchableOpacity style={styles.rhBtn} onPress={() => handleReturn(h)}><Text style={styles.rhBtnText}>Return</Text></TouchableOpacity>
              <TouchableOpacity style={styles.rhBtn} onPress={() => handleResolve(h)}><Text style={styles.rhBtnText}>Resolve</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rhBadgeMuted}><Text style={styles.rhBadgeMutedText}>{REJECTION_STATUS_LABEL[h.status] ?? h.status}</Text></View>
          )}
        </View>
      ))}

      <ReasonModal
        visible={!!returnTarget}
        title="Return to Inventory"
        message={returnTarget ? `Enter a reason for returning ${returnTarget.quantity} unit(s) back to stock as-is:` : ''}
        confirmLabel="Return"
        loading={returning}
        onCancel={() => setReturnTarget(null)}
        onConfirm={submitReturn}
      />
    </View>
  );
}

// ERP Enterprise Completion Phase 9 (Workstream 1) — a fresh backend-to-UI
// audit found this hook (useVatReconciliation) and its backend function
// fully built since the Nyanza Value-Added Production phase, but never
// actually rendered anywhere on either platform. Wired in now.
function VapReconciliationCard() {
  const { data } = useVatReconciliation();
  if (!data || !data.rows.length) return null;
  return (
    <View style={styles.rhCard}>
      <Text style={styles.rhTitle}>Production reconciliation</Text>
      <Text style={[styles.rhMeta, data.unreconciledCount > 0 ? { color: Colors.error } : { color: Colors.success }]}>
        {data.unreconciledCount > 0 ? `${data.unreconciledCount} batch(es) unreconciled` : 'All comparable batches reconciled'}
      </Text>
      {data.rows.map(r => (
        <View key={r.batchId} style={styles.reportRow}>
          <Text style={styles.rhLabel}>{r.batchDate} — in {r.inputQty} / out {r.outputQty}</Text>
          <Text style={styles.reportValue}>
            {!r.unitsComparable ? 'Not comparable' : (r.reconciled ? 'Reconciled' : 'Different units')}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Input Consumption / Output Production — deliberately separate from the
// Rejection Holds card above (which already generically covers Nyanza's own
// rejection/rework/downgrade figures via the shared quality_inspections/
// rejection_holds tables). Shown inline here rather than through the
// cross-department Reports menu, matching SawmillDashboardScreen's own
// QualityReportCard precedent for a workshop-specific report.
function VapReportCard() {
  const { data } = useVatReport();
  if (!data) return null;
  return (
    <View style={styles.rhCard}>
      <Text style={styles.rhTitle}>Input consumption / output production</Text>
      <Text style={styles.rhMeta}>{data.batchCount} production batch(es)</Text>
      {data.inputConsumption.length > 0 && (
        <>
          <Text style={styles.reportSubTitle}>Input consumed</Text>
          {data.inputConsumption.map(i => (
            <View key={i.stockItemId} style={styles.reportRow}>
              <Text style={styles.rhLabel}>{i.name}</Text>
              <Text style={styles.reportValue}>{i.totalConsumed.toLocaleString()}</Text>
            </View>
          ))}
        </>
      )}
      {data.outputProduction.length > 0 && (
        <>
          <Text style={styles.reportSubTitle}>Output produced</Text>
          {data.outputProduction.map(o => (
            <View key={o.productId} style={styles.reportRow}>
              <Text style={styles.rhLabel}>{o.type}{o.subType ? ` ${o.subType}` : ''} {o.size}</Text>
              <Text style={styles.reportValue}>{o.totalProduced.toLocaleString()} ({o.totalAccepted.toLocaleString()} accepted)</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

export function VatProcessingScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useVatList();
  const { inspect } = useVatInspect();

  const rows = data?.rows ?? [];

  // ERP UI/UX Completion Phase 8 (audit finding H-13 pattern) — Alert.prompt
  // is iOS-only; state for the cross-platform ReasonModal replacement. The
  // approved-quantity capture reuses ReasonModal's extraContent slot (same
  // pattern as ShowroomScreen/Sawmill's Quality Inspection); a second-stage
  // modal collects the rejection reason only when rejected > 0.
  const [inspectTarget, setInspectTarget] = useState<VapBatchOutputLine | null>(null);
  const [inspectQty, setInspectQty] = useState('');
  const [rejectionPrompt, setRejectionPrompt] = useState<{ output: VapBatchOutputLine; approved: number; rejected: number } | null>(null);
  const [inspecting, setInspecting] = useState(false);

  function handleInspect(output: VapBatchOutputLine) {
    setInspectTarget(output);
    setInspectQty('');
  }

  function confirmInspectQty() {
    if (!inspectTarget) return;
    const max = inspectTarget.quantity;
    const approved = Number(inspectQty);
    if (!inspectQty || Number.isNaN(approved) || approved < 0 || approved > max) {
      Alert.alert('Invalid Quantity', `Enter a number between 0 and ${max}.`);
      return;
    }
    const output = inspectTarget;
    const rejected = max - approved;
    setInspectTarget(null);
    if (rejected > 0) {
      setRejectionPrompt({ output, approved, rejected });
    } else {
      submitInspection(output, approved, rejected, undefined);
    }
  }

  async function submitInspection(output: VapBatchOutputLine, approved: number, rejected: number, rejection_reason: string | undefined) {
    setInspecting(true);
    try {
      const r = await inspect(output.id, { approved_qty: approved, rejection_reason });
      const parts = [`${approved} accepted`];
      if (rejected > 0) parts.push(`${rejected} rejected${r.rejectionHoldId ? ' — hold created' : ''}`);
      Alert.alert('Inspection Recorded', parts.join(', ') + '.');
      refetch();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to record inspection.');
    } finally {
      setInspecting(false);
      setRejectionPrompt(null);
    }
  }

  function submitRejectionReason(reason: string) {
    if (!rejectionPrompt) return;
    submitInspection(rejectionPrompt.output, rejectionPrompt.approved, rejectionPrompt.rejected, reason?.trim() || undefined);
  }

  if (isLoading) return <LoadingState message="Loading production batches…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Production Batches" dark />

      {isError ? (
        <ErrorState message="Could not load production batches" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={<><VatRejectionHoldsCard onChanged={refetch} /><VapReconciliationCard /><VapReportCard /></>}
          ListEmptyComponent={
            <EmptyState
              icon="layers-outline"
              title="No production batches yet"
              subtitle="Go to New Batch to record one."
            />
          }
          renderItem={({ item }) => (
            <BatchCard
              item={item}
              onPress={() => navigation.navigate('VatDetail', { batch: item })}
              onInspectOutput={handleInspect}
            />
          )}
        />
      )}

      <ReasonModal
        visible={!!inspectTarget}
        title="Value-Added Quality Inspection"
        message={inspectTarget ? `${inspectTarget.quantity} unit(s) to inspect. Enter approved quantity (0–${inspectTarget.quantity}) below.` : ''}
        confirmLabel="Continue"
        allowEmpty
        onCancel={() => setInspectTarget(null)}
        onConfirm={confirmInspectQty}
        extraContent={
          <TextInput
            style={styles.qtyInput}
            value={inspectQty}
            onChangeText={setInspectQty}
            placeholder="Approved quantity"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />
        }
      />
      <ReasonModal
        visible={!!rejectionPrompt}
        title="Rejection Reason"
        message={rejectionPrompt ? `Why were ${rejectionPrompt.rejected} unit(s) rejected?` : ''}
        confirmLabel="Submit"
        allowEmpty
        loading={inspecting}
        onCancel={() => rejectionPrompt && submitInspection(rejectionPrompt.output, rejectionPrompt.approved, rejectionPrompt.rejected, undefined)}
        onConfirm={submitRejectionReason}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  dateText: { fontSize: Typography.xs, color: Colors.textMuted },
  customerText: { fontSize: Typography.sm, color: Colors.textSecondary },

  outputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  outputLabel: { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },

  reworkText: { fontSize: Typography.xs, color: Colors.warning, marginTop: 2 },
  inspectedBadge: { backgroundColor: Colors.successBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  inspectedText: { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },
  inspectBtn: { borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  inspectBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  rhCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm },
  rhTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  rhRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '60', gap: Spacing.sm },
  rhLabel: { fontSize: Typography.sm, color: Colors.textPrimary },
  rhMeta: { fontSize: Typography.xs, color: Colors.textMuted },
  rhBtn: { borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  rhBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  rhBadgeMuted: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  rhBadgeMutedText: { fontSize: Typography.xs, color: Colors.textMuted },
  reportSubTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.sm, marginBottom: 2, textTransform: 'uppercase' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reportValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  qtyInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },
});
