import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert, TextInput, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }             from '../../components/AppHeader';
import { LoadingState }          from '../../components/LoadingState';
import { ErrorState }            from '../../components/ErrorState';
import { EmptyState }            from '../../components/EmptyState';
import { ReasonModal }           from '../../components/ReasonModal';
import { TransferStatusBadge }   from '../../components/TransferStatusBadge';
import {
  useStockTransfersList, useStockTransferApprove, useStockTransferReceive,
} from '../../hooks/useStockTransfers';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { StockTransfer, TransferVehicle } from '../../types/api';
import type { StockTransfersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<StockTransfersStackParamList, 'StockTransfersList'>;

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ dispatched, received, requested }: { dispatched: number; received: number; requested: number }) {
  const dispPct = requested > 0 ? Math.min(100, Math.round((dispatched / requested) * 100)) : 0;
  const recvPct = requested > 0 ? Math.min(100, Math.round((received  / requested) * 100)) : 0;
  return (
    <View>
      <Text style={s.progressText}>
        <Text style={s.progressLabel}>Disp: </Text>{dispatched}/{requested}
        {'  '}
        <Text style={s.progressLabel}>Recv: </Text>{received}/{requested}
      </Text>
      <View style={s.progressTrack}>
        <View style={[s.progressDisp, { width: `${dispPct}%` as any }]} />
        <View style={[s.progressRecv, { width: `${recvPct}%` as any }]} />
      </View>
    </View>
  );
}

