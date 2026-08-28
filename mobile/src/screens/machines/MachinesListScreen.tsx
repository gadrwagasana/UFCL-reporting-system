import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useMachineList } from '../../hooks/useMachines';
import { Machine, MachineMetrics } from '../../types/api';
import { MachinesStackParamList }   from '../../navigation/types';
import { hasPermission } from '../../utils/permissions';
import { useAuthStore }  from '../../stores/authStore';
import { loadRecentlyViewed, type RecentlyViewedEntry } from '../../utils/storage';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MachinesStackParamList, 'MachinesList'>;

// Phase 2 Workshop parity fix — this screen previously routed search to the
// global search module only, same gap already fixed for Logistics' 4 list
// screens (ListSearchBar + status chips, copied verbatim).
type StatusFilter = '' | Machine['status'];
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Available', label: 'Available' },
  { value: 'Running', label: 'Running' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Breakdown', label: 'Breakdown' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function dateColor(dateStr?: string): string {
  if (!dateStr) return Colors.textSecondary;
  const d = new Date(dateStr);
  const now = new Date();
  if (d <= now) return Colors.error;
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  return days <= 30 ? Colors.warning : Colors.textSecondary;
}

const STATUS_COLOR: Record<string, string> = {
  Available:   Colors.success,
  Running:     Colors.navy,
  Maintenance: Colors.warning,
  Breakdown:   Colors.error,
};

function MetricsBanner({ m }: { m: MachineMetrics }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{m.total}</Text>
        <Text style={styles.bannerLabel}>Total</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: Colors.success }]}>{m.available}</Text>
        <Text style={styles.bannerLabel}>Available</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: Colors.navy }]}>{m.running}</Text>
        <Text style={styles.bannerLabel}>Running</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, m.offline > 0 && { color: Colors.error }]}>{m.offline}</Text>
        <Text style={styles.bannerLabel}>Offline</Text>
      </View>
    </View>
  );
}

function MachineCard({ item, onPress }: { item: Machine; onPress: () => void }) {
  const statusColor = STATUS_COLOR[item.status] ?? Colors.textSecondary;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.code}>{item.machine_code}</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.machineName}>{item.name}</Text>
      <View style={styles.metaRow}>
        <View style={styles.catBadge}>
          <Text style={styles.catText}>{item.category_name}</Text>
        </View>
        {item.workshop_name
          ? <Text style={styles.workshop}>{item.workshop_name}</Text>
          : <Text style={styles.unassigned}>Unassigned</Text>}
      </View>
      {item.next_maintenance ? (
        <View style={styles.maintRow}>
          <Ionicons name="calendar-outline" size={12} color={dateColor(item.next_maintenance)} />
          <Text style={[styles.maintText, { color: dateColor(item.next_maintenance) }]}>
            Next maintenance: {item.next_maintenance.slice(0, 10)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function MachinesListScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);

  const { data, isLoading, isError, refetch, isRefetching } = useMachineList();
  const allMachines = data?.machines   ?? [];
  const metrics      = data?.metrics    ?? { total: 0, available: 0, running: 0, offline: 0 };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const isFiltered = !!search.trim() || !!statusFilter;
  const machines = useMemo(() => {
    let out = allMachines;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((m) =>
        m.machine_code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.plate_number ?? '').toLowerCase().includes(q) ||
        m.category_name.toLowerCase().includes(q) ||
        (m.workshop_name ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((m) => m.status === statusFilter);
    return out;
  }, [allMachines, search, statusFilter]);

  const headerActions = [];
  // Phase 1 Workshop parity fix — desktop's "KPI Performance" NAV page had no
  // mobile equivalent. Available to everyone who can see this list, matching
  // machineKpiPerformance's own backend gate ('machine-kpi' OR 'machines').
  headerActions.push({ icon: 'speedometer-outline' as const, onPress: () => navigation.navigate('MachineKpiPerformance') });
  if (can('machine.cats')) {
    headerActions.push({ icon: 'pricetag-outline' as const, onPress: () => navigation.navigate('MachineCategories') });
  }
  if (can('machine.register')) {
    headerActions.push({ icon: 'add' as const, onPress: () => navigation.navigate('MachineForm', {}) });
  }

  // Stabilization Phase 6 — Recently Viewed widget, mirroring the Phase 3
  // reference implementation on StockTransfersListScreen exactly.
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  useEffect(() => {
    loadRecentlyViewed('machine').then(setRecentlyViewed);
  }, []);

  if (isLoading) return <LoadingState message="Loading machine registry…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Machine Registry" searchModule="machines" dark actions={headerActions} />

      {isError ? (
        <ErrorState message="Could not load machines" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search code, name, plate, category, workshop…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={machines}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={machines.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListHeaderComponent={!isFiltered ? (
              <>
                <MetricsBanner m={metrics} />
                {recentlyViewed.length > 0 && (
                  <View style={styles.recentWrap}>
                    <Text style={styles.recentTitle}><Ionicons name="time-outline" size={12} color={Colors.textMuted} /> Recently Viewed</Text>
                    <View style={styles.recentChips}>
                      {recentlyViewed.map((r) => (
                        <TouchableOpacity
                          key={r.id}
                          style={styles.recentChip}
                          onPress={() => navigation.navigate('MachineDetail', { machineId: Number(r.id) })}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.recentChipText}>{r.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : null}
            ListEmptyComponent={
              <EmptyState
                icon="settings-outline"
                title={isFiltered ? 'No matching machines' : 'No machines'}
                subtitle={isFiltered ? 'Try different search or filter criteria.' : 'No machines registered yet.'}
              />
            }
            renderItem={({ item }) => (
              <MachineCard item={item} onPress={() => navigation.navigate('MachineDetail', { machineId: item.id })} />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: Spacing.base },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginHorizontal: Spacing.base, marginTop: Spacing.base, ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: Colors.border },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  bannerLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code:        { fontFamily: 'monospace', fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  statusBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText:  { fontSize: Typography.xs, fontWeight: Typography.medium },
  machineName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catBadge:    { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  catText:     { fontSize: Typography.xs, color: Colors.textSecondary },
  workshop:    { fontSize: Typography.xs, color: Colors.textMuted },
  unassigned:  { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  maintRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  maintText:   { fontSize: Typography.xs },

  recentWrap: { marginHorizontal: Spacing.base, marginTop: Spacing.sm },
  recentTitle: { fontSize: 10, color: Colors.textMuted, fontWeight: Typography.medium, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  recentChip: {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  recentChipText: { fontSize: Typography.xs, color: Colors.textPrimary },
});
