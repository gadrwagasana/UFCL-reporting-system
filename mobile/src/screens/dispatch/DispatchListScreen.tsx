import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }   from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ReasonModal }  from '../../components/ReasonModal';
import {
  useDispatchList, useDispatchReview, useDispatchDelete,
} from '../../hooks/useDispatch';
import { useAuthStore }   from '../../stores/authStore';
import { hasPermission }  from '../../utils/permissions';
import type { DispatchRequest } from '../../types/api';
import type { DispatchStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<DispatchStackParamList, 'DispatchList'>;

const DISPATCHED_CLR = '#7C3AED';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Pending:    Colors.warning,
  Approved:   Colors.success,
  Dispatched: DISPATCHED_CLR,
  Rejected:   Colors.error,
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? Colors.textMuted;
  return (
    <View style={[s.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

// ── KPI banner ────────────────────────────────────────────────────────────────
function MetricsBanner({ rows }: { rows: DispatchRequest[] }) {
  const pending    = rows.filter(r => r.status === 'Pending').length;
  const approved   = rows.filter(r => r.status === 'Approved').length;
  const dispatched = rows.filter(r => r.status === 'Dispatched').length;
  const rejected   = rows.filter(r => r.status === 'Rejected').length;
  return (
    <View style={s.banner}>
      <View style={s.stat}>
        <Text style={[s.statValue, pending > 0 && { color: Colors.warning }]}>{pending}</Text>
        <Text style={s.statLabel}>Pending</Text>
      </View>
      <View style={s.stat}>
        <Text style={[s.statValue, { color: Colors.success }]}>{approved}</Text>
        <Text style={s.statLabel}>Approved</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statValue}>{dispatched}</Text>
        <Text style={s.statLabel}>Dispatched</Text>
      </View>
      <View style={s.stat}>
        <Text style={[s.statValue, rejected > 0 && { color: Colors.error }]}>{rejected}</Text>
        <Text style={s.statLabel}>Rejected</Text>
      </View>
    </View>
  );
}

// ── Request row ───────────────────────────────────────────────────────────────
function RequestRow({
  item, canApprove,
  onApprove, onDispatch, onReject, onDelete,
}: {
  item:        DispatchRequest;
  canApprove:  boolean;
  onApprove:   () => void;
  onDispatch:  () => void;
  onReject:    () => void;
  onDelete:    () => void;
}) {
  const isPending = item.status === 'Pending';
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <Text style={s.requestNum}>{item.request_number}</Text>
        <StatusBadge status={item.status} />
      </View>
      {(item.so_order_number || item.customer_name) && (
        <View style={s.infoRow}>
          {item.so_order_number && (
            <Text style={s.soNum}>{item.so_order_number}</Text>
          )}
          {item.customer_name && (
            <Text style={s.customer} numberOfLines={1}>{item.customer_name}</Text>
          )}
        </View>
      )}
      <View style={s.infoRow}>
        {item.delivery_order_number && (
          <Text style={s.meta}>DO: {item.delivery_order_number}</Text>
        )}
        {item.driver_name && (
          <Text style={s.meta}>{item.driver_name}</Text>
        )}
        {item.vehicle_registration && (
          <Text style={s.meta}>{item.vehicle_registration}</Text>
        )}
      </View>
      {item.route && <Text style={s.route} numberOfLines={1}>{item.route}</Text>}
      <View style={s.footer}>
        <Text style={s.date}>{item.created_at}</Text>
        {item.approved_by && (
          <Text style={s.approvedBy}>Approved by {item.approved_by}</Text>
        )}
      </View>
      {canApprove && (
        <View style={s.actions}>
          {isPending && (
            <>
              <TouchableOpacity style={[s.actionBtn, s.approveBtn]} onPress={onApprove} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={14} color={Colors.white} />
                <Text style={s.actionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.dispatchBtn]} onPress={onDispatch} activeOpacity={0.8}>
                <Ionicons name="send" size={14} color={Colors.white} />
                <Text style={s.actionBtnText}>Dispatch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={onReject} activeOpacity={0.8}>
                <Ionicons name="close" size={14} color={Colors.white} />
                <Text style={s.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={s.trashBtn} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function DispatchListScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role ?? '');
  const canApprove = hasPermission(role as any, 'dispatch.approve');

  const { data, isLoading, isError, refetch, isRefetching } = useDispatchList();
  const reviewMutation = useDispatchReview();
  const deleteMutation = useDispatchDelete();

  const [rejectTarget, setRejectTarget] = useState<DispatchRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DispatchRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (isLoading) return <LoadingState message="Loading dispatch queue…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load dispatch queue" onRetry={refetch} fullScreen />;

  const rows = data!.rows;
  const pendingCount = rows.filter(r => r.status === 'Pending').length;

  const handleReview = async (id: number, status: string, notes?: string) => {
    setActionLoading(true);
    try {
      const result = await reviewMutation.mutateAsync({ id, status, notes });
      if (!(result as any).ok) {
        Alert.alert('Error', (result as any).error ?? 'Action failed');
      }
    } catch {
      Alert.alert('Error', 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const result = await deleteMutation.mutateAsync({ id: deleteTarget.id, reason });
      setDeleteTarget(null);
      if ((result as any).pendingApproval) {
        Alert.alert('Request Submitted', 'A deletion request has been submitted for manager approval.');
      }
    } catch {
      Alert.alert('Error', 'Could not delete request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Dispatch Control"
        subtitle="Review and authorise vehicle dispatch"
        dark
        actions={[{
          icon: 'add',
          onPress: () => navigation.navigate('DispatchNewRequest'),
        }]}
      />
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            <MetricsBanner rows={rows} />
            {pendingCount > 0 && canApprove && (
              <View style={s.alertBanner}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={s.alertText}>
                  <Text style={{ fontWeight: Typography.semibold }}>{pendingCount} request{pendingCount > 1 ? 's' : ''}</Text>
                  {' '}awaiting your approval
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <RequestRow
            item={item}
            canApprove={canApprove}
            onApprove={() => handleReview(item.id, 'Approved')}
            onDispatch={() => handleReview(item.id, 'Dispatched')}
            onReject={() => setRejectTarget(item)}
            onDelete={() => setDeleteTarget(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="send-outline"
            title="No dispatch requests"
            subtitle="Tap + to submit a new dispatch request."
          />
        }
      />

      <ReasonModal
        visible={rejectTarget !== null}
        title={`Reject ${rejectTarget?.request_number ?? 'request'}?`}
        message="Provide a reason for rejection."
        confirmLabel="Reject"
        loading={actionLoading}
        onCancel={() => setRejectTarget(null)}
        onConfirm={reason => {
          const target = rejectTarget!;
          setRejectTarget(null);
          handleReview(target.id, 'Rejected', reason);
        }}
      />

      <ReasonModal
        visible={deleteTarget !== null}
        title={`Delete ${deleteTarget?.request_number ?? 'request'}?`}
        message="Provide a reason for this deletion. It may require manager approval."
        confirmLabel="Delete"
        loading={actionLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm,
    marginBottom: Spacing.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warning + '18',
    borderWidth: 1, borderColor: Colors.warning + '44',
    borderRadius: Radius.md, padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  alertText: { fontSize: Typography.sm, color: Colors.warning, flex: 1 },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, gap: Spacing.xs,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestNum: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },

  badge: {
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: Typography.semibold },

  infoRow:  { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  soNum:    { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.navy, fontFamily: 'monospace' },
  customer: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },
  meta:     { fontSize: Typography.xs, color: Colors.textMuted },
  route:    { fontSize: Typography.xs, color: Colors.textSecondary, fontStyle: 'italic' },

  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:       { fontSize: 11, color: Colors.textMuted },
  approvedBy: { fontSize: 11, color: Colors.textMuted },

  actions: {
    flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.md,
  },
  approveBtn:  { backgroundColor: Colors.success },
  dispatchBtn: { backgroundColor: DISPATCHED_CLR },
  rejectBtn:   { backgroundColor: Colors.error },
  actionBtnText: { fontSize: 12, fontWeight: Typography.semibold, color: Colors.white },
  trashBtn: {
    marginLeft: 'auto', padding: 6,
    borderWidth: 1, borderColor: Colors.error + '55',
    borderRadius: Radius.md,
  },
});