// ── Receive modal ─────────────────────────────────────────────────────────────
function ReceiveModal({
  transfer, onClose, onConfirm, loading,
}: {
  transfer: StockTransfer | null;
  onClose: () => void;
  onConfirm: (qty: number, notes: string) => void;
  loading: boolean;
}) {
  const [qty, setQty]     = useState('');
  const [notes, setNotes] = useState('');
  const inTransit = transfer ? transfer.dispatched_qty - transfer.received_qty : 0;
  const canSubmit = Number(qty) > 0 && Number(qty) <= inTransit && !loading;

  React.useEffect(() => {
    if (!transfer) { setQty(''); setNotes(''); }
  }, [transfer]);

  return (
    <Modal visible={transfer !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Record Receipt</Text>
          {transfer && (
            <Text style={s.modalSub}>Receiving: {transfer.item_name} — in transit: {inTransit} {transfer.uom}</Text>
          )}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Quantity received <Text style={s.required}>*</Text></Text>
            <TextInput
              style={s.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholder={`Max: ${inTransit}`}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={s.field}>
            <Text style={s.fieldLabel}>Notes <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes…"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, !canSubmit && s.btnDisabled]}
              onPress={() => { if (canSubmit) onConfirm(Number(qty), notes.trim()); }}
              disabled={!canSubmit}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={s.confirmText}>Confirm Receipt</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Transfer row card ─────────────────────────────────────────────────────────
function TransferRow({
  item, canApprove, canAct,
  onApprove, onReject, onDispatch, onReceive, onDetail,
}: {
  item: StockTransfer; canApprove: boolean; canAct: boolean;
  onApprove: () => void; onReject: () => void;
  onDispatch: () => void; onReceive: () => void; onDetail: () => void;
}) {
  const showDispatch = canAct
    && ['approved', 'in_transit'].includes(item.status)
    && item.dispatched_qty < item.requested_qty;
  const showReceive  = canAct
    && ['in_transit', 'partially_received'].includes(item.status)
    && item.received_qty < item.dispatched_qty;
  const showDetail   = item.dispatched_qty > 0;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          {item.reference && <Text style={s.reference}>{item.reference}</Text>}
          <Text style={s.dateText}>{item.requested_at}</Text>
        </View>
        <TransferStatusBadge status={item.status} />
      </View>

      <Text style={s.itemName}>{item.item_name}</Text>
      <Text style={s.category}>{item.category}</Text>

      <View style={s.routeRow}>
        <Text style={s.warehouse} numberOfLines={1}>{item.from_warehouse_name}</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
        <Text style={s.warehouse} numberOfLines={1}>{item.to_warehouse_name}</Text>
      </View>

      <Text style={s.qty}>{item.requested_qty.toLocaleString()} <Text style={s.uom}>{item.uom}</Text></Text>

      <ProgressBar
        dispatched={item.dispatched_qty}
        received={item.received_qty}
        requested={item.requested_qty}
      />

      {item.status === 'rejected' && item.rejection_reason && (
        <Text style={s.rejectionReason}>{item.rejection_reason}</Text>
      )}

      {item.requested_by && (
        <Text style={s.requestedBy}>Requested by {item.requested_by}</Text>
      )}

      {(canApprove && item.status === 'pending') || showDispatch || showReceive || showDetail ? (
        <View style={s.actions}>
          {canApprove && item.status === 'pending' && (
            <>
              <TouchableOpacity style={[s.actionBtn, s.approveBtn]} onPress={onApprove} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={13} color={Colors.white} />
                <Text style={s.actionText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={onReject} activeOpacity={0.8}>
                <Ionicons name="close" size={13} color={Colors.white} />
                <Text style={s.actionText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {showDispatch && (
            <TouchableOpacity style={[s.actionBtn, s.dispatchBtn]} onPress={onDispatch} activeOpacity={0.8}>
              <Ionicons name="car-outline" size={13} color={Colors.white} />
              <Text style={s.actionText}>Dispatch</Text>
            </TouchableOpacity>
          )}
          {showReceive && (
            <TouchableOpacity style={[s.actionBtn, s.receiveBtn]} onPress={onReceive} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={13} color={Colors.white} />
              <Text style={s.actionText}>Receive</Text>
            </TouchableOpacity>
          )}
          {showDetail && (
            <TouchableOpacity style={s.detailBtn} onPress={onDetail} activeOpacity={0.8}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function StockTransfersListScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role ?? '');
  const canApprove = hasPermission(role as any, 'transfer.approve');
  const canAct     = hasPermission(role as any, 'transfer.act');

  const { data, isLoading, isError, refetch, isRefetching } = useStockTransfersList();
  const approveMutation = useStockTransferApprove();
  const receiveMutation = useStockTransferReceive();

  const [rejectTarget,  setRejectTarget]  = useState<StockTransfer | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<StockTransfer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (isLoading) return <LoadingState message="Loading stock transfers…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load stock transfers" onRetry={refetch} fullScreen />;

  const { rows, items, vehicles, summary, user_workshop_id } = data!;

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await approveMutation.mutateAsync({ id, action: 'approve' });
      if (!(res as any).ok) Alert.alert('Error', (res as any).error ?? 'Approval failed');
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setRejectTarget(null);
    setActionLoading(true);
    try {
      const res = await approveMutation.mutateAsync({ id, action: 'reject', rejectionReason: reason || undefined });
      if (!(res as any).ok) Alert.alert('Error', (res as any).error ?? 'Rejection failed');
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  const handleReceive = async (qty: number, notes: string) => {
    if (!receiveTarget) return;
    const id = receiveTarget.id;
    setReceiveTarget(null);
    setActionLoading(true);
    try {
      const res = await receiveMutation.mutateAsync({ id, qty, notes: notes || undefined });
      if (!(res as any).ok) {
        Alert.alert('Error', (res as any).error ?? 'Receipt failed');
      } else {
        Alert.alert('Receipt Recorded', (res as any).completed
          ? 'Transfer completed — all items received.'
          : 'Receipt recorded — stock added to destination.');
      }
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Stock Transfers"
        subtitle="Request → Approval → Dispatch → Receipt"
        dark
        actions={canAct ? [{ icon: 'add', onPress: () => navigation.navigate('StockTransferNewRequest') }] : []}
      />
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            {/* KPI banner — server-computed */}
            <View style={s.banner}>
              <View style={s.stat}>
                <Text style={s.statValue}>{summary.total}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statValue, summary.pending > 0 && { color: Colors.warning }]}>{summary.pending}</Text>
                <Text style={s.statLabel}>Pending</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>{summary.inTransit}</Text>
                <Text style={s.statLabel}>In Transit</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statValue, { color: Colors.success }]}>{summary.completed}</Text>
                <Text style={s.statLabel}>Completed</Text>
              </View>
            </View>
            {/* Workshop filter notice for restricted roles */}
            {user_workshop_id && (
              <View style={s.workshopBanner}>
                <Ionicons name="business-outline" size={14} color={Colors.info} />
                <Text style={s.workshopText}>Showing transfers for your workshop</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TransferRow
            item={item}
            canApprove={canApprove}
            canAct={canAct}
            onApprove={() => handleApprove(item.id)}
            onReject={() => setRejectTarget(item)}
            onDispatch={() => navigation.navigate('StockTransferDispatch', {
              transferId: item.id,
              remaining:  item.requested_qty - item.dispatched_qty,
              itemName:   item.item_name,
              uom:        item.uom,
              vehicles,
            })}
            onReceive={() => setReceiveTarget(item)}
            onDetail={()  => navigation.navigate('StockTransferDetail', { transferId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="swap-horizontal-outline"
            title="No transfers yet"
            subtitle={canAct ? 'Tap + to request a stock transfer.' : 'No stock transfers have been recorded.'}
          />
        }
      />

      {/* Reject modal — reason is optional (allowEmpty) to match desktop */}
      <ReasonModal
        visible={rejectTarget !== null}
        title={`Reject transfer #${rejectTarget?.id ?? ''}`}
        message="Provide a reason for rejection (optional)."
        confirmLabel="Reject"
        allowEmpty
        loading={actionLoading}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />

      <ReceiveModal
        transfer={receiveTarget}
        onClose={() => setReceiveTarget(null)}
        onConfirm={handleReceive}
        loading={actionLoading}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm, marginBottom: Spacing.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  workshopBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.infoBg, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  workshopText: { fontSize: Typography.xs, color: Colors.info },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, gap: Spacing.xs,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  reference:   { fontSize: Typography.xs, fontFamily: 'monospace', color: Colors.textMuted },
  dateText:    { fontSize: 11, color: Colors.textMuted },

  itemName:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  category:  { fontSize: 11, color: Colors.textMuted },

  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  warehouse: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },

  qty: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },
  uom: { fontSize: Typography.xs, fontWeight: '400', color: Colors.textMuted },

  progressText:  { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  progressLabel: { color: Colors.textSecondary },
  progressTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  progressDisp:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.navy, opacity: 0.45 },
  progressRecv:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.success },

  rejectionReason: { fontSize: Typography.xs, color: Colors.error, fontStyle: 'italic' },
  requestedBy:     { fontSize: 11, color: Colors.textMuted },

  actions: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.md },
  actionText:  { fontSize: 12, fontWeight: Typography.semibold, color: Colors.white },
  approveBtn:  { backgroundColor: Colors.success },
  rejectBtn:   { backgroundColor: Colors.error },
  dispatchBtn: { backgroundColor: Colors.navy },
  receiveBtn:  { backgroundColor: Colors.statusInTransitText },
  detailBtn:   { marginLeft: 'auto', padding: 4 },

  // Receive modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: Spacing.xl },
  modalCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  modalSub:     { fontSize: Typography.xs, color: Colors.textSecondary },
  field:        { gap: 4 },
  fieldLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  required:     { color: Colors.error },
  optional:     { fontWeight: '400', color: Colors.textMuted },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { fontSize: Typography.sm, color: Colors.textSecondary },
  confirmBtn: { flex: 2, backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmText:{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled:{ opacity: 0.4 },
});
