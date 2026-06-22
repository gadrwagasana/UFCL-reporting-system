import React from 'react';
import { StyleSheet, View, FlatList, RefreshControl, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { StatusBadge }  from '../../components/StatusBadge';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { MyRequestsResponse, MyRequest } from '../../types/api';
import { formatDateTime } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

export function MyRequestsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery<MyRequestsResponse>({
    queryKey: ['my-requests'],
    queryFn:  () => get<MyRequestsResponse>(EP.MY_REQUESTS),
    staleTime: 2 * 60_000,
  });

  const all: (MyRequest & { kind: 'edit' | 'delete' })[] = [
    ...(data?.edits     ?? []).map((r) => ({ ...r, kind: 'edit'   as const })),
    ...(data?.deletions ?? []).map((r) => ({ ...r, kind: 'delete' as const })),
  ].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <AppHeader title="My Requests" />

      {isLoading ? (
        <LoadingState message="Loading your requests…" fullScreen />
      ) : isError ? (
        <ErrorState message="Could not load requests" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={all}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={all.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="receipt-outline" title="No requests yet" subtitle="Changes you submit for approval will appear here." />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.entityRef}>{item.entity_ref}</Text>
                <StatusBadge status={item.status} size="sm" />
              </View>
              <Text style={styles.meta}>
                {item.action_type} · {item.entity_type}
              </Text>
              <Text style={styles.date}>{formatDateTime(item.submitted_at)}</Text>
              {item.review_notes ? (
                <Text style={styles.reviewNote}>Note: {item.review_notes}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entityRef:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  meta:        { fontSize: Typography.sm, color: Colors.textMuted },
  date:        { fontSize: Typography.xs, color: Colors.textMuted },
  reviewNote:  { fontSize: Typography.sm, color: Colors.warning, fontStyle: 'italic' },
});
