import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons }              from '@expo/vector-icons';
import { AppHeader }             from '../../components/AppHeader';
import { LoadingState }          from '../../components/LoadingState';
import { ErrorState }            from '../../components/ErrorState';
import { TransferStatusBadge }   from '../../components/TransferStatusBadge';
import { useStockTransferHistory } from '../../hooks/useStockTransfers';
import type { StockTransfersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = NativeStackScreenProps<StockTransfersStackParamList, 'StockTransferDetail'>;

// ── Section header ─────────────────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

// ── Info row ───────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{String(value)}</Text>
    </View>
  );
}

export function StockTransferDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Props['route']>();
  const { data, isLoading, isError, refetch, isRefetching } = useStockTransferHistory(params.transferId);

  if (isLoading) return <LoadingState message="Loading transfer details…" fullScreen />;
  if (isError || !data?.transfer) {
    return <ErrorState message="Could not load transfer details" onRetry={refetch} fullScreen />;
  }

  const { transfer, dispatches } = data;

  const totalDispatched = dispatches.reduce((sum, d) => sum + d.qty, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Transfer Detail" onBack={() => navigation.goBack()} dark />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {/* Header card */}
        <View style={s.card}>
          <View style={s.cardTopRow}>
            <View>
              {transfer.reference && (
                <Text style={s.reference}>{transfer.reference}</Text>
              )}
              {transfer.transfer_ref && transfer.transfer_ref !== transfer.reference && (
                <Text style={s.reference}>{transfer.transfer_ref}</Text>
              )}
              <Text style={s.dateText}>{transfer.requested_at}</Text>
            </View>
            <TransferStatusBadge status={transfer.status} />
          </View>

          <Text style={s.itemName}>{transfer.item_name}</Text>
          <Text style={s.category}>{transfer.category}</Text>

          <View style={s.routeRow}>
            <View style={s.routeBox}>
              <Ionicons name="business-outline" size={14} color={Colors.textMuted} />
              <Text style={s.routeLabel} numberOfLines={2}>{transfer.from_warehouse_name}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={Colors.navy} />
            <View style={s.routeBox}>
              <Ionicons name="business-outline" size={14} color={Colors.textMuted} />
              <Text style={s.routeLabel} numberOfLines={2}>{transfer.to_warehouse_name}</Text>
            </View>
          </View>
        </View>

        {/* Quantities */}
        <View style={s.card}>
          <SectionTitle title="Quantities" />
          <View style={s.qtyGrid}>
            <View style={s.qtyStat}>
              <Text style={s.qtyValue}>{transfer.requested_qty.toLocaleString()}</Text>
              <Text style={s.qtyLabel}>Requested</Text>
            </View>
            <View style={s.qtyStat}>
              <Text style={[s.qtyValue, { color: Colors.navy }]}>{totalDispatched.toLocaleString()}</Text>
              <Text style={s.qtyLabel}>Dispatched</Text>
            </View>
            <View style={s.qtyStat}>
              <Text style={[s.qtyValue, { color: Colors.success }]}>{transfer.received_qty.toLocaleString()}</Text>
              <Text style={s.qtyLabel}>Received</Text>
            </View>
          </View>
          <Text style={s.uomTag}>{transfer.uom}</Text>

          {transfer.status === 'rejected' && transfer.rejection_reason && (
            <View style={s.rejectionBox}>
              <Text style={s.rejectionLabel}>Rejection reason</Text>
              <Text style={s.rejectionText}>{transfer.rejection_reason}</Text>
            </View>
          )}
        </View>

        {/* People / timeline */}
        <View style={s.card}>
          <SectionTitle title="Timeline" />
          <InfoRow label="Requested by"   value={transfer.requested_by} />
          <InfoRow label="Requested at"   value={transfer.requested_at} />
          <InfoRow label="Approved by"    value={transfer.approved_by} />
          <InfoRow label="Approved at"    value={transfer.approved_at} />
        </View>

        {/* Dispatch events */}
        {dispatches.length > 0 && (
          <View style={s.card}>
            <SectionTitle title={`Dispatch Events (${dispatches.length})`} />
            {dispatches.map((d, i) => (
              <View key={d.id} style={[s.dispatchRow, i < dispatches.length - 1 && s.dispatchDivider]}>
                <View style={s.dispatchHeader}>
                  <Ionicons name="car-outline" size={14} color={Colors.navy} />
                  <Text style={s.dispatchQty}>{d.qty.toLocaleString()} {transfer.uom}</Text>
                  <Text style={s.dispatchDate}>{d.dispatched_at}</Text>
                </View>
                {d.registration && (
                  <Text style={s.dispatchDetail}>Vehicle: {d.vehicle_label} ({d.registration})</Text>
                )}
                {d.driver_name && (
                  <Text style={s.dispatchDetail}>Driver: {d.driver_name}</Text>
                )}
                {d.reference && (
                  <Text style={s.dispatchDetail}>Waybill: {d.reference}</Text>
                )}
                {d.dispatched_by_name && (
                  <Text style={s.dispatchDetail}>By: {d.dispatched_by_name}</Text>
                )}
                {d.notes && (
                  <Text style={s.dispatchNotes}>{d.notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {transfer.notes && (
          <View style={s.card}>
            <SectionTitle title="Notes" />
            <Text style={s.notesText}>{transfer.notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, gap: Spacing.xs,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reference:  { fontSize: Typography.xs, fontFamily: 'monospace', color: Colors.textMuted },
  dateText:   { fontSize: 11, color: Colors.textMuted },
  itemName:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: Spacing.xs },
  category:   { fontSize: Typography.xs, color: Colors.textMuted },

  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  routeBox:  { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  routeLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.xs,
  },

  qtyGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.xs },
  qtyStat: { alignItems: 'center', gap: 2 },
  qtyValue:{ fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },
  qtyLabel:{ fontSize: 11, color: Colors.textMuted },
  uomTag:  { textAlign: 'center', fontSize: Typography.xs, color: Colors.textMuted },

  rejectionBox:  { backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm, gap: 3, marginTop: Spacing.xs },
  rejectionLabel:{ fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.error },
  rejectionText: { fontSize: Typography.xs, color: Colors.error, fontStyle: 'italic' },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  infoLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  infoValue: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium, textAlign: 'right', flex: 1, marginLeft: Spacing.sm },

  dispatchRow:    { paddingVertical: Spacing.sm, gap: 3 },
  dispatchDivider:{ borderBottomWidth: 1, borderBottomColor: Colors.border },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dispatchQty:    { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace' },
  dispatchDate:   { fontSize: 11, color: Colors.textMuted, marginLeft: 'auto' },
  dispatchDetail: { fontSize: Typography.xs, color: Colors.textSecondary, marginLeft: Spacing.lg },
  dispatchNotes:  { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic', marginLeft: Spacing.lg },

  notesText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
