import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { StatusBadge }  from '../../components/StatusBadge';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { useMaterialRequests } from '../../hooks/useMaterialRequests';
import { useCasualLabour }     from '../../hooks/useCasualLabour';
import { MyRequestsResponse, MyRequest, MaterialRequest, CasualLabourRequest } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// ─── Unified timeline item ────────────────────────────────────────────────────

type TimelineKind = 'material' | 'labour' | 'other';

interface TimelineItem {
  id:          string;
  kind:        TimelineKind;
  title:       string;
  subtitle?:   string;
  status:      string;
  sortKey:     string;    // ISO or formatted date for sorting
  displayDate: string;
  reviewNotes?: string;
}

function fromMyRequest(r: MyRequest & { kind: 'edit' | 'delete' }): TimelineItem {
  return {
    id:          `other-${r.id}-${r.kind}`,
    kind:        'other',
    title:       r.entity_ref,
    subtitle:    `${r.action_type} · ${r.entity_type}`,
    status:      r.status,
    sortKey:     r.submitted_at,
    displayDate: r.submitted_at,
    reviewNotes: r.review_notes,
  };
}

function fromMaterial(r: MaterialRequest): TimelineItem {
  return {
    id:          `material-${r.id}`,
    kind:        'material',
    title:       r.item_name,
    subtitle:    `Qty ${r.requested_qty}${r.uom ? ` ${r.uom}` : ''}${r.approved_qty != null ? ` · Approved: ${r.approved_qty}` : ''}`,
    status:      r.status,
    sortKey:     r.requested_at,
    displayDate: r.requested_at,
    reviewNotes: r.review_notes,
  };
}

function fromLabour(r: CasualLabourRequest): TimelineItem {
  return {
    id:          `labour-${r.id}`,
    kind:        'labour',
    title:       r.task,
    subtitle:    `${r.num_casuals} casuals · ${r.start_fmt ?? r.start_date} – ${r.end_fmt ?? r.end_date}`,
    status:      r.status,
    sortKey:     r.created_fmt ?? r.start_date,
    displayDate: r.created_fmt ?? r.start_date,
  };
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

type Filter = 'all' | 'material' | 'labour' | 'other';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'material', label: 'Materials' },
  { key: 'labour',   label: 'Labour' },
  { key: 'other',    label: 'Other' },
];

const KIND_LABEL: Record<TimelineKind, string> = {
  material: 'Material',
  labour:   'Labour',
  other:    'Submission',
};

// ─── Card ─────────────────────────────────────────────────────────────────────

function TimelineCard({ item }: { item: TimelineItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.kindPip, styles[`pip_${item.kind}`]]} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>
      {item.subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>{item.subtitle}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.kindLabel}>{KIND_LABEL[item.kind]}</Text>
        <Text style={styles.date}>{item.displayDate}</Text>
      </View>
      {item.reviewNotes ? (
        <Text style={styles.reviewNote} numberOfLines={2}>Note: {item.reviewNotes}</Text>
      ) : null}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function MyRequestsScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const {
    data: editData,
    isLoading: editLoading,
    isError: editError,
    refetch: refetchEdits,
    isRefetching: editRefetching,
  } = useQuery<MyRequestsResponse>({
    queryKey:  ['my-requests'],
    queryFn:   () => get<MyRequestsResponse>(EP.MY_REQUESTS),
    staleTime: 2 * 60_000,
  });

  const {
    data: materialData,
    isLoading: matLoading,
    isError: matError,
    refetch: refetchMat,
    isRefetching: matRefetching,
  } = useMaterialRequests();

  const {
    data: labourData,
    isLoading: labourLoading,
    isError: labourError,
    refetch: refetchLabour,
    isRefetching: labourRefetching,
  } = useCasualLabour();

  const isLoading    = editLoading || matLoading || labourLoading;
  const isRefetching = editRefetching || matRefetching || labourRefetching;
  const hasError     = editError && matError && labourError;

  const all: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const r of editData?.edits ?? []) items.push(fromMyRequest({ ...r, kind: 'edit' }));
    for (const r of editData?.deletions ?? []) items.push(fromMyRequest({ ...r, kind: 'delete' }));
    for (const r of materialData?.rows ?? []) items.push(fromMaterial(r));
    for (const r of labourData?.rows ?? []) items.push(fromLabour(r));
    return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [editData, materialData, labourData]);

  const filtered = useMemo(
    () => filter === 'all' ? all : all.filter((i) => i.kind === filter),
    [all, filter],
  );

  async function refetchAll() {
    await Promise.all([refetchEdits(), refetchMat(), refetchLabour()]);
  }

  if (isLoading) return <LoadingState message="Loading your requests…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="My Requests" />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? all.length : all.filter((i) => i.kind === f.key).length;
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {hasError ? (
        <ErrorState message="Could not load requests" onRetry={refetchAll} fullScreen />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchAll}
              tintColor={Colors.navy}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={filter === 'all' ? 'No requests yet' : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} requests`}
              subtitle="Your submitted requests will appear here."
            />
          }
          renderItem={({ item }) => <TimelineCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  filterBar: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  chipText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  kindPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  pip_material: { backgroundColor: Colors.navy },
  pip_labour:   { backgroundColor: Colors.green },
  pip_other:    { backgroundColor: Colors.orange },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kindLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  date: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  reviewNote: {
    fontSize: Typography.sm,
    color: Colors.warning,
    fontStyle: 'italic',
  },
});
