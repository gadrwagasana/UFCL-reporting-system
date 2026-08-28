import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { StatusBadge }  from '../../components/StatusBadge';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useMaterialRequests } from '../../hooks/useMaterialRequests';
import { useOfflineStore }    from '../../stores/offlineStore';
import { useAuth }            from '../../hooks/useAuth';
import { MaterialRequest }    from '../../types/api';
import { MaterialRequestsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MaterialRequestsStackParamList, 'MaterialRequestsList'>;

// Phase 2 Workshop parity fix — this screen previously routed search to the
// global search module only.
type StatusFilter = '' | MaterialRequest['status'];
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'partial', label: 'Partial' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent:   Colors.warning,
  critical: Colors.error,
  normal:   Colors.textMuted,
};

// UI/UX redesign helpers — request number + overdue flag + linked-transfer
// badge (read-only; Stock Transfer remains the sole owner of that data).
function mrNum(id: number) { return `MR-${String(id).padStart(6, '0')}`; }
function mrOverdue(item: MaterialRequest) {
  if (!item.needed_by || item.status === 'completed' || item.status === 'rejected') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(item.needed_by) < today;
}
const TRANSFER_LABEL: Record<string, string> = {
  approved: 'Transfer Created', in_transit: 'In Transit', partially_received: 'Partial',
  completed: 'Completed', completed_with_discrepancy: 'Completed (Short)',
};
const TRANSFER_COLOR: Record<string, string> = {
  approved: Colors.info, in_transit: Colors.statusInTransitText, partially_received: Colors.warning,
  completed: Colors.success, completed_with_discrepancy: Colors.error,
};

function RequestCard({ item, onPress }: { item: MaterialRequest; onPress: () => void }) {
  const priorityColor = PRIORITY_COLOR[item.priority] ?? Colors.textMuted;
  const overdue = mrOverdue(item);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mrNum}>{mrNum(item.id)}</Text>
          <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.qty}>Qty: {item.requested_qty}{item.uom ? ` ${item.uom}` : ''}</Text>
        {item.approved_qty != null ? (
          <Text style={styles.approvedQty}> · Approved: {item.approved_qty}</Text>
        ) : null}
        {item.priority !== 'normal' ? (
          <Text style={[styles.priority, { color: priorityColor }]}> · {item.priority.toUpperCase()}</Text>
        ) : null}
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.date}>{item.requested_at}</Text>
        {item.needed_by ? (
          <Text style={[styles.date, overdue && { color: Colors.error, fontWeight: Typography.semibold }]}>
            {' '}· Needed by {new Date(item.needed_by).toLocaleDateString()}{overdue ? ' (overdue)' : ''}
          </Text>
        ) : null}
      </View>
      {item.transfer_id ? (
        <View style={[styles.transferBadge, { backgroundColor: (TRANSFER_COLOR[item.transfer_status ?? ''] ?? Colors.textMuted) + '18' }]}>
          <Ionicons name="swap-horizontal-outline" size={11} color={TRANSFER_COLOR[item.transfer_status ?? ''] ?? Colors.textMuted} />
          <Text style={[styles.transferBadgeText, { color: TRANSFER_COLOR[item.transfer_status ?? ''] ?? Colors.textMuted }]}>
            {TRANSFER_LABEL[item.transfer_status ?? ''] ?? item.transfer_status}
          </Text>
        </View>
      ) : null}
      {item.review_notes ? (
        <Text style={styles.reviewNote} numberOfLines={2}>Note: {item.review_notes}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function QueueCard({ context }: { context: string }) {
  return (
    <View style={[styles.card, styles.queueCard]}>
      <View style={styles.cardTop}>
        <Text style={styles.itemName}>{context}</Text>
        <View style={styles.syncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={Colors.info} />
          <Text style={styles.syncText}>Pending Sync</Text>
        </View>
      </View>
      <Text style={styles.date}>Saved offline — will sync when connected</Text>
    </View>
  );
}

export function MaterialRequestsListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useMaterialRequests();
  const queue      = useOfflineStore((s) => s.queue);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'material-request' && i.status !== 'failed'),
    [queue],
  );

  const allRows = data?.rows ?? [];
  const isFiltered = !!search.trim() || !!statusFilter;
  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        r.item_name.toLowerCase().includes(q) ||
        (r.workshop_name ?? '').toLowerCase().includes(q) ||
        (r.reason ?? '').toLowerCase().includes(q) ||
        (r.requested_by ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((r) => r.status === statusFilter);
    return out;
  }, [allRows, search, statusFilter]);

  if (isLoading) return <LoadingState message="Loading material requests…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Material Requests"
        searchModule="material_requests"
        dark
        actions={can('material.request') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('MaterialRequestCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load requests" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search item, workshop, reason, requester…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length + pendingQueue.length === 0
              ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListHeaderComponent={(!isFiltered && pendingQueue.length > 0) ? (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingSectionTitle}>Pending Sync ({pendingQueue.length})</Text>
                {pendingQueue.map((q) => <QueueCard key={q.id} context={q.body.item_id ? `Item #${q.body.item_id} · Qty ${q.body.requested_qty}` : 'Material request'} />)}
              </View>
            ) : null}
            ListEmptyComponent={
              <EmptyState
                icon="cube-outline"
                title={isFiltered ? 'No matching requests' : 'No requests yet'}
                subtitle={isFiltered ? 'Try different search or filter criteria.' : (can('material.request') ? 'Tap + to submit a new material request.' : 'No material requests for your workshop.')}
              />
            }
            renderItem={({ item }) => (
              <RequestCard
                item={item}
                onPress={() => navigation.navigate('MaterialRequestDetail', { item })}
              />
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
  emptyContainer: { flex: 1, justifyContent: 'center' },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  pendingSection: { marginBottom: Spacing.md },
  pendingSectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.info,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  queueCard: {
    borderWidth: 1,
    borderColor: Colors.infoBg,
    borderStyle: 'dashed',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  mrNum: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  itemName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  transferBadgeText: {
    fontSize: 10,
    fontWeight: Typography.semibold,
  },
  qty: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  approvedQty: {
    fontSize: Typography.sm,
    color: Colors.success,
  },
  priority: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
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
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  syncText: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: Typography.medium,
  },
});
