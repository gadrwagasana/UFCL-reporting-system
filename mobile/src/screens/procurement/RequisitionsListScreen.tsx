import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { SearchSkeleton } from '../../components/SearchSkeleton';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useProcurementRequisitions } from '../../hooks/useProcurementRequisitions';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementRequisition } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'RequisitionsList'>;

const PRIORITY_COLOR: Record<string, string> = {
  low: Colors.textMuted, medium: Colors.navy, high: Colors.orange, urgent: Colors.error,
};

function RequisitionCard({ item, onPress }: { item: ProcurementRequisition; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{item.requisition_number ?? `#${item.id}`}</Text>
        <StatusBadge status={item.status} size="sm" withIcon />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>{item.requester_name ?? 'You'}</Text>
        <Text style={[styles.cardMeta, { color: PRIORITY_COLOR[item.priority] }]}>{item.priority.toUpperCase()}</Text>
        <Text style={styles.cardMeta}>{Number(item.total_estimated_amount).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function RequisitionsListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useProcurementRequisitions();
  const [search, setSearch] = useState('');
  const allRows = data?.rows ?? [];
  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      (r.requisition_number ?? '').toLowerCase().includes(q) ||
      (r.requester_name ?? '').toLowerCase().includes(q)
    );
  }, [allRows, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Purchase Requisitions"
        dark
        actions={[{ icon: 'add', onPress: () => navigation.navigate('RequisitionForm', { requisition: undefined }) }]}
      />
      {isError ? (
        <ErrorState message="Could not load requisitions" onRetry={refetch} fullScreen />
      ) : isLoading && !data ? (
        <SearchSkeleton rows={6} />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search number, title, requester…" />
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="file-tray-outline"
                title={search ? 'No matching requisitions' : 'No requisitions yet'}
                subtitle={search ? 'Try a different search term.' : 'Tap + to raise a purchase requisition.'}
              />
            }
            renderItem={({ item }) => (
              <RequisitionCard item={item} onPress={() => navigation.navigate('RequisitionDetail', { requisitionId: item.id })} />
            )}
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
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNumber: { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardMetaRow: { flexDirection: 'row', gap: Spacing.base, marginTop: 2 },
  cardMeta: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
});
