import React, { useState } from 'react';
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
import { ReasonModal }   from '../../components/ReasonModal';
import { usePoleProductionBatches, usePoleProductionReconciliation, usePoleProductionBatchDelete } from '../../hooks/usePoles';
import { useAuth }         from '../../hooks/useAuth';
import { useOfflineStore } from '../../stores/offlineStore';
import { PoleProductionBatch, PoleBatchOutputLine } from '../../types/api';
import { PolesProductionStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Pole Production Phase 1 — distinct from PolesProductionScreen (the legacy
// daily_logs.poles_units counter, kept unchanged). This is the new batch +
// output-lines capability, reached via a stack push from that screen.

type NavProp = NativeStackNavigationProp<PolesProductionStackParamList, 'PoleBatchList'>;

function ReconciliationBanner() {
  const { data } = usePoleProductionReconciliation();
  if (!data) return null;
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{data.inputRawLogQty}</Text>
        <Text style={styles.bannerLabel}>Raw Logs In</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: Colors.success }]}>{data.acceptedTotal}</Text>
        <Text style={styles.bannerLabel}>Accepted</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{data.recoveryPct != null ? `${data.recoveryPct}%` : '—'}</Text>
        <Text style={styles.bannerLabel}>Recovery</Text>
      </View>
    </View>
  );
}

function OutputLineRow({ output, onInspect }: { output: PoleBatchOutputLine; onInspect: () => void }) {
  const label = `${output.type}${output.sub_type ? ' ' + output.sub_type : ''} ${output.size}`;
  return (
    <View style={styles.outputRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.outputLabel}>{label}</Text>
        <Text style={styles.outputQty}>{output.quantity} pcs</Text>
      </View>
      {output.status === 'inspected' ? (
        <View style={styles.inspectedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={styles.inspectedText}>Inspected</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.inspectBtn} onPress={onInspect}>
          <Ionicons name="checkmark-circle-outline" size={14} color={Colors.white} />
          <Text style={styles.inspectBtnText}>Inspect</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BatchCard({ batch, onInspectOutput, onDelete, canDelete }: {
  batch: PoleProductionBatch;
  onInspectOutput: (o: PoleBatchOutputLine) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>{batch.batch_date}</Text>
        <Text style={styles.inputBadge}>{batch.input_raw_log_qty} raw logs in</Text>
      </View>
      {batch.pending_deletion && <Text style={styles.pendingBadge}>Pending Deletion</Text>}
      {(batch.operator || batch.supervisor) && (
        <Text style={styles.meta}>{[batch.operator, batch.supervisor].filter(Boolean).join(' · ')}</Text>
      )}
      {batch.outputs.map((o) => (
        <OutputLineRow key={o.id} output={o} onInspect={() => onInspectOutput(o)} />
      ))}
      {canDelete && !batch.pending_deletion && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={14} color={Colors.error} />
          <Text style={styles.deleteBtnText}>Delete Batch</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function PoleBatchListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { isOnline } = useOfflineStore();
  const { data, isLoading, isError, refetch, isRefetching } = usePoleProductionBatches();
  const { deleteBatch } = usePoleProductionBatchDelete();

  const [deleteTarget, setDeleteTarget] = useState<PoleProductionBatch | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const batches = data?.rows ?? [];
  const canDelete = can('poles.write');

  function handleDelete(batch: PoleProductionBatch) {
    if (!isOnline) {
      Alert.alert('Online Required', 'Deleting a production batch requires an active connection.');
      return;
    }
    setDeleteTarget(batch);
  }

  async function submitDelete(reason: string) {
    if (!reason.trim() || !deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteBatch(deleteTarget.id, reason.trim());
      setDeleteTarget(null);
      if (result && 'pendingApproval' in result && result.pendingApproval) {
        Alert.alert('Submitted for Review', result.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not delete this production batch.');
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading production batches…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Pole Production"
        dark
        actions={can('poles.write') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('PoleBatchCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load production batches" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={batches.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={<ReconciliationBanner />}
          ListEmptyComponent={
            <EmptyState
              icon="build-outline"
              title="No production batches"
              subtitle={can('poles.write') ? 'Tap + to record a new batch.' : 'No records found.'}
            />
          }
          renderItem={({ item }) => (
            <BatchCard
              batch={item}
              onInspectOutput={(output) => navigation.navigate('PoleBatchInspect', { output })}
              onDelete={() => handleDelete(item)}
              canDelete={canDelete}
            />
          )}
        />
      )}

      <ReasonModal
        visible={!!deleteTarget}
        title="Delete Production Batch"
        message={deleteTarget ? `Enter a reason for deleting this batch (${deleteTarget.batch_date}). Only allowed before any output line has been inspected.` : ''}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={submitDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: Colors.border },
  bannerValue:   { fontSize: Typography.lg, fontWeight: Typography.bold },
  bannerLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  inputBadge: {
    fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium,
    backgroundColor: Colors.navyBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  meta: { fontSize: Typography.sm, color: Colors.textSecondary },
  pendingBadge: {
    fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium,
    backgroundColor: Colors.errorBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start',
  },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.errorBg, borderRadius: Radius.md,
    paddingVertical: Spacing.xs, marginTop: Spacing.xs,
  },
  deleteBtnText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.error },

  outputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  outputLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  outputQty:   { fontSize: Typography.xs, color: Colors.textMuted },

  inspectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  inspectedText:  { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },

  inspectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.navy, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  inspectBtnText: { fontSize: Typography.xs, color: Colors.white, fontWeight: Typography.medium },
});
