import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBadge }  from '../../components/StatusBadge';
import { ReasonModal }  from '../../components/ReasonModal';
import { MRApproveModal } from '../../components/MRApproveModal';
import { useStockTransferHistory } from '../../hooks/useStockTransfers';
import { useWorkshopOverview, useMaterialRequestApproveFromOverview } from '../../hooks/useWorkshops';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { hasPermission } from '../../utils/permissions';
import { MaterialRequestsStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type RouteProps = MaterialRequestsStackScreenProps<'MaterialRequestDetail'>['route'];
type NavProps   = MaterialRequestsStackScreenProps<'MaterialRequestDetail'>['navigation'];

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'Normal', high: 'High', urgent: 'Urgent', critical: 'Critical',
};

// UI/UX redesign — Approval Progress stepper. Data model doesn't carry a
// separate "dispatched" instant from "in transit" duration (dispatching a
// transfer sets it straight to in_transit), so those two stages are marked
// reached together rather than fabricating a distinction that isn't there.
const MR_STAGES = ['Submitted', 'Approved', 'Transfer Created', 'In Transit', 'Received', 'Completed'];
function mrStage(item: { status: string; transfer_status?: string | null }): string {
  if (item.status === 'rejected') return 'Rejected';
  if (item.status === 'pending') return 'Submitted';
  if (!item.transfer_status) return 'Approved';
  if (item.transfer_status === 'approved') return 'Transfer Created';
  if (item.transfer_status === 'in_transit') return 'In Transit';
  if (item.transfer_status === 'partially_received') return 'Received';
  if (item.transfer_status === 'completed' || item.transfer_status === 'completed_with_discrepancy') return 'Completed';
  return 'Approved';
}

