import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, SectionList, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { ListSearchBar } from '../../components/ListSearchBar';
import { StatusBadge } from '../../components/StatusBadge';
import { useMaintenanceJobsList, MAINT_JOB_STATUS_LABEL } from '../../hooks/useMaintenanceJobs';
import { MaintenanceJob, MaintenanceJobStatus } from '../../types/api';
import { MaintenanceJobsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MaintenanceJobsStackParamList, 'MaintenanceJobsList'>;
type RouteType = RouteProp<MaintenanceJobsStackParamList, 'MaintenanceJobsList'>;

// Mechanician Phase 3 — mirrors MaterialRequestsListScreen's established
// search/chip/card pattern exactly.

type StatusFilter = '' | MaintenanceJobStatus;
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_parts', label: 'Waiting for Parts' },
  { value: 'external_repair', label: 'External Repair' },
  { value: 'testing', label: 'Testing' },
  { value: 'returned_to_service', label: 'Returned to Service' },
  { value: 'closed', label: 'Closed' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: Colors.error,
  high: Colors.warning,
  normal: Colors.textMuted,
};

function JobCard({ item, onPress }: { item: MaintenanceJob; onPress: () => void }) {
  const priorityColor = PRIORITY_COLOR[item.priority] ?? Colors.textMuted;
  const blocked = item.status === 'waiting_parts' || item.status === 'external_repair';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <StatusBadge status={item.status} label={MAINT_JOB_STATUS_LABEL[item.status]} size="sm" />
      </View>
      <Text style={styles.machine} numberOfLines={1}>{item.machine_code} — {item.machine_name}</Text>
      <View style={styles.cardMeta}>
        {item.priority !== 'normal' ? (
          <Text style={[styles.priority, { color: priorityColor }]}>{item.priority.toUpperCase()}</Text>
        ) : null}
        <Text style={styles.date}>{item.assigned_to_name ? `Assigned: ${item.assigned_to_name}` : 'Unassigned'}</Text>
      </View>
      {blocked && (item.delay_reason || item.external_repair_reason) ? (
        <Text style={styles.blockedNote} numberOfLines={2}>{item.delay_reason || item.external_repair_reason}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// Mechanician Phase 4 (Priority 2) — Work Queue grouping order for the
// default (no search, no status filter) view. Mirrors desktop's
// MAINT_QUEUE_ORDER exactly.
const QUEUE_ORDER: MaintenanceJobStatus[] = ['inspection', 'diagnosis', 'assigned', 'in_progress', 'waiting_parts', 'external_repair', 'testing', 'returned_to_service'];

export function MaintenanceJobsListScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data, isLoading, isError, refetch, isRefetching } = useMaintenanceJobsList();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((params?.initialStatus as StatusFilter) ?? '');

  const allRows = data?.rows ?? [];
  const canManage = data?.canManage ?? false;
  const isFiltered = !!search.trim() || !!statusFilter;
  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.machine_code.toLowerCase().includes(q) ||
        r.machine_name.toLowerCase().includes(q) ||
        (r.assigned_to_name ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((r) => r.status === statusFilter);
    return out;
  }, [allRows, search, statusFilter]);

  // Work Queue is the default landing shape (grouped by status); as soon as
  // the user searches or picks a specific status chip, a flat list of exactly
  // that filter reads more naturally than sections-of-one.
  const sections = useMemo(() => {
    if (isFiltered) return null;
    return QUEUE_ORDER
      .map((status) => ({ title: MAINT_JOB_STATUS_LABEL[status], data: allRows.filter((r) => r.status === status) }))
      .filter((s) => s.data.length > 0);
  }, [allRows, isFiltered]);

  if (isLoading) return <LoadingState message="Loading maintenance jobs…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Maintenance Jobs"
        dark
        actions={[
          // Stabilization Phase 5 (F-28) — mirrors desktop's dedicated
          // "Waiting for Parts" view (enriched with linked material
          // request/transfer status), available to anyone who can see jobs.
          { icon: 'hourglass-outline', label: 'Waiting for parts', onPress: () => navigation.navigate('MaintenanceWaitingForParts') },
          ...(canManage ? [{ icon: 'add' as const, label: 'New job', onPress: () => navigation.navigate('MaintenanceJobCreate') }] : []),
        ]}
      />

      {isError ? (
        <ErrorState message="Could not load maintenance jobs" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search title, machine, technician…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          {sections ? (
            <SectionList
              sections={sections}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.list}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
              stickySectionHeadersEnabled={false}
              ListEmptyComponent={
                <EmptyState icon="construct-outline" title="No maintenance jobs" subtitle="Jobs assigned to you will appear here." />
              }
              renderSectionHeader={({ section }) => (
                <Text style={styles.queueSectionHeader}>{section.title} <Text style={styles.widgetCount}>({section.data.length})</Text></Text>
              )}
              renderItem={({ item }) => (
                <JobCard item={item} onPress={() => navigation.navigate('MaintenanceJobDetail', { jobId: item.id })} />
              )}
            />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
              ListEmptyComponent={
                <EmptyState
                  icon="construct-outline"
                  title="No matching jobs"
                  subtitle="Try a different search or filter."
                />
              }
              renderItem={({ item }) => (
                <JobCard item={item} onPress={() => navigation.navigate('MaintenanceJobDetail', { jobId: item.id })} />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  queueSectionHeader: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  widgetCount: { color: Colors.textMuted, fontWeight: Typography.medium, textTransform: 'none', letterSpacing: 0 },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  machine: { fontSize: Typography.sm, color: Colors.textSecondary },
  cardMeta: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  priority: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  date: { fontSize: Typography.xs, color: Colors.textMuted },
  blockedNote: { fontSize: Typography.sm, color: Colors.error, fontStyle: 'italic' },
});
