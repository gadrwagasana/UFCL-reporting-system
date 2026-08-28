import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { useCustomerOrders } from '../../hooks/useCustomers';
import { CustomersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<CustomersStackParamList, 'CustomerDetail'>;
type RoutePropT = RouteProp<CustomersStackParamList, 'CustomerDetail'>;

function fmtCur(n: number): string {
  return 'RWF ' + Math.round(n).toLocaleString();
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={13} color={Colors.navy} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ERP Final Enterprise Completion Gate — confirmed no Customer Detail/order-
// history view existed on either platform (both had only a flat list + edit
// form). Follows VehicleDetailScreen's proven "ScrollView + section header +
// mapped sub-cards" shape rather than inventing a new convention.
export function CustomerDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { customerId, customerName } = route.params;

  const { data, isLoading, isError, refetch } = useCustomerOrders(customerId);
  const customer = data?.ok ? data.customer : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={customerName}
        dark
        onBack={() => navigation.goBack()}
        actions={customer ? [{
          icon: 'create-outline',
          label: 'Edit customer',
          onPress: () => navigation.navigate('CustomerForm', { customer }),
        }] : []}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Text style={styles.customerName} numberOfLines={1}>{customer?.name ?? customerName}</Text>
          {customer ? (
            customer.active
              ? <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>
              : <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>
          ) : null}
        </View>

        {customer && (
          <>
            <View style={styles.card}>
              <SectionHeader title="Contact" icon="call-outline" />
              <Row label="Contact person" value={customer.contact_person} />
              <Row label="Phone" value={customer.phone} />
              <Row label="Email" value={customer.email} />
              <Row label="Address" value={customer.address} />
              <Row label="TIN" value={customer.tin} />
            </View>

            <View style={styles.card}>
              <SectionHeader title="Record Info" icon="information-circle-outline" />
              <Row label="Registered" value={customer.created_at} />
              <Row label="Registered by" value={customer.created_by} />
            </View>

            {customer.notes ? (
              <View style={styles.card}>
                <SectionHeader title="Notes" icon="document-text-outline" />
                <Text style={styles.notes}>{customer.notes}</Text>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.card}>
          <View style={styles.subHeaderRow}>
            <SectionHeader title={`Orders${data?.ok ? ` (${data.summary.totalOrders})` : ''}`} icon="cart-outline" />
          </View>
          {isLoading ? (
            <LoadingState message="Loading orders…" />
          ) : isError || !data?.ok ? (
            <ErrorState message="Could not load orders" onRetry={refetch} />
          ) : data.orders.length === 0 ? (
            <Text style={styles.emptyText}>No orders for this customer yet.</Text>
          ) : (
            <>
              <Text style={styles.summaryText}>{fmtCur(data.summary.totalValue)} total (excl. cancelled)</Text>
              {data.orders.map((o) => (
                <View key={o.id} style={styles.orderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>{o.order_number}</Text>
                    <Text style={styles.orderProduct} numberOfLines={1}>
                      {o.product_type}{o.product_sub_type ? ` — ${o.product_sub_type}` : ''} {o.product_size ?? ''}
                    </Text>
                    <Text style={styles.orderMeta}>{o.order_date} · Qty {o.quantity} · {fmtCur(o.total_value)}</Text>
                    <Text style={styles.orderMeta}>
                      {o.payment_status ?? 'Unpaid'}{o.payment_due_date ? ` · Due ${new Date(o.payment_due_date).toLocaleDateString('en-GB')}` : ''}
                    </Text>
                    {/* Sales Enterprise Phase 2 (Priority 4) — delivery history per order */}
                    <Text style={styles.orderMeta}>
                      {o.delivery_count ? `${o.delivery_number ?? ''} — ${o.delivery_status ?? ''}${o.delivery_count > 1 ? ` (+${o.delivery_count - 1} more)` : ''}` : 'No delivery yet'}
                    </Text>
                  </View>
                  <StatusBadge status={o.status} size="sm" />
                </View>
              ))}
              <Text style={styles.footnote}>
                Only orders placed against this registered customer are shown — walk-in orders entered with a free-text name are not linked to any customer record.
                {data.hiddenOtherWorkshopOrders ? ` ${data.hiddenOtherWorkshopOrders} more order(s) exist at other workshops, not shown here (workshop isolation).` : ''}
              </Text>
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  header: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', ...Shadow.sm,
  },
  customerName: { flex: 1, fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  activeBadge:  { backgroundColor: Colors.successBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  activeBadgeText: { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },
  inactiveBadge:   { backgroundColor: Colors.errorBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  subHeaderRow: { marginBottom: Spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xs },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  notes: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },

  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
  summaryText: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.xs },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  orderNumber:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace' },
  orderProduct: { fontSize: Typography.xs, color: Colors.textSecondary },
  orderMeta:    { fontSize: Typography.xs, color: Colors.textMuted },
  footnote:     { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic', marginTop: Spacing.xs },
});