function ProgressStepper({ stage }: { stage: string }) {
  if (stage === 'Rejected') {
    return (
      <View style={styles.rejectedRow}>
        <Ionicons name="close-circle" size={18} color={Colors.error} />
        <Text style={styles.rejectedText}>This request was rejected — it left the normal flow.</Text>
      </View>
    );
  }
  const idx = MR_STAGES.indexOf(stage);
  return (
    <View style={styles.stepperRow}>
      {MR_STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <View style={styles.stepCell}>
            <Ionicons
              name={i < idx ? 'checkmark-circle' : i === idx ? 'ellipse' : 'ellipse-outline'}
              size={14}
              color={i < idx ? Colors.success : i === idx ? Colors.warning : Colors.textMuted}
            />
            <Text style={[styles.stepLabel, i <= idx && { color: Colors.textPrimary, fontWeight: Typography.semibold }]}>{s}</Text>
          </View>
          {i < MR_STAGES.length - 1 ? <View style={[styles.stepConnector, { backgroundColor: i < idx ? Colors.success : Colors.border }]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

interface RowProps { label: string; value: string }
function Row({ label, value }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// Read-only summary of the linked Stock Transfer — Stock Transfer remains
// the sole owner of dispatch/receiving/discrepancy logic; this only reads
// its already-existing detail endpoint, same as the Stock Transfers screens.
function LinkedTransferCard({ transferId }: { transferId: number }) {
  const { data, isLoading, isError } = useStockTransferHistory(transferId);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Linked Transfer</Text>
        <ActivityIndicator color={Colors.navy} style={{ marginVertical: Spacing.sm }} />
      </View>
    );
  }
  if (isError || !data?.transfer) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Linked Transfer</Text>
        <Text style={styles.rowLabel}>Could not load transfer details.</Text>
      </View>
    );
  }
  const t = data.transfer;
  const lastDispatch = data.dispatches[data.dispatches.length - 1] ?? null;
  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <Text style={styles.cardTitle}>Linked Transfer — #{t.id}</Text>
        <StatusBadge status={t.status} />
      </View>
      <View style={styles.divider} />
      <Row label="Source Warehouse" value={t.from_warehouse_name} />
      <View style={styles.rowDivider} />
      <Row label="Destination Workshop" value={t.to_warehouse_name} />
      <View style={styles.rowDivider} />
      <Row label="Vehicle" value={lastDispatch?.registration ? `${lastDispatch.registration}${lastDispatch.vehicle_label ? ' — ' + lastDispatch.vehicle_label : ''}` : '—'} />
      <View style={styles.rowDivider} />
      <Row label="Driver" value={lastDispatch?.driver_name || '—'} />
      <View style={styles.rowDivider} />
      <Row label="Dispatch Date" value={lastDispatch?.dispatched_at || '—'} />
      <View style={styles.rowDivider} />
      <Row label="Received Qty" value={`${t.received_qty} / ${t.requested_qty}`} />
      {t.status === 'completed_with_discrepancy' ? (
        <View style={[styles.reviewBox, styles.reviewBoxRejected, { marginTop: Spacing.sm }]}>
          <Text style={[styles.reviewLabel, styles.reviewLabelRejected]}>Closed with shortage — {t.discrepancy_qty ?? 0} {t.uom} short</Text>
          {t.discrepancy_notes ? <Text style={[styles.reviewText, styles.reviewTextRejected]}>{t.discrepancy_notes}</Text> : null}
        </View>
      ) : null}
      <Text style={styles.transferNote}>Dispatch, transportation, and receiving are managed entirely on the Stock Transfers screen — this is a read-only summary.</Text>
    </View>
  );
}

// Stabilization Phase 5 (F-6) — desktop has a dedicated approve/reject action
// on its Material Requests page as well as on Workshop Overview; mobile only
// had the latter. Reuses the exact same permission ('workshop.approve', P-4)
// and mutation (useMaterialRequestApproveFromOverview) as Workshop Overview —
// not a new capability, just a second entry point to the existing one.
export function MaterialRequestDetailScreen() {
  const route      = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const { item }   = route.params;

  const role = useAuthStore((s) => s.user?.role);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const canApprove = !!role && hasPermission(role, 'workshop.approve');
  const { data: overviewData } = useWorkshopOverview();
  const workshops = overviewData?.workshops ?? [];
  const { approveMaterialRequest } = useMaterialRequestApproveFromOverview();

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  async function handleApprove(qty: number, sourceWarehouseId: number, destinationWorkshopId: number | null, notes: string) {
    setApproveLoading(true);
    try {
      const res: any = await approveMaterialRequest({
        requestId: item.id, action: 'approve', approvedQty: qty, reviewNotes: notes || undefined,
        sourceWarehouseId, destinationWorkshopId: destinationWorkshopId ?? undefined,
      });
      if (!res?.ok) {
        Alert.alert('Error', res?.error ?? 'Could not approve request.');
      } else {
        setApproveOpen(false);
        Alert.alert('Approved', 'Request approved — a stock transfer was created and is ready for dispatch.');
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not process request.');
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleReject(reason: string) {
    setRejectLoading(true);
    try {
      const res: any = await approveMaterialRequest({ requestId: item.id, action: 'reject', reviewNotes: reason });
      if (!res?.ok) {
        Alert.alert('Error', res?.error ?? 'Could not process request.');
      } else {
        setRejectOpen(false);
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not process request.');
    } finally {
      setRejectLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Request Details" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <StatusBadge status={item.status} />
          </View>
          {item.workshop_name ? (
            <View style={styles.workshopRow}>
              <Ionicons name="business-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.workshopName}>{item.workshop_name}</Text>
            </View>
          ) : null}
        </View>

        {/* Approval Progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Approval Progress</Text>
          <View style={styles.divider} />
          <ProgressStepper stage={mrStage(item)} />
        </View>

        {/* Request details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request</Text>
          <View style={styles.divider} />
          <Row label="Requested Qty"  value={`${item.requested_qty}${item.uom ? ` ${item.uom}` : ''}`} />
          {item.approved_qty != null ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Approved Qty" value={`${item.approved_qty}${item.uom ? ` ${item.uom}` : ''}`} />
            </>
          ) : null}
          <View style={styles.rowDivider} />
          <Row label="Priority"     value={PRIORITY_LABEL[item.priority] ?? item.priority} />
          <View style={styles.rowDivider} />
          <Row label="Submitted"    value={item.requested_at} />
          {item.needed_by ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Needed By" value={new Date(item.needed_by).toLocaleDateString()} />
            </>
          ) : null}
          {item.requested_by ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Requested by" value={item.requested_by} />
            </>
          ) : null}
          {item.reason ? (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Purpose / Justification</Text>
                <Text style={[styles.rowValue, styles.multilineValue]}>{item.reason}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Review result — only shown after decision */}
        {(item.status === 'approved' || item.status === 'rejected' || item.status === 'partial' || item.status === 'completed') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review</Text>
            <View style={styles.divider} />
            <View style={styles.timelineRow}>
              <Ionicons
                name={item.status === 'rejected' ? 'close-circle' : 'checkmark-circle'}
                size={20}
                color={item.status === 'rejected' ? Colors.error : Colors.success}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineMain}>
                  {item.status === 'rejected' ? 'Rejected'
                    : item.status === 'partial' ? 'Partially Approved'
                    : item.status === 'completed' ? 'Completed — stock received'
                    : 'Approved'}
                  {item.reviewed_by ? ` by ${item.reviewed_by}` : ''}
                </Text>
                {item.reviewed_at ? (
                  <Text style={styles.timelineSub}>{item.reviewed_at}</Text>
                ) : null}
              </View>
            </View>
            {item.review_notes ? (
              <View style={[styles.reviewBox,
                item.status === 'rejected' ? styles.reviewBoxRejected : styles.reviewBoxApproved]}>
                <Text style={[styles.reviewLabel,
                  item.status === 'rejected' ? styles.reviewLabelRejected : styles.reviewLabelApproved]}>
                  Reviewer Notes
                </Text>
                <Text style={[styles.reviewText,
                  item.status === 'rejected' ? styles.reviewTextRejected : styles.reviewTextApproved]}>
                  {item.review_notes}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Linked Transfer — only once the request has been approved */}
        {item.transfer_id ? <LinkedTransferCard transferId={item.transfer_id} /> : null}

        {/* Approve / Reject — only for pending requests, same permission and
            mutation as Workshop Overview's equivalent action. */}
        {item.status === 'pending' && canApprove ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.rejectBtn}
              disabled={!isOnline}
              onPress={() => { if (!isOnline) { Alert.alert('Online Required', 'Approvals require an active connection.'); return; } setRejectOpen(true); }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isOnline }}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approveBtn}
              disabled={!isOnline}
              onPress={() => { if (!isOnline) { Alert.alert('Online Required', 'Approvals require an active connection.'); return; } setApproveOpen(true); }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isOnline }}
            >
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <MRApproveModal
        item={approveOpen ? item : null}
        workshops={workshops}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        loading={approveLoading}
      />
      <ReasonModal
        visible={rejectOpen}
        title="Reject Request"
        message={`Reject request for ${item.requested_qty} ${item.uom ?? ''} "${item.item_name}"?`}
        confirmLabel="Reject"
        loading={rejectLoading}
        onCancel={() => setRejectOpen(false)}
        onConfirm={handleReject}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  divider:    { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { height: 1, backgroundColor: Colors.divider },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  itemName: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  workshopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxs,
  },
  workshopName: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.base,
  },
  rowLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  rowValue: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  multilineValue: {
    textAlign: 'left',
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  timelineContent: { flex: 1 },
  timelineMain: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  timelineSub: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },

  reviewBox: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  reviewBoxApproved: { backgroundColor: Colors.successBg },
  reviewBoxRejected: { backgroundColor: Colors.errorBg },
  reviewLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  reviewLabelApproved: { color: Colors.success },
  reviewLabelRejected: { color: Colors.error },
  reviewText: { fontSize: Typography.sm },
  reviewTextApproved: { color: Colors.success },
  reviewTextRejected: { color: Colors.error },

  stepperRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  stepCell: { alignItems: 'center', gap: 3, width: 68 },
  stepLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  stepConnector: { height: 1, flex: 1, minWidth: 8, marginBottom: 14 },
  rejectedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rejectedText: { fontSize: Typography.sm, color: Colors.error, flex: 1 },
  transferNote: { fontSize: 11, color: Colors.textMuted, marginTop: Spacing.sm, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  rejectBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.error },
  approveBtn: { flex: 2, backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  approveBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
});
