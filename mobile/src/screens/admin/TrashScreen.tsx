import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { useAdminTrash, useTrashRestore, useTrashPurge } from '../../hooks/useAdmin';
import { useAuthStore } from '../../stores/authStore';
import type { TrashRow } from '../../types/api';
import type { UserRole } from '../../types/auth';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function daysColor(days: number): string {
  if (days <= 3)  return Colors.error;
  if (days <= 7)  return Colors.warning;
  return Colors.success;
}

function TrashCard({
  item,
  canPurge,
  onRestore,
  onPurge,
}: {
  item:      TrashRow;
  canPurge:  boolean;
  onRestore: () => void;
  onPurge:   () => void;
}) {
  const dc = daysColor(item.days_remaining);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardType}>{item.label}</Text>
          {item.entity_ref ? (
            <Text style={styles.cardRef} numberOfLines={1}>{item.entity_ref}</Text>
          ) : null}
        </View>
        <View style={[styles.daysBadge, { backgroundColor: dc + '20', borderColor: dc }]}>
          <Text style={[styles.daysText, { color: dc }]}>{item.days_remaining}d</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>Deleted by {item.deleted_by_name ?? '—'}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{item.deleted_at}</Text>
      </View>

      {item.deletion_reason ? (
        <Text style={styles.reason} numberOfLines={2}>Reason: {item.deletion_reason}</Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.restoreBtn]} onPress={onRestore}>
          <Ionicons name="refresh" size={14} color={Colors.success} />
          <Text style={[styles.actionText, { color: Colors.success }]}>Restore</Text>
        </TouchableOpacity>
        {canPurge && (
          <TouchableOpacity style={[styles.actionBtn, styles.purgeBtn]} onPress={onPurge}>
            <Ionicons name="trash" size={14} color={Colors.error} />
            <Text style={[styles.actionText, { color: Colors.error }]}>Purge</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function TrashScreen() {
  const navigation = useNavigation();
  const role = useAuthStore((s) => s.user?.role as UserRole | undefined);
  const canPurge = role === 'admin' || role === 'ceo';

  const { data, isLoading, isError, refetch, isRefetching } = useAdminTrash();
  const restore = useTrashRestore();
  const purge   = useTrashPurge();

  function handleRestore(item: TrashRow) {
    Alert.alert(
      'Restore Record',
      `Restore "${item.entity_ref ?? item.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () =>
            restore.mutate(
              { tableName: item.table_name, recordId: item.record_id },
              { onSuccess: (res) => { if (!res.ok) Alert.alert('Error', res.error ?? 'Restore failed'); } },
            ),
        },
      ],
    );
  }

  function handlePurge(item: TrashRow) {
    Alert.alert(
      'Permanently Delete',
      `Purge "${item.entity_ref ?? item.label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge',
          style: 'destructive',
          onPress: () =>
            purge.mutate(
              { tableName: item.table_name, recordId: item.record_id },
              { onSuccess: (res) => { if (!res.ok) Alert.alert('Error', res.error ?? 'Purge failed'); } },
            ),
        },
      ],
    );
  }

  if (isLoading) return <LoadingState message="Loading trash…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Trash" onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load trash" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => `${item.table_name}-${item.record_id}`}
          contentContainerStyle={(data?.rows ?? []).length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="trash-outline" title="Trash is empty" subtitle="Deleted records will appear here for 30 days." />
          }
          renderItem={({ item }) => (
            <TrashCard
              item={item}
              canPurge={canPurge}
              onRestore={() => handleRestore(item)}
              onPurge={() => handlePurge(item)}
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

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:   { flex: 1 },
  cardType:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardRef:    { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  daysBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: Radius.sm, borderWidth: 1,
  },
  daysText:  { fontSize: Typography.xs, fontWeight: Typography.bold },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText:  { fontSize: Typography.xs, color: Colors.textMuted },
  metaDot:   { fontSize: Typography.xs, color: Colors.textMuted },
  reason:    { fontSize: Typography.sm, color: Colors.warning, fontStyle: 'italic' },
  actions:   { flexDirection: 'row', gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restoreBtn:{},
  purgeBtn:  {},
  actionText:{ fontSize: Typography.sm, fontWeight: Typography.medium },
});
