import React, { useMemo } from 'react';
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
import { useSawmillList } from '../../hooks/useSawmill';
import { usePolesList }   from '../../hooks/usePoles';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuth }         from '../../hooks/useAuth';
import { DailyLog }        from '../../types/api';
import { PolesProductionStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<PolesProductionStackParamList, 'PolesProductionList'>;

function StockBanner({ availableQty, approvedTotal }: { availableQty: number; approvedTotal: number }) {
  const stockColor = availableQty === 0 ? Colors.error : availableQty < 50 ? Colors.warning : Colors.success;
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: stockColor }]}>{availableQty}</Text>
        <Text style={styles.bannerLabel}>Available Stock</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{approvedTotal}</Text>
        <Text style={styles.bannerLabel}>Total Approved</Text>
      </View>
    </View>
  );
}

function ProductionCard({
  entry, onPress,
}: { entry: DailyLog; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>{entry.date}</Text>
        {entry.machine && <Text style={styles.machineBadge}>{entry.machine}</Text>}
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="cube-outline" size={14} color={Colors.navy} />
          <Text style={styles.statText}>{entry.poles_units} units</Text>
        </View>
        {(entry.poles_waste ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="trash-outline" size={14} color={Colors.warning} />
            <Text style={styles.statText}>{entry.poles_waste} waste</Text>
          </View>
        )}
      </View>
      {entry.remarks && (
        <Text style={styles.remarks} numberOfLines={1}>{entry.remarks}</Text>
      )}
    </TouchableOpacity>
  );
}

// Pole Production Phase 1 — entry point into the new batch+output-lines
// capability (real Finished Pole Inventory + Quality Inspection), reached as
// a stack push from this screen rather than a new tab (matching Sawmill's
// own SawmillTimberInventory/SawmillDashboard pattern).
function ProductionBatchesBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.batchBanner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.batchBannerIcon}>
        <Ionicons name="build-outline" size={20} color={Colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.batchBannerTitle}>Pole Production Batches</Text>
        <Text style={styles.batchBannerSubtitle}>Manufacture pole specs with Quality Inspection &amp; real inventory</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// Pole Production Phase 2 — Purchased Finished Poles + the mobile
// rejection-holds screen Phase 1 deferred. Same stack-push entry-point
// pattern as ProductionBatchesBanner above.
function PurchasedPoleQCBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.batchBanner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.batchBannerIcon}>
        <Ionicons name="cube-outline" size={20} color={Colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.batchBannerTitle}>Purchased Pole QC</Text>
        <Text style={styles.batchBannerSubtitle}>Inspect poles received via Procurement before they enter sellable stock</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function PoleRejectionHoldsBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.batchBanner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.batchBannerIcon}>
        <Ionicons name="refresh-outline" size={20} color={Colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.batchBannerTitle}>Rejection Holds</Text>
        <Text style={styles.batchBannerSubtitle}>Rework, Return, or Resolve rejected poles — manufactured or purchased</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function QueueCard() {
  return (
    <View style={[styles.card, styles.queueCard]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>Poles production entry</Text>
        <View style={styles.syncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={Colors.info} />
          <Text style={styles.syncText}>Pending Sync</Text>
        </View>
      </View>
      <Text style={styles.remarks}>Saved offline — will sync when connected</Text>
    </View>
  );
}

export function PolesProductionScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data: sawmillData, isLoading, isError, refetch, isRefetching } = useSawmillList();
  const { data: polesData } = usePolesList();
  const queue = useOfflineStore((s) => s.queue);

  const productionEntries = useMemo(
    () => (sawmillData?.rows ?? []).filter((r) => (r.poles_units ?? 0) > 0),
    [sawmillData],
  );

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'poles-production' && i.status !== 'failed'),
    [queue],
  );

  if (isLoading) return <LoadingState message="Loading production records…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Poles Production"
        searchModule="production"
        dark
        actions={can('poles.write') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('PolesProductionCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load production records" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={productionEntries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={productionEntries.length + pendingQueue.length === 0
            ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <>
              {polesData && (
                <StockBanner
                  availableQty={polesData.available_qty}
                  approvedTotal={polesData.approved_total}
                />
              )}
              <ProductionBatchesBanner onPress={() => navigation.navigate('PoleBatchList')} />
              <PurchasedPoleQCBanner onPress={() => navigation.navigate('PurchasedPoleQC')} />
              <PoleRejectionHoldsBanner onPress={() => navigation.navigate('PoleRejectionHolds')} />
              {pendingQueue.length > 0 && (
                <View style={styles.pendingSection}>
                  <Text style={styles.pendingSectionTitle}>
                    Pending Sync ({pendingQueue.length})
                  </Text>
                  {pendingQueue.map((q) => <QueueCard key={q.id} />)}
                </View>
              )}
            </>
          }
          ListEmptyComponent={pendingQueue.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No production records"
              subtitle={can('poles.write') ? 'Tap + to log today\'s production.' : 'No records found.'}
            />
          ) : null}
          renderItem={({ item }) => (
            <ProductionCard
              entry={item}
              onPress={() => navigation.navigate('PolesProductionDetail', { entry: item })}
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

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: Colors.border },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold },
  bannerLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  batchBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  batchBannerIcon: {
    width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.navyBg,
    alignItems: 'center', justifyContent: 'center',
  },
  batchBannerTitle:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  batchBannerSubtitle: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },

  pendingSection:      { marginBottom: Spacing.sm },
  pendingSectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.info, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.xs,
  },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  queueCard: { borderWidth: 1, borderColor: Colors.infoBg, borderStyle: 'dashed' },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  machineBadge: {
    fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium,
    backgroundColor: Colors.navyBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.sm, color: Colors.textSecondary },
  remarks:  { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },

  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.infoBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  syncText: { fontSize: Typography.xs, color: Colors.info, fontWeight: Typography.medium },
});
