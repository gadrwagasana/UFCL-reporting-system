import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { useProcurementGoodsReceiptDetail } from '../../hooks/useProcurementOrders';
import { ProcurementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'GoodsReceiptDetail'>;
type RouteType = RouteProp<ProcurementStackParamList, 'GoodsReceiptDetail'>;

// New in Phase 2A — a "view the receipt you just recorded" screen. Reuses
// the pre-existing procurementGoodsReceiptDetail backend function (already
// exposed via the API/IPC bridge but never called from any screen before
// this) so navigating directly here after recording a receipt doesn't
// require any new business logic — see PROCUREMENT_PHASE2A_UI_REPORT.md.
export function GoodsReceiptDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data, isLoading, isError, refetch } = useProcurementGoodsReceiptDetail(params.receiptId);

  if (isLoading || !data) return <LoadingState message="Loading goods receipt…" fullScreen />;
  if (isError) return <ErrorState message="Could not load goods receipt" onRetry={refetch} fullScreen />;

  const { receipt: r, items } = data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={r.receipt_number ?? `Receipt #${r.id}`} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.title}>{r.po_number}</Text>
            <StatusBadge status={r.status} withIcon />
          </View>
          <Text style={styles.meta}>{r.supplier_name}</Text>
          <Text style={styles.meta}>Received {new Date(r.received_at).toLocaleString()}{r.received_by_name ? ` by ${r.received_by_name}` : ''}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Line Items ({items.length})</Text>
          <View style={styles.divider} />
          {items.map((it, i) => (
            <View key={it.id} style={[styles.itemRow, i > 0 && styles.rowDivider]}>
              <Text style={styles.itemDesc}>{it.description ?? 'Item'}</Text>
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMeta}>Received: {it.quantity_received}</Text>
                {Number(it.quantity_rejected) > 0 ? <Text style={[styles.itemMeta, styles.itemMetaRejected]}>Rejected: {it.quantity_rejected}</Text> : null}
              </View>
              {it.rejection_reason ? <Text style={styles.itemReason}>{it.rejection_reason}</Text> : null}
            </View>
          ))}
        </View>

        {r.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <View style={styles.divider} />
            <Text style={styles.notesText}>{r.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, flex: 1 },
  meta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  itemRow: { paddingVertical: Spacing.sm, gap: 2 },
  itemDesc: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  itemMetaRow: { flexDirection: 'row', gap: Spacing.base },
  itemMeta: { fontSize: Typography.xs, color: Colors.textMuted },
  itemMetaRejected: { color: Colors.error, fontWeight: Typography.medium },
  itemReason: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  notesText: { fontSize: Typography.sm, color: Colors.textPrimary },
});
