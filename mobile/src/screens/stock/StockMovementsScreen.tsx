import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert,
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
import { useStockMovements, useStockMovementDelete } from '../../hooks/useStock';
import { useAuthStore }   from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { hasPermission }  from '../../utils/permissions';
import type { StockMovement } from '../../types/api';
import { StockMovementsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<StockMovementsStackParamList, 'StockMovementsList'>;

// 'transfer' kept here for historical-row display only (see MovRow) — no
// longer a creatable type (Phase 1 Inventory consolidation). 'loss' is also
// system-only — created exclusively by Stock Transfers' Report Discrepancy
// action (Inventory Integrity Phase 1), never from the manual "+" form.
const TYPE_COLORS: Record<string, string> = {
  in:         Colors.success,
  out:        Colors.error,
  adjustment: Colors.warning,
  transfer:   Colors.navy,
  return:     Colors.textSecondary,
  loss:       Colors.error,
};
const TYPE_LABELS: Record<string, string> = {
  in: 'IN', out: 'OUT', adjustment: 'ADJ', transfer: 'TRF', return: 'RET', loss: 'LOSS',
};

// ── Movement Row ──────────────────────────────────────────────────────────────
// Phase 1 (Inventory consolidation) — transfer approve/reject removed from
// this row: moving stock between warehouses now goes exclusively through
// the dedicated Stock Transfers screens. Historical transfer-type rows
// still display here (read-only), just without an inline action.
function MovRow({
  item,
  canDelete,
  onDelete,
  onViewTransfer,
}: {
  item: StockMovement;
  canDelete: boolean;
  onDelete:  () => void;
  onViewTransfer: (transferId: number) => void;
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
          {['out', 'return', 'loss'].includes(item.movement_type) ? '-' : '+'}
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

      {item.movement_type === 'loss' && item.loss_reason ? <Text style={s.rejectionText}>Reason: {item.loss_reason}</Text> : null}
      {item.reference && <Text style={s.metaText}>Ref: {item.reference}</Text>}
      {item.rejection_reason && <Text style={s.rejectionText}>Rejected: {item.rejection_reason}</Text>}
      {item.notes && <Text style={s.metaText}>{item.notes}</Text>}

      <Text style={s.dateText}>{item.created_at} · {item.created_by}</Text>

      <View style={s.actionsRow}>
        {item.transfer_id ? (
          <TouchableOpacity style={s.linkBtn} onPress={() => onViewTransfer(item.transfer_id!)} activeOpacity={0.7}>
            <Ionicons name="swap-horizontal-outline" size={13} color={Colors.navy} />
            <Text style={s.linkText}>View Transfer</Text>
          </TouchableOpacity>
        ) : null}
        {canDelete && !item.pending_deletion && (
          <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={13} color={Colors.error} />
            <Text style={s.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
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

  const canCreate  = hasPermission(role as any, 'stock.movements');

  const [typeFilter,  setTypeFilter]  = useState('all');
  const [deleteItem,  setDeleteItem]  = useState<StockMovement | null>(null);

  const rows       = data?.rows ?? [];
  const items      = data?.items ?? [];
  const warehouses = data?.warehouses ?? [];
  const userWsId   = data?.user_workshop_id;

  const typeOptions = ['all', 'in', 'out', 'adjustment', 'transfer', 'return', 'loss'];

  // Inventory Integrity Phase 1 — Stock Movements and Stock Transfers are
  // separate tabs/stacks on mobile (same as every role navigator that hosts
  // both); no existing precedent for typed cross-navigator params here, so
  // this uses the same narrow `as never` escape hatch already established
  // for the Mechanician dashboard's cross-tab deep links.
  const goToTransfer = (transferId: number) => {
    (navigation as any).navigate('StockTransfers' as never, { screen: 'StockTransferDetail', params: { transferId } } as never);
  };

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
            canDelete={canCreate}
            onDelete={() => {
              if (!isOnline) { Alert.alert('Online Required', 'Deleting requires a connection.'); return; }
              setDeleteItem(item);
            }}
            onViewTransfer={goToTransfer}
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

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base, paddingTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  deleteText: { fontSize: 11, color: Colors.error },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  linkText: { fontSize: 11, color: Colors.navy, fontWeight: Typography.medium },
});
