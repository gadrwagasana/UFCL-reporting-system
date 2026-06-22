import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
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
import { useMaterialRequests } from '../../hooks/useMaterialRequests';
import { useOfflineStore }    from '../../stores/offlineStore';
import { useAuth }            from '../../hooks/useAuth';
import { MaterialRequest }    from '../../types/api';
import { MaterialRequestsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MaterialRequestsStackParamList, 'MaterialRequestsList'>;

const PRIORITY_COLOR: Record<string, string> = {
  urgent:   Colors.warning,
  critical: Colors.error,
  normal:   Colors.textMuted,
};

function RequestCard({ item, onPress }: { item: MaterialRequest; onPress: () => void }) {
  const priorityColor = PRIORITY_COLOR[item.priority] ?? Colors.textMuted;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
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
      <Text style={styles.date}>{item.requested_at}</Text>
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

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'material-request' && i.status !== 'failed'),
    [queue],
  );

  if (isLoading) return <LoadingState message="Loading material requests…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Material Requests"
        dark
        actions={can('material.request') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('MaterialRequestCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load requests" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows?.length ?? 0) + pendingQueue.length === 0
            ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={pendingQueue.length > 0 ? (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingSectionTitle}>Pending Sync ({pendingQueue.length})</Text>
              {pendingQueue.map((q) => <QueueCard key={q.id} context={q.body.item_id ? `Item #${q.body.item_id} · Qty ${q.body.requested_qty}` : 'Material request'} />)}
            </View>
          ) : null}
          ListEmptyComponent={pendingQueue.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No requests yet"
              subtitle={can('material.request') ? 'Tap + to submit a new material request.' : 'No material requests for your workshop.'}
            />
          ) : null}
          renderItem={({ item }) => (
            <RequestCard
              item={item}
              onPress={() => navigation.navigate('MaterialRequestDetail', { item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

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
