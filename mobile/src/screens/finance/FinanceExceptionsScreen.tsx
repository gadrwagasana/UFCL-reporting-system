import React, { useState } from 'react';
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
import { useFinanceExceptions } from '../../hooks/useFinance';
import { FinanceExceptionCase } from '../../types/api';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceExceptions'>;

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' }, { key: 'closed', label: 'Closed' },
];

// Finance Enterprise — mobile Exception Center. Cases open from Dashboard
// exceptions or Stock Variance (both desktop-driven today); mobile can
// review, comment, and resolve them from the field.
export function FinanceExceptionsScreen() {
  const navigation = useNavigation<NavProp>();
  const [status, setStatus] = useState('');
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceExceptions(status || undefined);

  if (isLoading) return <LoadingState message="Loading exceptions…" fullScreen />;
  if (isError) return <ErrorState message="Could not load exceptions" onRetry={refetch} fullScreen />;

  const rows = data?.rows ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Exception Center" dark onBack={() => navigation.goBack()} />
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, status === f.key && styles.filterChipActive]}
            onPress={() => setStatus(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, status === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <EmptyState icon="alert-circle-outline" title="No exceptions" subtitle="Cases open automatically from Dashboard exceptions or Stock Variance on desktop." />
        }
        renderItem={({ item }: { item: FinanceExceptionCase }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('FinanceExceptionDetail', { caseId: item.id })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <StatusBadge status={item.status} size="sm" />
            </View>
            <Text style={styles.meta}>{item.category.replace(/_/g, ' ')} · {item.severity}{item.financial_impact != null ? ` · ${formatCurrency(item.financial_impact)}` : ''}</Text>
            <Text style={styles.metaDate}>Opened {formatDate(item.created_at)} by {item.created_by_name || '—'} · {item.comment_count} comment(s)</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, padding: Spacing.base, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  filterChip: { paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  filterChipTextActive: { color: Colors.white },
  list: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  meta: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  metaDate: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
});
