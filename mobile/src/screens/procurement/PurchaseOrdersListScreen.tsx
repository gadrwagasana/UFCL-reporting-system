import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { SearchSkeleton } from '../../components/SearchSkeleton';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useProcurementPos } from '../../hooks/useProcurementOrders';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementPurchaseOrder } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'PurchaseOrdersList'>;
type RouteType = RouteProp<ProcurementStackParamList, 'PurchaseOrdersList'>;

function PoCard({ item, onPress }: { item: ProcurementPurchaseOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{item.po_number ?? `#${item.id}`}</Text>
        <StatusBadge status={item.status} size="sm" withIcon />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.supplier_name}</Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>{Number(item.total_amount).toLocaleString()}</Text>
        {item.expected_delivery_date ? <Text style={styles.cardMeta}>Due {new Date(item.expected_delivery_date).toLocaleDateString()}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function PurchaseOrdersListScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data, isLoading, isError, refetch, isRefetching } = useProcurementPos();
  const [search, setSearch] = useState('');
  const [workshopFilter, setWorkshopFilter] = useState(params?.workshopId);
  const allRows = data?.rows ?? [];
  const rows = useMemo(() => {
    let out = allRows;
    if (workshopFilter != null) out = out.filter((po) => po.workshop_id === workshopFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((po) => (po.po_number ?? '').toLowerCase().includes(q) || (po.supplier_name ?? '').toLowerCase().includes(q));
    }
    return out;
  }, [allRows, search, workshopFilter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Purchase Orders" dark />
      {workshopFilter != null ? (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>Filtered to workshop: {params?.workshopName ?? `#${workshopFilter}`}</Text>
          <TouchableOpacity onPress={() => setWorkshopFilter(undefined)}><Text style={styles.filterBannerClear}>Clear</Text></TouchableOpacity>
        </View>
      ) : null}
      {isError ? (
        <ErrorState message="Could not load purchase orders" onRetry={refetch} fullScreen />
      ) : isLoading && !data ? (
        <SearchSkeleton rows={6} />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search PO #, supplier…" />
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="cart-outline"
                title={search ? 'No matching purchase orders' : 'No purchase orders yet'}
                subtitle={search ? 'Try a different search term.' : 'POs are generated from selected quotations.'}
              />
            }
            renderItem={({ item }) => (
              <PoCard item={item} onPress={() => navigation.navigate('PurchaseOrderDetail', { poId: item.id })} />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  filterBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, marginHorizontal: Spacing.base, marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  filterBannerText: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },
  filterBannerClear: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.semibold },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNumber: { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardMetaRow: { flexDirection: 'row', gap: Spacing.base },
  cardMeta: { fontSize: Typography.xs, color: Colors.textMuted },
});
