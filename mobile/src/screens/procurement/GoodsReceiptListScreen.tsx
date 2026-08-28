import React from 'react';
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
import { useProcurementGoodsReceipts } from '../../hooks/useProcurementOrders';
import { ProcurementStackParamList } from '../../navigation/types';
import type { ProcurementGoodsReceipt } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'GoodsReceiptList'>;

function ReceiptCard({ item, onPress }: { item: ProcurementGoodsReceipt; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{item.receipt_number ?? `#${item.id}`}</Text>
        <StatusBadge status={item.status} size="sm" withIcon />
      </View>
      <Text style={styles.cardTitle}>{item.po_number} · {item.supplier_name}</Text>
      <Text style={styles.cardMeta}>{item.received_by_name ?? '—'} · {new Date(item.received_at).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );
}

export function GoodsReceiptListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useProcurementGoodsReceipts();
  const rows = data?.rows ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Goods Receipts" dark />
      {isError ? (
        <ErrorState message="Could not load goods receipts" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshing={isLoading || isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No goods receipts yet" subtitle="Record a receipt from a purchase order." />}
          renderItem={({ item }) => <ReceiptCard item={item} onPress={() => navigation.navigate('GoodsReceiptDetail', { receiptId: item.id })} />}
        />
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
