import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
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
import { StatusBadge }   from '../../components/StatusBadge';
import { ReasonModal }   from '../../components/ReasonModal';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useHarvestPlans, useHarvestPlanDelete } from '../../hooks/useHarvest';
import { useAuth }       from '../../hooks/useAuth';
import { HarvestPlan }   from '../../types/api';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Harvesting Phase 2 (Workstream 1) — "Planning should become the
// operational starting point." Mirrors HarvestListScreen's structure,
// reusing StatusBadge/ReasonModal exactly as elsewhere in the app.
// Harvesting Phase 4 (Workstream 5) — added client-side search via the
// existing shared ListSearchBar (built for procurement, reused as-is).

type NavProp = NativeStackNavigationProp<HarvestStackParamList, 'HarvestPlanList'>;

const PRIORITY_COLOR: Record<string, string> = {
  urgent: Colors.error, high: Colors.warning, normal: Colors.textMuted, low: Colors.textMuted,
};

function PlanCard({ plan, canWrite, onPress, onDelete }: {
  plan: HarvestPlan; canWrite: boolean; onPress: () => void; onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.speciesBadge}>
          <Text style={styles.speciesText}>{plan.species}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <StatusBadge status={plan.status} size="sm" />
          {canWrite && (
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.statText}>{plan.planned_date}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="flag-outline" size={14} color={PRIORITY_COLOR[plan.priority] ?? Colors.textMuted} />
          <Text style={[styles.statText, { color: PRIORITY_COLOR[plan.priority] ?? Colors.textMuted }]}>
            {plan.priority.charAt(0).toUpperCase() + plan.priority.slice(1)}
          </Text>
        </View>
        {plan.is_delayed && (
          <View style={styles.stat}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
            <Text style={[styles.statText, { color: Colors.error, fontWeight: Typography.semibold }]}>Delayed</Text>
          </View>
        )}
      </View>

      {plan.compt_name ? (
        <Text style={styles.location}>
          <Ionicons name="location-outline" size={12} color={Colors.textMuted} /> {plan.compt_name}
          {plan.sub_name ? ` · ${plan.sub_name}` : ''}
        </Text>
      ) : null}

      {(plan.target_volume_m3 != null || plan.target_logs != null) && (
        <Text style={styles.progress}>
          Progress: {plan.actual_volume_m3} m³{plan.target_volume_m3 != null ? ` / ${plan.target_volume_m3} m³` : ''}
          {plan.target_logs != null ? ` · ${plan.actual_logs} / ${plan.target_logs} logs` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function HarvestPlanListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }     = useAuth();
  const canWrite    = can('harvest.write');
  const { data, isLoading, isError, refetch, isRefetching } = useHarvestPlans();
  const { deletePlan } = useHarvestPlanDelete();

  const [deleteTarget, setDeleteTarget] = useState<HarvestPlan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((r) =>
      r.species.toLowerCase().includes(q) ||
      (r.compt_name ?? '').toLowerCase().includes(q) ||
      (r.sub_name ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  async function handleDelete(reason: string) {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const result = await deletePlan(deleteTarget.id, reason);
      setDeleteTarget(null);
      if (result && 'pendingApproval' in result && result.pendingApproval) {
        Alert.alert('Submitted for Review', result.message);
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading harvest plans…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Harvest Planning"
        dark
        onBack={() => navigation.goBack()}
        actions={canWrite ? [{ icon: 'add' as const, label: 'New plan', onPress: () => navigation.navigate('HarvestPlanForm', {}) }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load harvest plans" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.green} />}
          ListHeaderComponent={
            (data?.rows?.length ?? 0) > 1
              ? <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search species, compartment…" />
              : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={search.trim() ? 'No plans match this search' : 'No harvest plans'}
              subtitle={search.trim() ? 'Try a different search term.' : (canWrite ? 'Tap + to schedule harvesting work.' : 'No plans scheduled yet.')}
            />
          }
          renderItem={({ item }) => (
            <PlanCard
              plan={item}
              canWrite={canWrite}
              onPress={() => canWrite && navigation.navigate('HarvestPlanForm', { plan: item })}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
        />
      )}

      <ReasonModal
        visible={!!deleteTarget}
        title="Delete Harvest Plan"
        message={deleteTarget ? `Delete the plan for ${deleteTarget.species} on ${deleteTarget.planned_date}?` : ''}
        confirmLabel="Delete"
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
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
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  speciesBadge: {
    backgroundColor: Colors.successBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  speciesText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.success },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.sm, color: Colors.textSecondary },

  location: { fontSize: Typography.xs, color: Colors.textMuted },
  progress: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
});
