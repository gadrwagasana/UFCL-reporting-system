import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { useHarvestList } from '../../hooks/useHarvest';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuth }         from '../../hooks/useAuth';
import { HarvestEntry }    from '../../types/api';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<HarvestStackParamList, 'HarvestList'>;

const TODAY_FMT = format(new Date(), 'dd/MM/yyyy');

function SummaryBanner({ data }: { data: ReturnType<typeof useHarvestList>['data'] }) {
  if (!data?.summary) return null;
  const species = Object.entries(data.summary);
  if (species.length === 0) return null;
  const todayTrees = (data.rows ?? [])
    .filter((r) => r.harvest_date === TODAY_FMT)
    .reduce((s, r) => s + Number(r.quantity), 0);
  const todayLogs = (data.rows ?? [])
    .filter((r) => r.harvest_date === TODAY_FMT)
    .reduce((s, r) => s + Number(r.logs_crosscut ?? 0), 0);

  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{todayTrees}</Text>
        <Text style={styles.bannerLabel}>Trees Today</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{todayLogs}</Text>
        <Text style={styles.bannerLabel}>Logs Today</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{species.length}</Text>
        <Text style={styles.bannerLabel}>Species</Text>
      </View>
    </View>
  );
}

function EntryCard({ entry, onPress }: { entry: HarvestEntry; onPress: () => void }) {
  const isToday = entry.harvest_date === TODAY_FMT;
  return (
    <TouchableOpacity style={[styles.card, isToday && styles.cardToday]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.speciesBadge}>
          <Text style={styles.speciesText}>{entry.species}</Text>
        </View>
        <Text style={styles.date}>{entry.harvest_date}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="leaf-outline" size={14} color={Colors.green} />
          <Text style={styles.statText}>{entry.quantity} {entry.uom ?? 'trees'}</Text>
        </View>
        {(entry.logs_crosscut ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="git-merge-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.statText}>{entry.logs_crosscut} crosscut</Text>
          </View>
        )}
        {(entry.logs_handrolled ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="hand-right-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.statText}>{entry.logs_handrolled} handrolled</Text>
          </View>
        )}
      </View>
      {entry.compt_name ? (
        <Text style={styles.location}>
          <Ionicons name="location-outline" size={12} color={Colors.textMuted} /> {entry.compt_name}
          {entry.sub_name ? ` · ${entry.sub_name}` : ''}
        </Text>
      ) : entry.location ? (
        <Text style={styles.location}>{entry.location}</Text>
      ) : null}
      {entry.notes ? <Text style={styles.notes} numberOfLines={1}>{entry.notes}</Text> : null}
    </TouchableOpacity>
  );
}

function QueueCard() {
  return (
    <View style={[styles.card, styles.queueCard]}>
      <View style={styles.cardTop}>
        <Text style={styles.speciesText}>Harvest entry</Text>
        <View style={styles.syncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={Colors.info} />
          <Text style={styles.syncText}>Pending Sync</Text>
        </View>
      </View>
      <Text style={styles.notes}>Saved offline — will sync when connected</Text>
    </View>
  );
}

export function HarvestListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHarvestList();
  const queue      = useOfflineStore((s) => s.queue);

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'harvest' && i.status !== 'failed'),
    [queue],
  );

  if (isLoading) return <LoadingState message="Loading harvest entries…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Harvest Log"
        searchModule="production"
        dark
        actions={[
          // Harvesting Phase 1 (Workstream 2) — read-only, available to
          // anyone who can see this list at all (not gated on harvest.write,
          // which only governs mutating actions).
          { icon: 'stats-chart-outline' as const, label: 'Harvest dashboard', onPress: () => navigation.navigate('HarvestDashboard') },
          // Harvesting Phase 2 (Workstream 1) — read-only entry point too;
          // HarvestPlanListScreen itself gates its own "New plan"/edit/delete
          // actions on harvest.write.
          { icon: 'calendar-outline' as const, label: 'Harvest planning', onPress: () => navigation.navigate('HarvestPlanList') },
          // Enterprise Timber Lifecycle Integration Program — Phase 1
          { icon: 'trash-outline' as const, label: 'Harvest waste', onPress: () => navigation.navigate('HarvestWaste') },
          ...(can('harvest.write') ? [{ icon: 'add' as const, label: 'Log harvest', onPress: () => navigation.navigate('HarvestCreate') }] : []),
        ]}
      />

      {isError ? (
        <ErrorState message="Could not load harvest entries" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows?.length ?? 0) + pendingQueue.length === 0
            ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.green} />}
          ListHeaderComponent={
            <>
              <SummaryBanner data={data} />
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
              icon="leaf-outline"
              title="No harvest entries"
              subtitle={can('harvest.write') ? 'Tap + to log today\'s harvest.' : 'No entries for your workshop.'}
            />
          ) : null}
          renderItem={({ item }) => (
            <EntryCard
              entry={item}
              onPress={() => navigation.navigate('HarvestDetail', { entry: item })}
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
    flexDirection: 'row',
    backgroundColor: Colors.green,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  bannerLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  pendingSection: { marginBottom: Spacing.sm },
  pendingSectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.info, textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardToday: { borderLeftWidth: 3, borderLeftColor: Colors.green },
  queueCard: { borderWidth: 1, borderColor: Colors.infoBg, borderStyle: 'dashed' },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  speciesBadge: {
    backgroundColor: Colors.successBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  speciesText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.success },
  date:        { fontSize: Typography.xs, color: Colors.textMuted },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.sm, color: Colors.textSecondary },

  location: { fontSize: Typography.xs, color: Colors.textMuted },
  notes:    { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },

  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.infoBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  syncText: { fontSize: Typography.xs, color: Colors.info, fontWeight: Typography.medium },
});
