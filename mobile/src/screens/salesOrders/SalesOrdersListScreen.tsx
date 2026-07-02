import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { StatusBar }         from 'expo-status-bar';
import { Ionicons }          from '@expo/vector-icons';
import { useNavigation }     from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }               from '../../components/AppHeader';
import { LoadingState }            from '../../components/LoadingState';
import { ErrorState }              from '../../components/ErrorState';
import { EmptyState }              from '../../components/EmptyState';
import { ReasonModal }             from '../../components/ReasonModal';
import { SalesOrderStatusBadge }   from '../../components/SalesOrderStatusBadge';
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
  React.useEffect(() => { if (order) setSelected(order.status); }, [order]);
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
              <SalesOrderStatusBadge status={st} />
              {selected === st && <Ionicons name="checkmark" size={16} color={Colors.navy} />}
            </TouchableOpacity>
          ))}
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.confirmBtn}
              onPress={() => onConfirm(selected)}
              disabled={loading}
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
  item, canEdit, canPay,
  onEdit, onPay, onStatus, onCloseShort, onDeliver, onDelete,
}: {
  item: SalesOrder; canEdit: boolean; canPay: boolean;
  onEdit: () => void; onPay: () => void; onStatus: () => void;
  onCloseShort: () => void; onDeliver: () => void; onDelete: () => void;
}) {
  const total     = (item.quantity * item.unit_price).toLocaleString();
  const hasActivity = item.qty_dispatched_total > 0 || item.qty_accepted_total > 0;
  const isPartial = ['Partially Dispatched', 'Fully Dispatched', 'Partially Delivered'].includes(item.status);
  const subType   = item.product_sub_type ? `${item.product_sub_type} ` : '';
  const overdue   = item.payment_due_date && item.payment_status !== 'Paid'
    && new Date(item.payment_due_date) < new Date();

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.orderNum}>
            {item.order_number}
            {item.pending_deletion ? <Text style={s.pendingDel}> · Pending Deletion</Text> : null}
          </Text>
          <Text style={s.customerName}>{item.customer_name}</Text>
        </View>
        <TouchableOpacity onPress={onStatus} activeOpacity={0.8} style={{ alignSelf: 'flex-start' }}>
          <SalesOrderStatusBadge status={item.status} />
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
        <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={onDelete} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={12} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function SalesOrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role ?? '');
  const canCreate  = hasPermission(role as any, 'sales.create');
  const canEdit    = hasPermission(role as any, 'sales.edit');
  const canPay     = hasPermission(role as any, 'sales.pay');

  const { data, isLoading, isError, refetch, isRefetching } = useSalesOrdersList();
  const payMutation        = useSalesOrderPay();
  const statusMutation     = useSalesOrderStatus();
  const closeShortMutation = useSalesOrderCloseShort();
  const deleteMutation     = useSalesOrderDelete();

  const [statusTarget,  setStatusTarget]  = useState<SalesOrder | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<SalesOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (isLoading) return <LoadingState message="Loading sales orders…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load sales orders" onRetry={refetch} fullScreen />;

  const { rows, metrics, stock } = data!;

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
      <AppHeader
        title="Sales Orders"
        subtitle="Timber & poles dispatch to customers"
        dark
        actions={canCreate ? [{ icon: 'add', onPress: () => navigation.navigate('SalesOrderCreate') }] : []}
      />
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
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
        }
        renderItem={({ item }) => (
          <OrderRow
            item={item}
            canEdit={canEdit}
            canPay={canPay}
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
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cart-outline"
            title="No sales orders yet"
            subtitle={canCreate ? 'Tap + to create a new sales order.' : 'No sales orders have been recorded.'}
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
  confirmText:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
});
