import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }           from '../../components/AppHeader';
import { LoadingState }        from '../../components/LoadingState';
import { ErrorState }          from '../../components/ErrorState';
import { EmptyState }          from '../../components/EmptyState';
import { ReasonModal }          from '../../components/ReasonModal';
import {
  useStockMovements, useStockMovementDelete, useTransferApproveFromMovements,
} from '../../hooks/useStock';
import { useAuthStore }   from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { hasPermission }  from '../../utils/permissions';
import type { StockMovement } from '../../types/api';
import { StockMovementsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<StockMovementsStackParamList, 'StockMovementsList'>;

const TYPE_COLORS: Record<string, string> = {
  in:         Colors.success,
  out:        Colors.error,
  adjustment: Colors.warning,
  transfer:   Colors.navy,
  return:     Colors.textSecondary,
};
const TYPE_LABELS: Record<string, string> = {
  in: 'IN', out: 'OUT', adjustment: 'ADJ', transfer: 'TRF', return: 'RET',
};

// ── Reject Reason Modal ───────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>Reject Transfer</Text>
        <TextInput
          style={s.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for rejection…"
          placeholderTextColor={Colors.textMuted}
          multiline
          autoFocus
        />
        <TouchableOpacity
          style={[s.rejectBtn, !reason.trim() && s.btnDisabled]}
          onPress={() => { if (reason.trim()) { onConfirm(reason.trim()); onClose(); } }}
          disabled={!reason.trim()}
          activeOpacity={0.8}
        >
          <Text style={s.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={s.cancelBtn} activeOpacity={0.7}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Movement Row ──────────────────────────────────────────────────────────────
function MovRow({
  item,
  canApprove,
  canDelete,
  onApprove,
  onReject,
  onDelete,
}: {
  item: StockMovement;
  canApprove: boolean;
  canDelete: boolean;
  onApprove: () => void;
  onReject:  () => void;
  onDelete:  () => void;
}) {
  const typeColor  = TYPE_COLORS[item.movement_type] ?? Colors.textMuted;
  const typeLabel  = TYPE_LABELS[item.movement_type] ?? item.movement_type.toUpperCase();
  const isPending  = item.approval_status === 'pending';
  const isRejected = item.approval_status === 'rejected';

  return (
    <View style={[s.row, item.pending_deletion && s.rowPendingDel]}>
      <View style={s.rowHead}>
        <View style={[s.typeBadge, { backgroundColor: typeColor + '20' }]}>
          <Text style={[s.typeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <View style={s.catBadge}><Text style={s.catText}>{item.category}</Text></View>
        {isPending  && <View style={s.badgeAmber}><Text style={s.badgeText}>Pending</Text></View>}
        {isRejected && <View style={s.badgeRed}><Text style={s.badgeText}>Rejected</Text></View>}
        {item.pending_deletion && <View style={s.badgeRed}><Text style={s.badgeText}>Del Pending</Text></View>}
      </View>

      <Text style={s.itemName}>{item.item_name}</Text>

      <View style={s.qtyRow}>
        <Text style={[s.qty, { color: typeColor }]}>
          {item.movement_type === 'out' || item.movement_type === 'return' ? '-' : '+'}
          {item.quantity} <Text style={s.uom}>{item.uom}</Text>
        </Text>
        {item.total_value != null && (
          <Text style={s.metaText}>RWF {Number(item.total_value).toLocaleString()}</Text>
        )}
      </View>

      {item.warehouse_name ? (
        <Text style={s.metaText}>
          {item.movement_type === 'transfer'
            ? `${item.warehouse_name} → ${item.to_warehouse_name ?? '?'}`
            : item.warehouse_name}
        </Text>
      ) : null}

      {item.reference && <Text style={s.metaText}>Ref: {item.reference}</Text>}
      {item.rejection_reason && <Text style={s.rejectionText}>Rejected: {item.rejection_reason}</Text>}

      <Text style={s.dateText}>{item.created_at} · {item.created_by}</Text>

      {/* Transfer approval actions */}
      {isPending && item.movement_type === 'transfer' && canApprove && (
        <View style={s.approvalRow}>
          <TouchableOpacity style={s.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.white} />
            <Text style={s.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.rejectActionBtn} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="close-circle-outline" size={14} color={Colors.error} />
            <Text style={s.rejectActionText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delete */}
      {canDelete && !item.pending_deletion && (
        <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={13} color={Colors.error} />
          <Text style={s.deleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function StockMovementsScreen() {
  const navigation  = useNavigation<NavProp>();
  const role        = useAuthStore(s => s.user?.role ?? '');
  const { isOnline } = useOfflineStore();
  const { data, isLoading, isError, refetch, isRefetching } = useStockMovements();
  const { deleteMovement }  = useStockMovementDelete();
  const { approveTransfer } = useTransferApproveFromMovements();

  const canApprove = hasPermission(role as any, 'stock.approve');
  const canCreate  = hasPermission(role as any, 'stock.movements');

  const [typeFilter,  setTypeFilter]  = useState('all');
  const [deleteItem,  setDeleteItem]  = useState<StockMovement | null>(null);
  const [rejectItem,  setRejectItem]  = useState<StockMovement | null>(null);

  const rows       = data?.rows ?? [];
  const items      = data?.items ?? [];
  const warehouses = data?.warehouses ?? [];
  const userWsId   = data?.user_workshop_id;

  const typeOptions = ['all', 'in', 'out', 'adjustment', 'transfer', 'return'];

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return rows;
    return rows.filter(r => r.movement_type === typeFilter);
  }, [rows, typeFilter]);

  const totalIn  = rows.filter(r => r.movement_type === 'in').reduce((s, r) => s + Number(r.quantity), 0);
  const totalOut = rows.filter(r => r.movement_type === 'out').reduce((s, r) => s + Number(r.quantity), 0);
  const pending  = rows.filter(r => r.approval_status === 'pending').length;

  async function handleDelete(reason: string) {
    if (!deleteItem) return;
    await deleteMovement({ id: deleteItem.id, reason });
    setDeleteItem(null);
  }

  async function handleApprove(id: number) {
    if (!isOnline) { Alert.alert('Online Required', 'Approvals require a connection.'); return; }
    try {
      await approveTransfer({ id, action: 'approve' });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not approve transfer.');
    }
  }

  async function handleReject(id: number, reason: string) {
    if (!isOnline) { Alert.alert('Online Required', 'Rejections require a connection.'); return; }
    try {
      await approveTransfer({ id, action: 'reject', reason });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not reject transfer.');
    }
  }

  if (isLoading) return <LoadingState message="Loading movements…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load movements" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Stock Movements"
        dark
        actions={canCreate ? [
          {
            icon: 'add-circle-outline',
            onPress: () => navigation.navigate('StockMovementForm', { items, warehouses, userWorkshopId: userWsId }),
          },
        ] : undefined}
      />

      <FlatList
        data={filtered}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            {/* Metrics */}
            <View style={s.banner}>
              {[
                { label: 'Total',   value: String(rows.length) },
                { label: 'In',      value: String(totalIn),   accent: false },
                { label: 'Out',     value: String(totalOut),  accent: false },
                { label: 'Pending', value: String(pending),   accent: pending > 0 },
              ].map(stat => (
                <View key={stat.label} style={s.stat}>
                  <Text style={[s.statValue, (stat as any).accent && { color: Colors.warning }]}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Type filter chips */}
            <FlatList
              horizontal
              data={typeOptions}
              keyExtractor={t => t}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={[s.chip, typeFilter === t && s.chipActive]}
                  onPress={() => setTypeFilter(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, typeFilter === t && s.chipTextActive]}>
                    {t === 'all' ? 'All' : TYPE_LABELS[t] ?? t}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="swap-horizontal-outline"
            title={typeFilter !== 'all' ? 'No matches' : 'No movements recorded'}
            subtitle={typeFilter !== 'all' ? 'Try a different filter.' : 'Use the + button to record a movement.'}
          />
        }
        renderItem={({ item }) => (
          <MovRow
            item={item}
            canApprove={canApprove}
            canDelete={canCreate}
            onApprove={() => handleApprove(item.id)}
            onReject={() => setRejectItem(item)}
            onDelete={() => {
              if (!isOnline) { Alert.alert('Online Required', 'Deleting requires a connection.'); return; }
              setDeleteItem(item);
            }}
          />
        )}
      />

      {deleteItem && (
        <ReasonModal
          visible
          title={`Delete movement for "${deleteItem.item_name}"?`}
          onCancel={() => setDeleteItem(null)}
          onConfirm={handleDelete}
        />
      )}

      {rejectItem && (
        <RejectModal
          onConfirm={reason => handleReject(rejectItem.id, reason)}
          onClose={() => setRejectItem(null)}
        />
      )}
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

  chips: { gap: Spacing.xs, paddingBottom: Spacing.xs },
  chip:  {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:       { fontSize: Typography.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: Typography.medium },

  row: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  rowPendingDel: { opacity: 0.6 },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  typeBadge: { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeText:  { fontSize: 10, fontWeight: Typography.bold },

  catBadge: { backgroundColor: Colors.navy + '15', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  catText:  { fontSize: 10, color: Colors.navy, fontWeight: Typography.medium },

  badgeAmber: { backgroundColor: Colors.warning + '20', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeRed:   { backgroundColor: Colors.error   + '20', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:  { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textPrimary },

  itemName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  qtyRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qty:      { fontSize: Typography.sm, fontWeight: Typography.bold },
  uom:      { fontSize: Typography.xs, fontWeight: '400', color: Colors.textMuted },
  metaText: { fontSize: Typography.xs, color: Colors.textSecondary },
  rejectionText: { fontSize: Typography.xs, color: Colors.error },
  dateText: { fontSize: 10, color: Colors.textMuted },

  approvalRow:    { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: 6,
  },
  approveBtnText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.white },
  rejectActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.error + '15', borderRadius: Radius.md, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.error + '40',
  },
  rejectActionText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.error },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingTop: 2 },
  deleteText: { fontSize: 11, color: Colors.error },

  // Reject modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  sheetTitle:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  reasonInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },
  rejectBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  btnDisabled:   { opacity: 0.5 },
  rejectBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  cancelBtn:     { alignItems: 'center', paddingVertical: Spacing.xs },
  cancelText:    { fontSize: Typography.sm, color: Colors.textMuted },
});
