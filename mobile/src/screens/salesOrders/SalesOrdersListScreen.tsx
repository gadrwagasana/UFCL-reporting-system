import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { StatusBar }         from 'expo-status-bar';
import { Ionicons }          from '@expo/vector-icons';
import { useNavigation }     from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }               from '../../components/AppHeader';
import { OfflineBanner }           from '../../components/OfflineBanner';
import { LoadingState }            from '../../components/LoadingState';
import { ErrorState }              from '../../components/ErrorState';
import { EmptyState }              from '../../components/EmptyState';
import { ListSearchBar }           from '../../components/ListSearchBar';
import { ReasonModal }             from '../../components/ReasonModal';
import { StatusBadge }             from '../../components/StatusBadge';
import { FulfilmentProgress }      from '../../components/FulfilmentProgress';
import {
  useSalesOrdersList, useSalesOrderPay, useSalesOrderStatus,
  useSalesOrderCloseShort, useSalesOrderDelete,
} from '../../hooks/useSalesOrders';
import { useAuthStore }      from '../../stores/authStore';
import { hasPermission }     from '../../utils/permissions';
import { MANUAL_STATUSES }   from '../../utils/salesConstants';
import type { SalesOrder }   from '../../types/api';
import type { SalesOrdersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<SalesOrdersStackParamList, 'SalesOrdersList'>;

// Master Professionalization Phase C1 (Gap Register PR-01) — this list used
// to have zero search/filter/pagination of any kind, hard-capped at 50 rows
// server-side with no way to reach anything past it. Same filter-chip
// convention as VehiclesListScreen/PayrollPeriodsListScreen (each screen
// defines its own local FilterChip — no shared component exists yet in this
// codebase, so this follows the established copy, not a new pattern).
const PAGE_SIZE = 30;
const STATUS_CHIPS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Dispatched', label: 'Dispatched' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Closed (Short)', label: 'Closed Short' },
  { value: 'Cancelled', label: 'Cancelled' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} activeOpacity={0.7} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Status picker modal ────────────────────────────────────────────────────────
