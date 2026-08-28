import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useTransportJobsList, useTransportJobDelete } from '../../hooks/useTransport';
import { TransportJob } from '../../types/api';
import { TransportJobsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Phase 1 Logistics fix — Transport Jobs had full CRUD on desktop but no
// mobile screen at all.
type NavProp = NativeStackNavigationProp<TransportJobsStackParamList, 'TransportJobsList'>;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Scheduled:  { bg: '#DBEAFE', text: '#1E40AF' },
  'In Transit': { bg: '#FEF3C7', text: '#92400E' },
  Completed:  { bg: '#DCFCE7', text: '#166534' },
  Cancelled:  { bg: '#FEE2E2', text: '#991B1B' },
};

type StatusFilter = '' | TransportJob['status'];
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function JobCard({ job, onPress, onDelete }: { job: TransportJob; onPress: () => void; onDelete: () => void }) {
  const statusStyle = STATUS_COLORS[job.status] ?? STATUS_COLORS.Scheduled;
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.jobNumber}>{job.job_number}</Text>
        <View style={[s.badge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[s.badgeText, { color: statusStyle.text }]}>{job.status}</Text>
        </View>
      </View>
      <Text style={s.route} numberOfLines={1}>{job.origin ?? '—'} → {job.destination ?? '—'}</Text>
      <View style={s.metaRow}>
        <Text style={s.metaText}>{job.carrier_type === 'Own Vehicle' ? (job.vehicle_registration ?? 'Own vehicle') : (job.company_name ?? '—')}</Text>
        {job.quantity != null ? <Text style={s.metaText}>{job.quantity} {job.uom ?? ''}</Text> : null}
        {job.cost != null ? <Text style={s.metaText}>{job.cost.toLocaleString()}</Text> : null}
      </View>
      {job.job_date ? <Text style={s.date}>{job.job_date}</Text> : null}
      <TouchableOpacity style={s.deleteBtn} onPress={onDelete} hitSlop={8}>
        <Text style={s.deleteText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function TransportJobsListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useTransportJobsList();
  const deleteMutation = useTransportJobDelete();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const allJobs = data?.rows ?? [];
  const isFiltered = !!search.trim() || !!statusFilter;
  const jobs = useMemo(() => {
    let out = allJobs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((j) =>
        j.job_number.toLowerCase().includes(q) ||
        (j.company_name ?? '').toLowerCase().includes(q) ||
        (j.vehicle_registration ?? '').toLowerCase().includes(q) ||
        (j.waybill_ref ?? '').toLowerCase().includes(q) ||
        (j.origin ?? '').toLowerCase().includes(q) ||
        (j.destination ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((j) => j.status === statusFilter);
    return out;
  }, [allJobs, search, statusFilter]);

  if (isLoading) return <LoadingState message="Loading transport jobs…" fullScreen />;

  function handleDelete(job: TransportJob) {
    Alert.alert('Delete job?', `Delete job "${job.job_number}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const res = await deleteMutation.mutateAsync({ id: job.id });
            if ((res as any).pendingApproval) {
              Alert.alert('Submitted for approval', (res as any).message ?? 'This action requires manager approval.');
            } else if (!res.ok) {
              Alert.alert('Could not delete', (res as any).error ?? 'Unknown error');
            }
          } catch {
            Alert.alert('Error', 'Could not delete transport job.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Transport Jobs"
        dark
        actions={[{ icon: 'add-outline', onPress: () => navigation.navigate('TransportJobForm', {}) }]}
      />
      {isError ? (
        <ErrorState message="Could not load transport jobs" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search job #, carrier, waybill, route…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={jobs}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={jobs.length === 0 ? s.emptyContainer : s.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListHeaderComponent={
              !isFiltered ? <Text style={s.capNote}>Showing the {jobs.length} most recent jobs.</Text> : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="swap-horizontal-outline"
                title={isFiltered ? 'No matching jobs' : 'No transport jobs'}
                subtitle={isFiltered ? 'Try different search or filter criteria.' : 'No transport jobs logged yet. Tap + to log one.'}
              />
            }
            renderItem={({ item }) => (
              <JobCard
                job={item}
                onPress={() => navigation.navigate('TransportJobForm', { job: item })}
                onDelete={() => handleDelete(item)}
              />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  capNote: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.xs },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobNumber: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  route: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
  date: { fontSize: Typography.xs, color: Colors.textMuted },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: 11, fontWeight: Typography.semibold },

  deleteBtn: { alignSelf: 'flex-end', marginTop: 4 },
  deleteText: { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },
});
