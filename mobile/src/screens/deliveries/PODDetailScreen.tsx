import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

type Props = DeliveryStackScreenProps<'PODDetail'>;

export function PODDetailScreen({ route, navigation }: Props) {
  const { order } = route.params;
  const rejected  = (order.qty_dispatched ?? 0) - (order.qty_accepted ?? 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="POD Record" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.podBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.podBadgeText}>POD Recorded</Text>
          </View>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          {order.customer_name && (
            <Text style={styles.customer}>{order.customer_name}</Text>
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
            <Text style={[styles.qtyValue, rejected > 0 ? { color: Colors.error } : {}]}>{rejected}</Text>
            <Text style={styles.qtyLabel}>Rejected</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>POD Details</Text>
          <DetailRow label="Recorded At"       value={order.pod_recorded_at} />
          <DetailRow label="Rejection Reason"  value={order.rejection_reason} />
          <DetailRow label="Driver"            value={order.driver_name} />
          <DetailRow label="Vehicle"           value={order.vehicle_registration} />
          <DetailRow label="Route"             value={order.route} />
        </View>

        {/* Sales Order */}
        {order.sales_order_number && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sales Order</Text>
            <DetailRow label="SO Number"       value={order.sales_order_number} />
            <DetailRow label="Customer"        value={order.customer_name} />
            <DetailRow label="Total Accepted"  value={order.qty_accepted_total} />
            <DetailRow label="Remaining"       value={order.qty_remaining} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  headerCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  podBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.success + '1A', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  podBadgeText:  { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.semibold },
  orderNumber:   { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  customer:      { fontSize: Typography.sm, color: Colors.textSecondary },

  qtyGrid:  { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  qtyCell:  { flex: 1, alignItems: 'center' },
  qtySep:   { width: 1, backgroundColor: Colors.border },
  qtyValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  qtyLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  rowLabel:     { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:     { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 2, textAlign: 'right' },
});