function StatusModal({
  order, onClose, onConfirm, loading,
}: {
  order: SalesOrder | null;
  onClose: () => void;
  onConfirm: (status: string) => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState(order?.status ?? 'Pending');
  // Sales Enterprise Phase 1 — real gap found: selecting Cancelled here had
  // zero extra confirmation, unlike Delete (ReasonModal) and Close Short
  // (its own destructive-style Alert.alert). Require an explicit second tap
  // before Cancelled can actually be submitted; every other status is
  // unaffected and submits on the first Update tap as before.
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  React.useEffect(() => { if (order) setSelected(order.status); setCancelConfirmed(false); }, [order]);
  React.useEffect(() => { if (selected !== 'Cancelled') setCancelConfirmed(false); }, [selected]);
  const isCancelPending = selected === 'Cancelled' && !cancelConfirmed;
  return (
    <Modal visible={order !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Update Status</Text>
          {order && <Text style={s.modalSub}>{order.order_number} — {order.customer_name}</Text>}
          {MANUAL_STATUSES.map(st => (
            <TouchableOpacity
              key={st}
              style={[s.statusOption, selected === st && s.statusOptionActive]}
              onPress={() => setSelected(st)}
              activeOpacity={0.7}
            >
              <StatusBadge status={st} />
              {selected === st && <Ionicons name="checkmark" size={16} color={Colors.navy} />}
            </TouchableOpacity>
          ))}
          {selected === 'Cancelled' && (
            <View style={s.cancelWarn}>
              <Text style={s.cancelWarnText}>
                Cancelling this order cannot be undone.
              </Text>
              <TouchableOpacity
                style={s.cancelConfirmRow}
                onPress={() => setCancelConfirmed(v => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name={cancelConfirmed ? 'checkbox' : 'square-outline'} size={18} color={Colors.error} />
                <Text style={s.cancelConfirmText}>Yes, cancel this order</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, isCancelPending && s.confirmBtnDisabled]}
              onPress={() => onConfirm(selected)}
              disabled={loading || isCancelPending}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={s.confirmText}>Update</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Stock KPI card ────────────────────────────────────────────────────────────
function StockCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const low = value < 10;
  return (
    <View style={s.stockCard}>
      <Text style={s.stockLabel}>{label}</Text>
      <Text style={[s.stockValue, { color: value < 0 ? Colors.error : low ? Colors.warning : Colors.textPrimary }]}>
        {value.toLocaleString()}
      </Text>
      {sub && <Text style={s.stockSub}>{sub}</Text>}
    </View>
  );
}

// ── Order row card ─────────────────────────────────────────────────────────────
function OrderRow({
  item, canEdit, canPay, canDelete,
  onEdit, onPay, onStatus, onCloseShort, onDeliver, onDelete, onViewCustomer, onViewDetail,
}: {
  item: SalesOrder; canEdit: boolean; canPay: boolean; canDelete: boolean;
  onEdit: () => void; onPay: () => void; onStatus: () => void;
  onCloseShort: () => void; onDeliver: () => void; onDelete: () => void;
  onViewCustomer: () => void; onViewDetail: () => void;
}) {
  const total     = (item.quantity * item.unit_price).toLocaleString();
  const hasActivity = item.qty_dispatched_total > 0 || item.qty_accepted_total > 0;
  const isPartial = ['Partially Dispatched', 'Fully Dispatched', 'Partially Delivered'].includes(item.status);
  const subType   = item.product_sub_type ? `${item.product_sub_type} ` : '';
  const overdue   = item.payment_due_date && item.payment_status !== 'Paid'
    && new Date(item.payment_due_date) < new Date();

  return (
    <TouchableOpacity style={s.card} onPress={onViewDetail} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.orderNum}>
            {item.order_number}
            {item.pending_deletion ? <Text style={s.pendingDel}> · Pending Deletion</Text> : null}
          </Text>
          {item.customer_id ? (
            <TouchableOpacity onPress={onViewCustomer} activeOpacity={0.7} style={s.customerLinkRow}>
              <Text style={[s.customerName, s.customerLink]}>{item.customer_name}</Text>
              <Ionicons name="chevron-forward-circle-outline" size={13} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <Text style={s.customerName}>{item.customer_name}</Text>
          )}
        </View>
        <TouchableOpacity onPress={canEdit ? onStatus : undefined} disabled={!canEdit} activeOpacity={0.8} style={{ alignSelf: 'flex-start' }}>
          <StatusBadge status={item.status} />
        </TouchableOpacity>
      </View>

      {/* Product */}
      <View style={s.productRow}>
        <View style={[s.typeBadge, item.product_type === 'Timber' ? s.timberBadge : s.polesBadge]}>
          <Text style={s.typeText}>{item.product_type}</Text>
        </View>
        <Text style={s.productSize}>{subType}{item.product_size}</Text>
      </View>

      {/* Financials */}
      <View style={s.financRow}>
        <Text style={s.qty}>{item.quantity.toLocaleString()} units</Text>
        <Text style={s.price}>{Number(item.unit_price).toLocaleString()} <Text style={s.currency}>{item.currency}</Text></Text>
        <Text style={s.total}>{total} {item.currency}</Text>
      </View>
      <Text style={s.taxType}>{item.price_tax_type === 'Inclusive' ? '+ Transport included' : 'Ex-works'}</Text>

      {/* Payment */}
      <View style={s.payRow}>
        <Ionicons
          name={item.payment_status === 'Paid' ? 'checkmark-circle' : 'time-outline'}
          size={13}
          color={item.payment_status === 'Paid' ? Colors.success : overdue ? Colors.error : Colors.warning}
        />
        <Text style={[s.payStatus, {
          color: item.payment_status === 'Paid' ? Colors.success : overdue ? Colors.error : Colors.warning,
        }]}>
          {item.payment_status === 'Paid'
            ? 'Paid'
            : item.payment_due_date
              ? `Due ${new Date(item.payment_due_date).toLocaleDateString('en-GB')}${overdue ? ' (overdue)' : ''}`
              : 'No due date'}
        </Text>
      </View>

      {/* Fulfilment progress */}
      {hasActivity && (
        <FulfilmentProgress
          ordered={item.quantity}
          dispatched={item.qty_dispatched_total}
          accepted={item.qty_accepted_total}
          uom="units"
        />
      )}

      {/* Delivery link */}
      {item.delivery_number && (
        <Text style={s.deliveryRef}>
          <Text style={s.deliveryLabel}>Delivery: </Text>{item.delivery_number}
          {item.delivery_status ? ` (${item.delivery_status})` : ''}
        </Text>
      )}

      <Text style={s.dateText}>{item.created_at}</Text>

      {/* Actions */}
      <View style={s.actions}>
        {canEdit && (
          <TouchableOpacity style={[s.actionBtn, s.editBtn]} onPress={onEdit} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={12} color={Colors.white} />
            <Text style={s.actionText}>Edit</Text>
          </TouchableOpacity>
        )}
        {canPay && item.payment_status === 'Unpaid' && (
          <TouchableOpacity style={[s.actionBtn, s.payBtn]} onPress={onPay} activeOpacity={0.8}>
            <Ionicons name="cash-outline" size={12} color={Colors.white} />
            <Text style={s.actionText}>Mark Paid</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.actionBtn, s.deliverBtn]} onPress={onDeliver} activeOpacity={0.8}>
          <Ionicons name="cube-outline" size={12} color={Colors.white} />
          <Text style={s.actionText}>Deliver</Text>
        </TouchableOpacity>
        {isPartial && canEdit && (
          <TouchableOpacity style={[s.actionBtn, s.closeShortBtn]} onPress={onCloseShort} activeOpacity={0.8}>
            <Ionicons name="close-outline" size={12} color={Colors.white} />
            <Text style={s.actionText}>Close Short</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={12} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function SalesOrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role ?? '');
  const canCreate  = hasPermission(role as any, 'sales.create');
  const canEdit    = hasPermission(role as any, 'sales.edit');
  const canPay     = hasPermission(role as any, 'sales.pay');
  // Master Professionalization Phase C1 — Delete and status-change had no
  // permission gate at all on this screen (unlike Edit/Pay/Close-Short,
  // which correctly check canEdit/canPay); every role that could reach this
  // screen saw both buttons regardless of holding sales.edit. Backend still
  // enforced governance/ownership either way — this only fixes the
  // client-side affordance inconsistency. Reuses sales.edit since both are
  // edit-tier actions on an existing order, same as Edit/Close-Short.
  const canDelete  = canEdit;

  // Master Professionalization Phase C1 (Gap Register PR-01) — this screen
  // used to fetch once with no params at all, matching the old backend
  // contract that hard-capped at 50 rows with no filter support. Page-based
  // accumulation (not true infinite scroll) so pull-to-refresh and filter
  // changes both behave predictably.
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage]     = useState(1);
  const [accRows, setAccRows] = useState<SalesOrder[]>([]);
  const isFiltered = !!search.trim() || !!status;

  useEffect(() => { setPage(1); }, [search, status]);

  const { data, isLoading, isError, refetch, isFetching } = useSalesOrdersList({
    search: search.trim() || undefined, status: status || undefined, page, pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (!data) return;
    setAccRows(prev => (data.page && data.page > 1) ? [...prev, ...data.rows] : data.rows);
  }, [data]);

  const payMutation        = useSalesOrderPay();
  const statusMutation     = useSalesOrderStatus();
  const closeShortMutation = useSalesOrderCloseShort();
  const deleteMutation     = useSalesOrderDelete();

  const [statusTarget,  setStatusTarget]  = useState<SalesOrder | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<SalesOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (isLoading && page === 1 && accRows.length === 0) return <LoadingState message="Loading sales orders…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load sales orders" onRetry={refetch} fullScreen />;

  const rows    = accRows;
  const total   = data?.total ?? rows.length;
  const canLoadMore = rows.length < total;
  const metrics = data?.metrics ?? { pending: 0, confirmed: 0, inProgress: 0, delivered: 0, closed: 0 };
  const stock   = data?.stock ?? {
    timberStock: 0, timberProduced: 0, timberSold: 0,
    polesStock: 0, polesProduced: 0, polesSold: 0,
    kilnDriedStock: 0, ccaTreatedStock: 0, untreatedStock: 0,
  };

  const handleRefresh = () => { setPage(1); refetch(); };

  const handlePay = async (id: number, orderNum: string) => {
    Alert.alert('Mark as Paid', `Confirm full payment received for ${orderNum}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', style: 'default',
        onPress: async () => {
          setActionLoading(true);
          try {
            await payMutation.mutateAsync({ id, paymentStatus: 'Paid' });
          } catch { Alert.alert('Error', 'Failed to update payment.'); }
          finally   { setActionLoading(false); }
        },
      },
    ]);
  };

  const handleStatus = async (status: string) => {
    if (!statusTarget) return;
    const id = statusTarget.id;
    setStatusTarget(null);
    setActionLoading(true);
    try {
      const res = await statusMutation.mutateAsync({ id, status });
      if (!(res as any).ok) Alert.alert('Error', (res as any).error ?? 'Status update failed');
    } catch { Alert.alert('Error', 'Failed to update status.'); }
    finally   { setActionLoading(false); }
  };

  const handleCloseShort = async (id: number, orderNum: string, qtyRemaining: number) => {
    setActionLoading(true);
    try {
      await closeShortMutation.mutateAsync(id);
      Alert.alert('Closed Short', `Order ${orderNum} closed. ${qtyRemaining} undelivered units returned to stock.`);
    } catch { Alert.alert('Error', 'Failed to close short.'); }
    finally   { setActionLoading(false); }
  };

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setActionLoading(true);
    try {
      const res = await deleteMutation.mutateAsync({ id, reason: reason || undefined });
      if ((res as any).pendingApproval) {
        Alert.alert('Submitted', 'Deletion request submitted for manager approval.');
      } else if (!(res as any).ok) {
        Alert.alert('Error', (res as any).error ?? 'Delete failed');
      }
    } catch { Alert.alert('Error', 'Failed to delete order.'); }
    finally   { setActionLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Sales Orders"
        subtitle="Timber & poles dispatch to customers"
        searchModule="sales"
        dark
        actions={canCreate ? [{ icon: 'add', onPress: () => navigation.navigate('SalesOrderCreate') }] : []}
      />
      <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search order #, customer, product…" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {STATUS_CHIPS.map((c) => (
          <FilterChip key={c.value || 'all'} label={c.label} active={status === c.value} onPress={() => setStatus(c.value)} />
        ))}
        {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatus(''); }} /> : null}
      </ScrollView>
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isFetching && page === 1} onRefresh={handleRefresh} tintColor={Colors.navy} />}
        contentContainerStyle={rows.length === 0 ? s.emptyContainer : s.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (!isFetching && canLoadMore) setPage(p => p + 1); }}
        ListFooterComponent={isFetching && page > 1 ? <ActivityIndicator style={{ marginVertical: Spacing.base }} color={Colors.navy} /> : null}
        ListHeaderComponent={
          !isFiltered ? (
            <>
            {/* Order metrics */}
            <View style={s.metricsBanner}>
              {([
                ['Pending',  metrics.pending,   Colors.warning],
                ['Confirmed',metrics.confirmed,  Colors.navy],
                ['Active',   metrics.inProgress, '#4F46E5'],
                ['Delivered',metrics.delivered,  Colors.success],
                ['Closed',   metrics.closed,     Colors.textMuted],
              ] as [string, number, string][]).map(([lbl, val, col]) => (
                <View key={lbl} style={s.metricStat}>
                  <Text style={[s.metricVal, { color: val > 0 ? col : Colors.textMuted }]}>{val}</Text>
                  <Text style={s.metricLbl}>{lbl}</Text>
                </View>
              ))}
            </View>

            {/* Stock cards */}
            <View style={s.stockRow}>
              <StockCard label="Timber"      value={stock.timberStock} />
              <StockCard label="Poles"       value={stock.polesStock} />
              <StockCard label="Kiln-dried"  value={stock.kilnDriedStock} />
              <StockCard label="CCA-treated" value={stock.ccaTreatedStock} />
              <StockCard label="Untreated"   value={stock.untreatedStock} />
            </View>
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <OrderRow
            item={item}
            canEdit={canEdit}
            canPay={canPay}
            canDelete={canDelete}
            onEdit={() => navigation.navigate('SalesOrderEdit', { order: item })}
            onPay={() => handlePay(item.id, item.order_number)}
            onStatus={() => setStatusTarget(item)}
            onCloseShort={() => Alert.alert(
              'Close Short',
              `Order ${item.order_number}: ${item.qty_remaining} undelivered units will be returned to stock. This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Close Short', style: 'destructive',
                  onPress: () => handleCloseShort(item.id, item.order_number, item.qty_remaining) },
              ]
            )}
            onDeliver={() => navigation.navigate('SalesOrderDeliver', {
              orderId:      item.id,
              orderNumber:  item.order_number,
              customerName: item.customer_name,
            })}
            onDelete={() => setDeleteTarget(item)}
            onViewCustomer={() => item.customer_id && navigation.navigate('CustomerDetail', {
              customerId:   item.customer_id,
              customerName: item.customer_name,
            })}
            onViewDetail={() => navigation.navigate('SalesOrderDetail', { orderId: item.id, orderNumber: item.order_number })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cart-outline"
            title={isFiltered ? 'No matching orders' : 'No sales orders yet'}
            subtitle={isFiltered ? 'Try a different search or filter.' : (canCreate ? 'Tap + to create a new sales order.' : 'No sales orders have been recorded.')}
          />
        }
      />

      <StatusModal
        order={statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatus}
        loading={actionLoading}
      />

      <ReasonModal
        visible={deleteTarget !== null}
        title={`Delete order ${deleteTarget?.order_number ?? ''}`}
        message="Provide a reason for deletion (required for audit trail)."
        confirmLabel="Delete"
        loading={actionLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  metricsBanner: {
    flexDirection: 'row', backgroundColor: Colors.navy, borderRadius: Radius.lg,
    padding: Spacing.sm, justifyContent: 'space-around', ...Shadow.sm, marginBottom: Spacing.xs,
  },
  metricStat:  { alignItems: 'center', gap: 2 },
  metricVal:   { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  metricLbl:   { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  stockRow: {
    flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xs, flexWrap: 'nowrap',
  },
  stockCard:  { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.xs, ...Shadow.sm, gap: 2, minWidth: 60 },
  stockLabel: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  stockValue: { fontSize: Typography.sm, fontWeight: Typography.bold, fontFamily: 'monospace' },
  stockSub:   { fontSize: 9, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, gap: Spacing.xs,
  },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum:     { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },
  pendingDel:   { fontSize: 11, color: Colors.error, fontWeight: '400' },
  customerName: { fontSize: Typography.xs, color: Colors.textSecondary },
  customerLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  customerLink:     { color: Colors.navy, fontWeight: Typography.medium },

  productRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  typeBadge:    { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  timberBadge:  { backgroundColor: Colors.warning + '22' },
  polesBadge:   { backgroundColor: Colors.navy + '22' },
  typeText:     { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textSecondary },
  productSize:  { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },

  financRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  qty:       { fontSize: Typography.xs, color: Colors.textSecondary },
  price:     { fontSize: Typography.xs, color: Colors.textSecondary },
  currency:  { fontSize: 10, color: Colors.textMuted },
  total:     { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace', marginLeft: 'auto' },
  taxType:   { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },

  payRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payStatus: { fontSize: Typography.xs },

  deliveryRef:   { fontSize: Typography.xs, color: Colors.textSecondary },
  deliveryLabel: { color: Colors.textMuted },
  dateText:      { fontSize: 11, color: Colors.textMuted },

  actions: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.sm, marginTop: Spacing.xs, flexWrap: 'wrap',
  },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.md },
  actionText:    { fontSize: 11, fontWeight: Typography.semibold, color: Colors.white },
  editBtn:       { backgroundColor: Colors.navy },
  payBtn:        { backgroundColor: Colors.success },
  deliverBtn:    { backgroundColor: '#4F46E5' },
  closeShortBtn: { backgroundColor: Colors.warning },
  deleteBtn:     { backgroundColor: Colors.error },

  // Status modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: Spacing.xl },
  modalCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  modalSub:     { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent',
  },
  statusOptionActive: { borderColor: Colors.navy, backgroundColor: Colors.bg },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText:   { fontSize: Typography.sm, color: Colors.textSecondary },
  confirmBtn:   { flex: 2, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: Colors.textMuted },
  confirmText:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },

  cancelWarn:        { backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm, gap: Spacing.xs },
  cancelWarnText:    { fontSize: Typography.xs, color: Colors.error },
  cancelConfirmRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cancelConfirmText: { fontSize: Typography.sm, color: Colors.error, fontWeight: Typography.medium },
});
