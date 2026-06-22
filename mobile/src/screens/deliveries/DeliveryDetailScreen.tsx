import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { AppHeader }      from '../../components/AppHeader';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';
import { useOfflineStore }  from '../../stores/offlineStore';

const STATUS_COLOR: Record<string, string> = {
  'Pending':      Colors.textMuted,
  'Assigned':     Colors.info,
  'In Transit':   Colors.warning,
  'POD Recorded': Colors.success,
  'Failed':       Colors.error,
};

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

type Props = DeliveryStackScreenProps<'DeliveryDetail'>;

export function DeliveryDetailScreen({ route, navigation }: Props) {
  const { order } = route.params;
  const isOnline  = useOfflineStore((s) => s.isOnline);

  const statusColor  = STATUS_COLOR[order.status] ?? Colors.textMuted;
  const canUpdateStatus = ['Pending', 'Assigned', 'In Transit'].includes(order.status);
  const canRecordPOD    = order.status === 'In Transit';

  const closeShortQty = (order.qty_remaining ?? 0);
  const closeShortPct = order.so_quantity
    ? Math.round((closeShortQty / order.so_quantity) * 100)
    : null;

  function handleStatusPress() {
    if (!isOnline) {
      Alert.alert('Offline', 'Status updates require an internet connection.');
      return;
    }
    navigation.navigate('DeliveryStatus', { order });
  }

  function handlePODPress() {
    if (!isOnline) {
      Alert.alert('Offline', 'POD capture requires an internet connection.');
      return;
    }
    navigation.navigate('PODCapture', { order });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={order.order_number} dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status badge */}
        <View style={[styles.statusCard, { borderLeftColor: statusColor }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
          </View>
          {order.delivery_date && (
            <Text style={styles.statusDate}>{order.delivery_date}</Text>
          )}
        </View>

        {/* Quantities */}
        <View style={styles.qtyGrid}>
          <View style={styles.qtyCell}>
            <Text style={styles.qtyValue}>{order.qty_dispatched ?? '—'}</Text>
            <Text style={styles.qtyLabel}>Dispatched</Text>
          </View>
          <View style={styles.qtySep} />
          <View style={styles.qtyCell}>
            <Text style={[styles.qtyValue, { color: Colors.success }]}>{order.qty_accepted ?? '—'}</Text>
            <Text style={styles.qtyLabel}>Accepted</Text>
          </View>
          <View style={styles.qtySep} />
          <View style={styles.qtyCell}>
            <Text style={[styles.qtyValue, { color: Colors.error }]}>{order.qty_rejected ?? '—'}</Text>
            <Text style={styles.qtyLabel}>Rejected</Text>
          </View>
        </View>

        {/* Close-short indicator */}
        {closeShortQty > 0 && closeShortPct !== null && (
          <View style={styles.closeShortBanner}>
            <Ionicons name="warning-outline" size={16} color={Colors.warning} />
            <Text style={styles.closeShortText}>
              {closeShortQty} units remaining on SO ({closeShortPct}% of {order.so_quantity} ordered)
            </Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <DetailRow label="Driver"            value={order.driver_name} />
          <DetailRow label="Vehicle"           value={order.vehicle_registration} />
          <DetailRow label="Route"             value={order.route} />
          <DetailRow label="Notes"             value={order.notes} />
          <DetailRow label="Rejection Reason"  value={order.rejection_reason} />
          {order.pod_recorded_at && (
            <DetailRow label="POD Recorded At" value={order.pod_recorded_at} />
          )}
        </View>

        {/* Sales Order */}
        {order.sales_order_number && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sales Order</Text>
            <DetailRow label="SO Number"   value={order.sales_order_number} />
            <DetailRow label="Customer"    value={order.customer_name} />
            <DetailRow label="SO Quantity" value={order.so_quantity} />
            <DetailRow label="Accepted Total" value={order.qty_accepted_total} />
            <DetailRow label="Remaining"   value={order.qty_remaining} />
          </View>
        )}

        {/* Actions */}
        {(canUpdateStatus || canRecordPOD) && (
          <View style={styles.actions}>
            {canUpdateStatus && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleStatusPress} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={18} color={Colors.white} />
                <Text style={styles.actionText}>Update Status</Text>
              </TouchableOpacity>
            )}
            {canRecordPOD && (
              <TouchableOpacity style={[styles.actionBtn, styles.podBtn]} onPress={handlePODPress} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
                <Text style={styles.actionText}>Record POD</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  statusCard:  { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  statusText:  { fontSize: Typography.sm, fontWeight: Typography.semibold },
  statusDate:  { fontSize: Typography.xs, color: Colors.textMuted },

  qtyGrid: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  qtyCell: { flex: 1, alignItems: 'center' },
  qtySep:  { width: 1, backgroundColor: Colors.border },
  qtyValue:  { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  qtyLabel:  { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  closeShortBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warning + '1A', borderRadius: Radius.md, padding: Spacing.sm },
  closeShortText:   { flex: 1, fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  rowLabel:     { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:     { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 2, textAlign: 'right' },

  actions:    { gap: Spacing.sm },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base },
  podBtn:     { backgroundColor: Colors.success },
  actionText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
