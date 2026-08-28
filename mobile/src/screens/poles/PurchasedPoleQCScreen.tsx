import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { usePendingPoleQC } from '../../hooks/usePoles';
import { PendingPoleQCItem } from '../../types/api';
import { PolesProductionStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Pole Production Phase 2 — Purchased Finished Poles. A goods-receipt line
// procurementGoodsReceiptCreate flagged qc_status='pending_qc' (its stock
// item's catalog category is 'Finished Poles') is held here instead of
// posting straight to stock — this is the queue/action for that hold, same
// shape as PoleBatchListScreen's per-output Inspect flow for manufactured
// poles, just with no batch/output nesting (one row per receipt line).

type NavProp = NativeStackNavigationProp<PolesProductionStackParamList, 'PurchasedPoleQC'>;

function PendingLineCard({ item, onInspect }: { item: PendingPoleQCItem; onInspect: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{item.description || 'Purchased pole'}</Text>
        <Text style={styles.qtyBadge}>{item.quantity_received} pcs</Text>
      </View>
      <Text style={styles.meta}>{item.po_number} · {item.supplier_name}</Text>
      {item.workshop_name && <Text style={styles.meta}>{item.workshop_name}</Text>}
      <TouchableOpacity style={styles.inspectBtn} onPress={onInspect}>
        <Ionicons name="checkmark-circle-outline" size={14} color={Colors.white} />
        <Text style={styles.inspectBtnText}>Inspect</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PurchasedPoleQCScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = usePendingPoleQC();

  const rows = data?.rows ?? [];

  if (isLoading) return <LoadingState message="Loading pending inspections…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Purchased Pole QC" dark onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load pending inspections" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={rows.length > 0 ? (
            <Text style={styles.intro}>
              Poles received via Procurement don't enter sellable stock until inspected — the same gate manufactured poles go through.
            </Text>
          ) : null}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              title="Nothing awaiting inspection"
              subtitle="Purchased pole deliveries needing Quality Inspection will appear here."
            />
          }
          renderItem={({ item }) => (
            <PendingLineCard
              item={item}
              onInspect={() => navigation.navigate('PurchasedPoleQCInspect', { item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  intro:          { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.sm },

  card:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  qtyBadge: {
    fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium,
    backgroundColor: Colors.navyBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  meta: { fontSize: Typography.sm, color: Colors.textSecondary },

  inspectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, marginTop: Spacing.xs,
  },
  inspectBtnText: { fontSize: Typography.sm, color: Colors.white, fontWeight: Typography.medium },
});
