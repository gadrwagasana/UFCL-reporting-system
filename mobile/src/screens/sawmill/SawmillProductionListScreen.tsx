import React, { useMemo, useState } from 'react';
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
import { ListSearchBar } from '../../components/ListSearchBar';
import { useSawmillList } from '../../hooks/useSawmill';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuth }          from '../../hooks/useAuth';
import { DailyLog }         from '../../types/api';
import { SawmillStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<SawmillStackParamList, 'SawmillProductionList'>;

const TODAY_FMT = format(new Date(), 'dd/MM/yyyy');

function TodayBanner({ data }: { data: ReturnType<typeof useSawmillList>['data'] }) {
  if (!data?.rows?.length) return null;
  const todayRows = data.rows.filter((r) => r.date === TODAY_FMT);
  if (todayRows.length === 0) return null;

  const totalTimber = todayRows.reduce(
    (s, r) => s + (Number(r.timber_kiln_dried ?? 0) + Number(r.timber_cca_treated ?? 0) + Number(r.timber_untreated ?? 0)),
    0,
  );
  const totalWaste = todayRows.reduce((s, r) => s + Number(r.timber_waste ?? 0), 0);

  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{totalTimber}</Text>
        <Text style={styles.bannerLabel}>Timber Today</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{totalWaste}</Text>
        <Text style={styles.bannerLabel}>Waste</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{todayRows.length}</Text>
        <Text style={styles.bannerLabel}>Batches</Text>
      </View>
    </View>
  );
}

function DailyLogCard({
  entry, onPress,
}: { entry: DailyLog; onPress: () => void }) {
  const isToday  = entry.date === TODAY_FMT;
  const timber   = (Number(entry.timber_kiln_dried ?? 0) +
                    Number(entry.timber_cca_treated ?? 0) +
                    Number(entry.timber_untreated ?? 0));

  return (
    <TouchableOpacity style={[styles.card, isToday && styles.cardToday]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>{entry.date}</Text>
        {entry.machine && <Text style={styles.machineBadge}>{entry.machine}</Text>}
      </View>

      <View style={styles.statsRow}>
        {timber > 0 && (
          <View style={styles.stat}>
            <Ionicons name="layers-outline" size={14} color={Colors.navy} />
            <Text style={styles.statText}>{timber} units</Text>
          </View>
        )}
        {(entry.timber_waste ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="trash-outline" size={14} color={Colors.warning} />
            <Text style={styles.statText}>{entry.timber_waste} waste</Text>
          </View>
        )}
        {(entry.logs_received ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="git-merge-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.statText}>{entry.logs_received} logs</Text>
          </View>
        )}
        {(entry.downtime_hours ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={14} color={Colors.error} />
            <Text style={styles.statText}>{entry.downtime_hours}h downtime</Text>
          </View>
        )}
        {(entry.actualVolumeM3 ?? 0) > 0 && (
          <View style={styles.stat}>
            <Ionicons name="cube-outline" size={14} color={Colors.success} />
            <Text style={styles.statText}>{entry.actualVolumeM3!.toFixed(2)} m³</Text>
          </View>
        )}
      </View>

      {entry.product_size && (
        <Text style={styles.productSize}>{entry.product_size}</Text>
      )}
    </TouchableOpacity>
  );
}

function QueueCard() {
  return (
    <View style={[styles.card, styles.queueCard]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>Production entry</Text>
        <View style={styles.syncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={Colors.info} />
          <Text style={styles.syncText}>Pending Sync</Text>
        </View>
      </View>
      <Text style={styles.productSize}>Saved offline — will sync when connected</Text>
    </View>
  );
}

export function SawmillProductionListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  // Sawmill Phase 3 (Workstream 1) — production search; the backend also
  // supports date_from/date_to (see the desktop Daily Timber page), search
  // is the mobile-appropriate minimum (a full date-range picker adds a
  // native dependency this app doesn't otherwise use — see completion report).
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch, isRefetching } = useSawmillList({ search: search.trim() || undefined });
  const queue      = useOfflineStore((s) => s.queue);

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'sawmill' && i.status !== 'failed'),
    [queue],
  );

  if (isLoading) return <LoadingState message="Loading production records…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Sawmill Production"
        searchModule="production"
        dark
        actions={[
          // Sawmill Phase 3 (Workstream 4) — same audience as Timber Inventory
          // (both gated on the production-visibility permission this role tier holds).
          ...(can('timber.inventory') ? [{
            icon: 'speedometer-outline' as const,
            label: 'Dashboard',
            onPress: () => navigation.navigate('SawmillDashboard'),
          }] : []),
          ...(can('timber.inventory') ? [{
            icon: 'layers-outline' as const,
            label: 'Timber Inventory',
            onPress: () => navigation.navigate('SawmillTimberInventory'),
          }] : []),
          ...(can('sawmill.write') ? [{
            icon: 'add' as const,
            onPress: () => navigation.navigate('SawmillProductionCreate'),
          }] : []),
        ]}
      />
      <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search supervisor, operator, machine…" />

      {isError ? (
        <ErrorState message="Could not load production records" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows?.length ?? 0) + pendingQueue.length === 0
            ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <>
              <TodayBanner data={data} />
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
              icon="layers-outline"
              title={search.trim() ? 'No matching records' : 'No production records'}
              subtitle={search.trim()
                ? `No entries match "${search.trim()}".`
                : (can('sawmill.write') ? 'Tap + to log today\'s production.' : 'No records found.')}
            />
          ) : null}
          renderItem={({ item }) => (
            <DailyLogCard
              entry={item}
              onPress={() => navigation.navigate('SawmillProductionDetail', { entry: item })}
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
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  bannerLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  pendingSection:      { marginBottom: Spacing.sm },
  pendingSectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.info, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardToday: { borderLeftWidth: 3, borderLeftColor: Colors.navy },
  queueCard: { borderWidth: 1, borderColor: Colors.infoBg, borderStyle: 'dashed' },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  cardDate:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  machineBadge: {
    fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium,
    backgroundColor: Colors.navyBg ?? '#EEF2FF',
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.sm, color: Colors.textSecondary },

  productSize: { fontSize: Typography.xs, color: Colors.textMuted },

  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.infoBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  syncText: { fontSize: Typography.xs, color: Colors.info, fontWeight: Typography.medium },
});
