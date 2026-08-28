import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useHarvestDelays } from '../../hooks/useHarvest';
import { useAuth }       from '../../hooks/useAuth';
import { HarvestDelay }  from '../../types/api';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Harvesting Phase 3 (Workstream 3) — Operational Delay Analysis. Append-only
// log, no edit/delete UI (matches the backend, which deliberately has no
// governance/approval path — the brief forbids introducing a new one here).

type NavProp = NativeStackNavigationProp<HarvestStackParamList, 'HarvestDelays'>;

const CATEGORY_COLOR: Record<string, string> = {
  Weather: Colors.info, 'Equipment Breakdown': Colors.error, 'Transport Unavailable': Colors.warning,
  'Labour Shortage': Colors.warning, 'Safety Stop': Colors.error, Other: Colors.textMuted,
};

function DelayCard({ delay }: { delay: HarvestDelay }) {
  const color = CATEGORY_COLOR[delay.category] ?? Colors.textMuted;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.categoryBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.categoryText, { color }]}>{delay.category}</Text>
        </View>
        <Text style={styles.date}>{delay.created_at}</Text>
      </View>
      <Text style={styles.meta}>
        {delay.compt_name ?? 'General / no compartment'}
        {delay.duration_hours != null ? ` · ${delay.duration_hours}h` : ''}
      </Text>
      {delay.production_impact ? <Text style={styles.impact}>{delay.production_impact}</Text> : null}
      {delay.logged_by_name ? <Text style={styles.loggedBy}>Logged by {delay.logged_by_name}</Text> : null}
    </View>
  );
}

export function HarvestDelaysScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }     = useAuth();
  const canWrite    = can('harvest.write');
  const { data, isLoading, isError, refetch, isRefetching } = useHarvestDelays();
  const [search, setSearch] = useState('');

  // Harvesting Phase 4 (Workstream 5) — client-side search, same shared
  // ListSearchBar used across the app.
  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((r) =>
      r.category.toLowerCase().includes(q) ||
      (r.compt_name ?? '').toLowerCase().includes(q) ||
      (r.production_impact ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  if (isLoading) return <LoadingState message="Loading operational delays…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Operational Delays"
        dark
        onBack={() => navigation.goBack()}
        actions={canWrite ? [{ icon: 'add' as const, label: 'Log delay', onPress: () => navigation.navigate('HarvestDelayForm') }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load operational delays" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.green} />}
          ListHeaderComponent={
            (data?.rows?.length ?? 0) > 1
              ? <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search category, compartment…" />
              : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="alert-circle-outline"
              title={search.trim() ? 'No delays match this search' : 'No delays logged'}
              subtitle={search.trim() ? 'Try a different search term.' : (canWrite ? 'Tap + to record an operational delay.' : 'No delays recorded yet.')}
            />
          }
          renderItem={({ item }) => <DelayCard delay={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  categoryBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  categoryText:  { fontSize: Typography.sm, fontWeight: Typography.semibold },
  date:          { fontSize: Typography.xs, color: Colors.textMuted },

  meta:      { fontSize: Typography.sm, color: Colors.textSecondary },
  impact:    { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  loggedBy:  { fontSize: Typography.xs, color: Colors.textMuted },
});
