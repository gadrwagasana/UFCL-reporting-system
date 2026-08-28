import React from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { StatusBadge }   from '../../components/StatusBadge';
import { useFinanceStockCounts } from '../../hooks/useFinance';
import { FinanceStockCountSession } from '../../types/api';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { formatDate } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceStockCounts'>;

// Finance Enterprise — mobile Stock Count review. Lists sessions initiated
// on desktop (initiation stays desktop-only, see useFinance.ts header) so
// staff can enter physical counts and submit for review directly from the
// warehouse floor.
export function FinanceStockCountsScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceStockCounts();

  if (isLoading) return <LoadingState message="Loading stock counts…" fullScreen />;
  if (isError) return <ErrorState message="Could not load stock counts" onRetry={refetch} fullScreen />;

  const rows = data?.rows ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Stock Counts" dark onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <EmptyState icon="clipboard-outline" title="No stock counts" subtitle="Stock counts are initiated on desktop by Finance." />
        }
        renderItem={({ item }: { item: FinanceStockCountSession }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('FinanceStockCountDetail', { sessionId: item.id })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.sessionId}>Count #{item.id}</Text>
              <StatusBadge status={item.status} size="sm" />
            </View>
            <Text style={styles.workshop}>{item.workshop_name || 'Company-wide'}{item.category ? ` · ${item.category}` : ''}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.counted_count}/{item.line_count} counted</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={[styles.metaText, item.variance_count > 0 && styles.metaWarn]}>{item.variance_count} variance(s)</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{formatDate(item.initiated_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionId: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  workshop: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
  metaWarn: { color: Colors.error, fontWeight: Typography.semibold },
  metaDot: { color: Colors.textMuted },
});
