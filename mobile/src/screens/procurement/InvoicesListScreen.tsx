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
import { useProcurementInvoices } from '../../hooks/useProcurementInvoices';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementInvoice } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'InvoicesList'>;

function InvoiceCard({ item, onPress }: { item: ProcurementInvoice; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{item.invoice_number}</Text>
        <StatusBadge status={item.status} size="sm" withIcon />
      </View>
      <Text style={styles.cardTitle}>{item.supplier_name} · {item.po_number}</Text>
      <Text style={styles.cardMeta}>{Number(item.invoice_amount).toLocaleString()}</Text>
    </TouchableOpacity>
  );
}

export function InvoicesListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useProcurementInvoices();
  const [search, setSearch] = useState('');
  const allRows = data?.rows ?? [];
  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((inv) =>
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.supplier_name ?? '').toLowerCase().includes(q) ||
      (inv.po_number ?? '').toLowerCase().includes(q)
    );
  }, [allRows, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Invoices" dark />
      {isError ? (
        <ErrorState message="Could not load invoices" onRetry={refetch} fullScreen />
      ) : isLoading && !data ? (
        <SearchSkeleton rows={6} />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search invoice #, supplier, PO #…" />
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="receipt-outline"
                title={search ? 'No matching invoices' : 'No invoices yet'}
                subtitle={search ? 'Try a different search term.' : 'Invoices are raised against received purchase orders.'}
              />
            }
            renderItem={({ item }) => (
              <InvoiceCard item={item} onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })} />
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
  cardMeta: { fontSize: Typography.xs, color: Colors.textMuted },
});
