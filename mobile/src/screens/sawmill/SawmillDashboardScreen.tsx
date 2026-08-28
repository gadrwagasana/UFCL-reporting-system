import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { KpiCard } from '../../components/KpiCard';
import { AlertBanner, AlertType } from '../../components/AlertBanner';
import { ReasonModal } from '../../components/ReasonModal';
import { useSawmillDashboard } from '../../hooks/useSawmill';
import {
  useProductionOffcutsList, useProductionReconciliation, useProductionOffcutActions, useResolutionCreate,
  useRejectionHoldsList, useQualityReport, useRejectionHoldActions,
} from '../../hooks/useTimberLifecycle';
import type {
  SawmillAlert, SawmillByProductRow, SawmillByDimensionRow, ProductionOffcutRow, ResolutionDestination,
  RejectionHoldRow,
} from '../../types/api';
import { SawmillStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<SawmillStackParamList, 'SawmillDashboard'>;

const SEVERITY_TO_ALERT_TYPE: Record<SawmillAlert['severity'], AlertType> = {
  critical: 'critical', high: 'critical', medium: 'warning', low: 'info',
};

function ByProductCard({ rows }: { rows: SawmillByProductRow[] }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Production by product (this month)</Text>
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No catalogued production this month.</Text>
      ) : rows.map(p => (
        <View key={p.productId} style={s.row}>
          <Text style={s.rowLabel}>{p.type} {p.subType ?? ''} {p.size}</Text>
          <Text style={s.rowValue}>{p.unitsMonth.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

function ByDimensionCard({ rows }: { rows: SawmillByDimensionRow[] }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Production by dimension (this month)</Text>
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No production entries this month.</Text>
      ) : rows.map((d, i) => (
        <View key={i} style={s.row}>
          <Text style={s.rowLabel}>{d.widthMm}×{d.thicknessMm}×{d.lengthM}m</Text>
          <Text style={s.rowValue}>{d.unitsMonth.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

const OFFCUT_STATUS_LABEL: Record<string, string> = {
  pending_decision: 'Pending Decision', pending_resaw: 'Pending Resaw',
  resawn: 'Awaiting Inspection', inspected: 'Inspected', resolved: 'Resolved',
};

const DESTINATIONS: ResolutionDestination[] = ['Firewood', 'Scrap Sale', 'Internal Use', 'Disposal', 'Other'];

// Timber Lifecycle Phase 1 (Workstream 4/5) — Production Offcuts + Resaw +
// Reconciliation. Recoverable/Not-Recoverable and simple (Disposal/Other)
// resolutions work directly on mobile; Record Recovery needs several fields
// at once (machine, dimensions) so it points to desktop for now — same
// "simple actions here, multi-field forms on desktop" split already used on
// HarvestWasteScreen. Quality Inspection (Phase 2, Workstream 9) only needs
// one number (approved qty) so it's done via Alert.prompt on mobile too,
// matching the existing Alert.prompt precedent (VehicleDetailScreen etc).
function ProductionOffcutsCard({ rows, onChanged }: { rows: ProductionOffcutRow[]; onChanged: () => void }) {
  const { decide, inspect } = useProductionOffcutActions();
  const { resolve } = useResolutionCreate();

  // ERP UI/UX Completion Phase 8 (audit finding H-13 pattern) — Alert.prompt
  // is iOS-only; state for the cross-platform ReasonModal replacement. The
  // approved-quantity capture reuses ReasonModal's extraContent slot (same
  // pattern as ShowroomScreen's damage-quantity capture); a second-stage
  // modal collects the rejection reason only when rejected > 0.
  const [inspectTarget, setInspectTarget] = useState<ProductionOffcutRow | null>(null);
  const [inspectQty, setInspectQty] = useState('');
  const [rejectionPrompt, setRejectionPrompt] = useState<{ offcut: ProductionOffcutRow; approved: number; rejected: number } | null>(null);
  const [inspecting, setInspecting] = useState(false);

  function handleInspect(o: ProductionOffcutRow) {
    setInspectTarget(o);
    setInspectQty('');
  }

  function confirmInspectQty() {
    if (!inspectTarget) return;
    const max = inspectTarget.recovered_quantity ?? 0;
    const approved = Number(inspectQty);
    if (!inspectQty || Number.isNaN(approved) || approved < 0 || approved > max) {
      Alert.alert('Invalid Quantity', `Enter a number between 0 and ${max}.`);
      return;
    }
    const offcut = inspectTarget;
    const rejected = max - approved;
    setInspectTarget(null);
    if (rejected > 0) {
      setRejectionPrompt({ offcut, approved, rejected });
    } else {
      submitInspection(offcut, approved, rejected, undefined);
    }
  }

  async function submitInspection(o: ProductionOffcutRow, approved: number, rejected: number, rejection_reason: string | undefined) {
    setInspecting(true);
    try {
      const r = await inspect(o.id, { approved_qty: approved, rejection_reason });
      const parts = [`${approved} accepted`];
      if (rejected > 0) parts.push(`${rejected} rejected${r.rejectionHoldId ? ' — hold created' : ''}`);
      Alert.alert('Inspection Recorded', parts.join(', ') + '.');
      onChanged();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to record inspection.');
    } finally {
      setInspecting(false);
      setRejectionPrompt(null);
    }
  }

  function submitRejectionReason(reason: string) {
    if (!rejectionPrompt) return;
    submitInspection(rejectionPrompt.offcut, rejectionPrompt.approved, rejectionPrompt.rejected, reason?.trim() || undefined);
  }

  function handleDecide(id: number) {
    Alert.alert('Recoverable?', 'Can this offcut be resawn into usable timber?', [
      { text: 'Recoverable', onPress: async () => { try { await decide(id, true); onChanged(); } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed'); } } },
      {
        text: 'Not Recoverable', style: 'destructive', onPress: async () => {
          try { await decide(id, false); } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed'); return; }
          const row = rows.find(r => r.id === id);
          const maxVolume = row?.quantity ?? 0;
          Alert.alert('Resolve To', `Choose a destination for up to ${maxVolume} units.`, [
            ...DESTINATIONS.map(dest => ({
              text: dest,
              onPress: async () => {
                if (['Firewood', 'Scrap Sale', 'Internal Use'].includes(dest)) {
                  Alert.alert('Use Desktop', 'This destination needs a warehouse — please use the desktop app to complete this resolution.');
                  return;
                }
                try { await resolve({ source_type: 'production_offcut', source_id: id, destination: dest, volume: maxVolume }); onChanged(); }
                catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to resolve.'); }
              },
            })),
            { text: 'Cancel', style: 'cancel' },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Production offcuts &amp; resaw</Text>
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No production offcuts tracked yet.</Text>
      ) : rows.map(o => (
        <View key={o.id} style={s.offcutRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>{o.production_date} — {o.production_machine ?? 'no machine'}</Text>
            <Text style={s.rowMeta}>{o.quantity} units · {OFFCUT_STATUS_LABEL[o.status] ?? o.status}</Text>
            {o.rework_of_rejection_id != null && (
              <Text style={[s.rowMeta, { color: Colors.warning }]}>Rework of Rejection #{o.rework_of_rejection_id}</Text>
            )}
          </View>
          {o.status === 'pending_decision' && (
            <TouchableOpacity style={s.actionBtn} onPress={() => handleDecide(o.id)}>
              <Text style={s.actionBtnText}>Decide</Text>
            </TouchableOpacity>
          )}
          {o.status === 'pending_resaw' && (
            <View style={s.badgeMuted}><Text style={s.badgeMutedText}>Use desktop</Text></View>
          )}
          {o.status === 'resawn' && (
            <TouchableOpacity style={s.actionBtn} onPress={() => handleInspect(o)}>
              <Text style={s.actionBtnText}>Inspect</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <ReasonModal
        visible={!!inspectTarget}
        title="Quality Inspection"
        message={inspectTarget ? `${inspectTarget.recovered_quantity ?? 0} unit(s) recovered. Enter approved quantity (0–${inspectTarget.recovered_quantity ?? 0}) below.` : ''}
        confirmLabel="Continue"
        allowEmpty
        onCancel={() => setInspectTarget(null)}
        onConfirm={confirmInspectQty}
        extraContent={
          <TextInput
            style={s.qtyInput}
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
        onCancel={() => rejectionPrompt && submitInspection(rejectionPrompt.offcut, rejectionPrompt.approved, rejectionPrompt.rejected, undefined)}
        onConfirm={submitRejectionReason}
      />
    </View>
  );
}

function ReconciliationCard() {
  const { data } = useProductionReconciliation();
  const rows = data?.rows ?? [];
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Production reconciliation</Text>
      {data && (
        <Text style={[s.rowMeta, { marginBottom: Spacing.xs, color: data.unreconciledCount > 0 ? Colors.warning : Colors.success }]}>
          {data.unreconciledCount > 0 ? `${data.unreconciledCount} batch(es) have outstanding volume` : 'All batches with recorded waste are fully reconciled'}
        </Text>
      )}
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No production entries with recorded waste yet.</Text>
      ) : rows.map(r => (
        <View key={r.dailyLogId} style={s.row}>
          <Text style={s.rowLabel}>{r.productionDate}</Text>
          <Text style={[s.rowValue, { color: r.reconciled ? Colors.success : Colors.error }]}>{r.reconciled ? 'Reconciled' : `${r.untrackedWaste} untracked`}</Text>
        </View>
      ))}
    </View>
  );
}

const REJECTION_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', rework: 'In Rework', downgraded: 'Downgraded', returned: 'Returned', resolved: 'Resolved',
};
const REJECTED_DESTINATIONS: ResolutionDestination[] = ['Firewood', 'Scrap Sale', 'Disposal'];

// Timber Lifecycle Phase 2 (Workstream 9) — Rejection Holds. Rework (no
// fields) and Return to Inventory (one reason field) run natively via
// Alert/Alert.prompt; Downgrade needs a product picker so it points to
// desktop, matching the Record Recovery precedent above. Disposal is
// attempted directly — the backend enforces the elevated-role gate
// (Workstream 10) and mobile just surfaces the resulting error if denied.
function RejectionHoldsCard({ rows, onChanged }: { rows: RejectionHoldRow[]; onChanged: () => void }) {
  const { rework, returnToInventory } = useRejectionHoldActions();
  const { resolve } = useResolutionCreate();

  // ERP UI/UX Completion Phase 8 (audit finding H-13 pattern) — Alert.prompt
  // is iOS-only; state for the cross-platform ReasonModal replacement.
  const [returnTarget, setReturnTarget] = useState<RejectionHoldRow | null>(null);
  const [returning, setReturning] = useState(false);

  function handleRework(hold: RejectionHoldRow) {
    Alert.alert('Send to Rework', `Re-enter ${hold.quantity} unit(s) into the resaw queue for another pass?`, [
      { text: 'Rework', onPress: async () => { try { await rework(hold.id); onChanged(); } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to send to rework.'); } } },
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
          if (dest !== 'Disposal') {
            Alert.alert('Use Desktop', 'This destination needs a warehouse — please use the desktop app to complete this resolution.');
            return;
          }
          try { await resolve({ source_type: 'rejected_timber', source_id: hold.id, destination: dest, volume: hold.quantity }); onChanged(); }
          catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to resolve.'); }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Rejection holds</Text>
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No rejected timber on hold.</Text>
      ) : rows.map(h => (
        <View key={h.id} style={s.offcutRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>{h.product_type ?? 'Unknown'} {h.product_sub_type ?? ''} {h.product_size ?? ''}</Text>
            <Text style={s.rowMeta}>
              {h.quantity} units · {REJECTION_STATUS_LABEL[h.status] ?? h.status}
              {h.inspection_rejection_reason ? ` · ${h.inspection_rejection_reason}` : ''}
            </Text>
          </View>
          {h.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity style={s.actionBtn} onPress={() => handleRework(h)}>
                <Text style={s.actionBtnText}>Rework</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => handleReturn(h)}>
                <Text style={s.actionBtnText}>Return</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => handleResolve(h)}>
                <Text style={s.actionBtnText}>Resolve</Text>
              </TouchableOpacity>
            </View>
          )}
          {h.status !== 'pending' && (
            <View style={s.badgeMuted}><Text style={s.badgeMutedText}>{REJECTION_STATUS_LABEL[h.status] ?? h.status}</Text></View>
          )}
        </View>
      ))}

      <ReasonModal
        visible={!!returnTarget}
        title="Return to Inventory"
        message={returnTarget ? `Enter a reason for returning ${returnTarget.quantity} unit(s) of ${returnTarget.product_type ?? 'this item'} ${returnTarget.product_size ?? ''} back to stock as-is:` : ''}
        confirmLabel="Return"
        loading={returning}
        onCancel={() => setReturnTarget(null)}
        onConfirm={submitReturn}
      />
    </View>
  );
}

function QualityReportCard() {
  const { data } = useQualityReport();
  if (!data) return null;
  const { quality, resolution, financial } = data;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Quality report</Text>
      <View style={s.tileGrid}>
        <KpiCard variant="tile" title="Produced" value={quality.totalProduced} />
        <KpiCard variant="tile" title="Accepted" value={quality.totalAccepted} />
        <KpiCard variant="tile" title="Rejected" value={quality.totalRejected} warn={!!quality.totalRejected} />
        <KpiCard variant="tile" title="Rejection %" value={quality.rejectionRatePct != null ? `${quality.rejectionRatePct}%` : '—'}
          warn={quality.rejectionRatePct != null && quality.rejectionRatePct > 10} />
      </View>
      <Text style={[s.rowMeta, { marginTop: Spacing.sm, marginBottom: 4 }]}>Resolution breakdown</Text>
      {(['reworked', 'downgraded', 'returned', 'pending', 'firewood', 'scrapSale', 'disposal', 'other'] as const)
        .filter(k => resolution[k] > 0)
        .map(k => (
          <View key={k} style={s.row}>
            <Text style={s.rowLabel}>{k[0].toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1')}</Text>
            <Text style={s.rowValue}>{resolution[k]}</Text>
          </View>
        ))}
      {resolution.reworked + resolution.downgraded + resolution.returned + resolution.pending
        + resolution.firewood + resolution.scrapSale + resolution.disposal + resolution.other === 0 && (
        <Text style={s.emptyText}>No resolutions recorded yet.</Text>
      )}
      <Text style={[s.rowMeta, { marginTop: Spacing.sm, marginBottom: 4 }]}>Financial impact</Text>
      <View style={s.row}><Text style={s.rowLabel}>Rejected inventory value</Text><Text style={s.rowValue}>{financial.rejectedInventoryValue.toLocaleString()}</Text></View>
      <View style={s.row}><Text style={s.rowLabel}>Recovered value</Text><Text style={s.rowValue}>{financial.recoveredValue.toLocaleString()}</Text></View>
      <View style={s.row}><Text style={s.rowLabel}>Scrap value</Text><Text style={s.rowValue}>{financial.scrapValue.toLocaleString()}</Text></View>
      <View style={s.row}><Text style={s.rowLabel}>Disposal value</Text><Text style={s.rowValue}>{financial.disposalValue.toLocaleString()}</Text></View>
      <View style={s.row}><Text style={s.rowLabel}>Firewood value</Text><Text style={s.rowValue}>{financial.firewoodValue.toLocaleString()}</Text></View>
      <View style={s.row}><Text style={s.rowLabel}>Returned to inventory value</Text><Text style={s.rowValue}>{financial.inventoryValueReturned.toLocaleString()}</Text></View>
    </View>
  );
}

export function SawmillDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useSawmillDashboard();
  const { data: offcutsData, refetch: refetchOffcuts } = useProductionOffcutsList();
  const { data: rejectionData, refetch: refetchRejections } = useRejectionHoldsList();

  if (isLoading) return <LoadingState message="Loading Sawmill dashboard…" fullScreen />;
  if (isError)   return <ErrorState message="Could not load the Sawmill dashboard" onRetry={refetch} fullScreen />;

  const { today, week, month, recoveryPctMonth, wastePctMonth, rawTimberAvailable,
          finishedTimberAvailable, byProduct, byDimension, alerts } = data!;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Sawmill Dashboard"
        subtitle="What is happening in the sawmill today"
        dark
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            {alerts.length === 0 ? (
              <AlertBanner type="success" message="No operational alerts — production, raw material, and variance all within normal range." />
            ) : alerts.map((a, i) => (
              <AlertBanner key={i} type={SEVERITY_TO_ALERT_TYPE[a.severity]} message={a.message} />
            ))}

            <View style={s.tileGrid}>
              <KpiCard variant="tile" title="Today" value={today.units} subtitle={`${today.logs} logs`} />
              <KpiCard variant="tile" title="This week" value={week.units} subtitle={`${week.logs} logs`} />
              <KpiCard variant="tile" title="This month" value={month.units} subtitle={`${month.logs} logs`} />
              <KpiCard variant="tile" title="Recovery %" value={recoveryPctMonth != null ? `${recoveryPctMonth}%` : '—'}
                warn={recoveryPctMonth != null && recoveryPctMonth < 80} />
              <KpiCard variant="tile" title="Waste %" value={`${wastePctMonth}%`} warn={wastePctMonth > 20} />
              <KpiCard variant="tile" title="Raw timber" value={rawTimberAvailable} subtitle="logs in yard" />
              <KpiCard variant="tile" title="Finished timber" value={finishedTimberAvailable} subtitle="pcs available" />
            </View>

            <ByProductCard rows={byProduct} />
            <ByDimensionCard rows={byDimension} />
            <ProductionOffcutsCard rows={offcutsData?.rows ?? []} onChanged={() => { refetchOffcuts(); refetchRejections(); }} />
            <RejectionHoldsCard rows={rejectionData?.rows ?? []} onChanged={() => { refetchRejections(); refetchOffcuts(); }} />
            <ReconciliationCard />
            <QualityReportCard />
          </>
        }
        contentContainerStyle={s.list}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + '60',
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace' },
  rowMeta: { fontSize: Typography.xs, color: Colors.textMuted },
  emptyText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },

  offcutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '60', gap: Spacing.sm,
  },
  actionBtn: { borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  actionBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  badgeMuted: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeMutedText: { fontSize: Typography.xs, color: Colors.textMuted },
  qtyInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },
});
