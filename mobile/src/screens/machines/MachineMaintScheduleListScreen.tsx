import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { ListSearchBar } from '../../components/ListSearchBar';
import { StatusBadge } from '../../components/StatusBadge';
import { useMaintScheduleListAll } from '../../hooks/useMachines';
import { MaintScheduleWithMachine } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Mechanician Phase 2 (Priority 3) — the missing cross-machine Maintenance
// Schedule screen (mobile previously had create-only, no way to view
// existing schedules at all — MECHANICIAN_PHASE2_OPERATIONAL_AUDIT.md §8).
// Read-only: creating/editing schedules stays on desktop's Machine Registry
// overlay for now (unchanged), since only 'machines' holders can do that and
// none of the newly-permissioned roles (mechanician/sawmill-leader/poles-leader)
// hold it — matching the audit's narrower recommended scope.

type StatusFilter = '' | 'overdue' | 'due-soon' | 'ok';
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due Soon' },
  { value: 'ok', label: 'OK' },
];

function rowStatus(r: MaintScheduleWithMachine): StatusFilter {
  if (!r.next_due) return 'ok';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const due = new Date(r.next_due);
  if (due < today) return 'overdue';
  if (due <= soon) return 'due-soon';
  return 'ok';
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScheduleCard({ item }: { item: MaintScheduleWithMachine }) {
  const status = rowStatus(item);
  const statusLabel = status === 'overdue' ? 'Overdue' : status === 'due-soon' ? 'Due Soon' : 'OK';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.machine_code} — {item.machine_name}</Text>
        <StatusBadge status={statusLabel} size="sm" />
      </View>
      <Text style={styles.cardType}>{item.maintenance_type}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>Every {item.frequency_days}d</Text>
        <Text style={styles.metaText}>Last: {item.last_performed ?? '—'}</Text>
        <Text style={[styles.metaText, status === 'overdue' && styles.metaWarn]}>Next: {item.next_due ?? '—'}</Text>
        <Text style={styles.metaText}>Est. {item.estimated_hours}h</Text>
      </View>
      {item.notes ? <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text> : null}
    </View>
  );
}

export function MachineMaintScheduleListScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useMaintScheduleListAll();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const allRows = data?.ok ? data.rows : [];
  const isFiltered = !!search.trim() || !!statusFilter;
  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        r.machine_name.toLowerCase().includes(q) ||
        r.machine_code.toLowerCase().includes(q) ||
        r.maintenance_type.toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((r) => rowStatus(r) === statusFilter);
    return out;
  }, [allRows, search, statusFilter]);

  if (isLoading) return <LoadingState message="Loading maintenance schedules…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Maintenance Schedule" subtitle="Recurring maintenance across every machine in scope" dark />

      {isError ? (
        <ErrorState message="Could not load maintenance schedules" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search machine, type…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title={isFiltered ? 'No matching schedules' : 'No maintenance schedules'}
                subtitle={isFiltered ? 'Try a different search or filter.' : 'Maintenance schedules will appear here once added.'}
              />
            }
            renderItem={({ item }) => <ScheduleCard item={item} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardType: { fontSize: Typography.sm, color: Colors.textSecondary },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
  metaWarn: { color: Colors.error, fontWeight: Typography.semibold },
  notes: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
});
