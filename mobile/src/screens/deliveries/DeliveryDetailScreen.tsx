import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { StatusBar }           from 'expo-status-bar';
import { Ionicons }            from '@expo/vector-icons';
import { AppHeader }           from '../../components/AppHeader';
import { StatusBadge }         from '../../components/StatusBadge';
import { Button }              from '../../components/Button';
import { AlertBanner }         from '../../components/AlertBanner';
import { LogisticsHistoryCard } from '../../components/LogisticsHistoryCard';
import { ReasonModal }         from '../../components/ReasonModal';
import { useDeliveryDelete }   from '../../hooks/useDeliveries';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { useOfflineStore }  from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{String(value)}</Text>
    </View>
  );
}

type Props = DeliveryStackScreenProps<'DeliveryDetail'>;

export function DeliveryDetailScreen({ route, navigation }: Props) {
  const { order } = route.params;
  const isOnline  = useOfflineStore(st => st.isOnline);
  const deleteMutation = useDeliveryDelete();

  const [deleteVisible, setDeleteVisible] = useState(false);

  const canUpdateStatus = ['Pending', 'Assigned', 'In Transit'].includes(order.status);
  const canRecordPOD    = order.status === 'In Transit' || order.status === 'Assigned';
  const canEdit         = order.status !== 'POD Recorded';

  const closeShortQty = order.qty_remaining ?? 0;
  const closeShortPct = order.so_quantity
    ? Math.round((closeShortQty / order.so_quantity) * 100)
    : null;

  function handleStatusPress() {
    if (!isOnline) { Alert.alert('Offline', 'Status updates require a connection.'); return; }
    navigation.navigate('DeliveryStatus', { order });
  }

  function handlePODPress() {
    if (!isOnline) { Alert.alert('Offline', 'POD capture requires a connection.'); return; }
    navigation.navigate('PODCapture', { order });
  }

  async function handleDelete(reason: string) {
    try {
      const res = await deleteMutation.mutateAsync({ id: order.id, reason: reason || undefined });
      if ((res as any).pendingApproval) {
        setDeleteVisible(false);
        Alert.alert('Submitted', 'Deletion submitted for manager approval.');
      } else {
        setDeleteVisible(false);
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'Could not delete delivery order.');
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={order.order_number}
        dark
        onBack={() => navigation.goBack()}
        actions={[
          ...(canEdit ? [{ icon: 'pencil-outline' as const, onPress: () => navigation.navigate('DeliveryEdit', { order }) }] : []),
          { icon: 'trash-outline', onPress: () => setDeleteVisible(true) },
        ]}
      />

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Status */}
        <View style={s.statusCard}>
          <StatusBadge status={order.status} />
          {order.delivery_date && <Text style={s.statusDate}>{order.delivery_date}</Text>}
        </View>

        {/* Quantities */}
        <View style={s.qtyGrid}>
          <View style={s.qtyCell}>
            <Text style={s.qtyValue}>{order.qty_dispatched ?? '—'}</Text>
            <Text style={s.qtyLabel}>Dispatched</Text>
          </View>
          <View style={s.qtySep} />
          <View style={s.qtyCell}>
            <Text style={[s.qtyValue, { color: Colors.success }]}>{order.qty_accepted ?? '—'}</Text>
            <Text style={s.qtyLabel}>Accepted</Text>
          </View>
          <View style={s.qtySep} />
          <View style={s.qtyCell}>
            <Text style={[s.qtyValue, { color: Colors.error }]}>{order.qty_rejected ?? '—'}</Text>
            <Text style={s.qtyLabel}>Rejected</Text>
          </View>
        </View>

        {/* Remaining SO units warning */}
        {closeShortQty > 0 && closeShortPct !== null && (
          <AlertBanner
            type="warning"
            message={`${closeShortQty} units remaining on SO (${closeShortPct}% of ${order.so_quantity} ordered)`}
          />
        )}

        {/* Delivery details */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Delivery Details</Text>
          <DetailRow label="Driver"           value={order.driver_name} />
          <DetailRow label="Vehicle"          value={order.vehicle_registration} />
          <DetailRow label="Route"            value={order.route} />
          <DetailRow label="Notes"            value={order.notes} />
          <DetailRow label="Rejection Reason" value={order.rejection_reason} />
          {order.pod_recorded_at && (
            <DetailRow label="POD Recorded At" value={order.pod_recorded_at} />
          )}
        </View>

        {/* Linked sales order */}
        {order.sales_order_number && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Sales Order</Text>
            <DetailRow label="SO Number"      value={order.sales_order_number} />
            <DetailRow label="Customer"       value={order.customer_name} />
            <DetailRow label="SO Quantity"    value={order.so_quantity} />
            <DetailRow label="Accepted Total" value={order.qty_accepted_total} />
            <DetailRow label="Remaining"      value={order.qty_remaining} />
          </View>
        )}

        {/* History */}
        <LogisticsHistoryCard module="deliveries" recordId={order.id} />

        {/* Actions */}
        {(canUpdateStatus || canRecordPOD) && (
          <View style={s.actions}>
            {canUpdateStatus && (
              <Button label="Update Status" icon="refresh-outline" onPress={handleStatusPress} color={Colors.navy} fullWidth />
            )}
            {canRecordPOD && (
              <Button label="Record POD" icon="checkmark-circle-outline" onPress={handlePODPress} color={Colors.success} fullWidth />
            )}
          </View>
        )}
      </ScrollView>

      <ReasonModal
        visible={deleteVisible}
        title="Delete Delivery Order"
        message={`Delete ${order.order_number}? This will also remove any linked dispatch requests.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        allowEmpty
        onCancel={() => setDeleteVisible(false)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  statusCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm,
  },
  statusDate: { fontSize: Typography.xs, color: Colors.textMuted },

  qtyGrid: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  qtyCell: { flex: 1, alignItems: 'center' },
  qtySep:  { width: 1, backgroundColor: Colors.border },
  qtyValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  qtyLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  rowLabel:     { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:     { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 2, textAlign: 'right' },

  actions:    { gap: Spacing.sm },
});
