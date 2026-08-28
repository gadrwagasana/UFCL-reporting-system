import React from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { ApprovalCard }  from '../../components/ApprovalCard';
import { useFinanceApprovals, useFinanceApprovalDecide } from '../../hooks/useFinance';
import { FinanceApprovalQueueItem } from '../../types/api';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Colors, Spacing } from '../../theme';

type NavProp = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceApprovals'>;

// Finance Enterprise Phase 2 — mobile Approval Center. Lists financeApprovalQueue
// rows (a thin read-only view over the shared procurement_approval_steps
// engine) and decides via the exact same engine — no new approval logic here.
export function FinanceApprovalsScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceApprovals();
  const { decide } = useFinanceApprovalDecide();

  async function handleApprove(item: FinanceApprovalQueueItem) {
    try {
      const r = await decide(item.entity_type, item.entity_id, 'approved');
      if (!r.ok) Alert.alert('Error', r.error || 'Could not approve.');
    } catch {
      Alert.alert('Error', 'Could not approve. Please try again.');
    }
  }

  async function handleReject(item: FinanceApprovalQueueItem, reason: string) {
    if (!reason.trim()) { Alert.alert('Reason required', 'A reason is required to reject.'); return; }
    try {
      const r = await decide(item.entity_type, item.entity_id, 'rejected', reason);
      if (!r.ok) Alert.alert('Error', r.error || 'Could not reject.');
    } catch {
      Alert.alert('Error', 'Could not reject. Please try again.');
    }
  }

  if (isLoading) return <LoadingState message="Loading approvals…" fullScreen />;
  if (isError) return <ErrorState message="Could not load approvals" onRetry={refetch} fullScreen />;

  const rows = data?.rows ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Financial Approvals" dark onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.entity_type}-${r.entity_id}-${r.stage_key}`}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <EmptyState icon="checkmark-done-outline" title="Nothing pending" subtitle="No financial approvals are assigned to your role right now." />
        }
        renderItem={({ item }) => (
          <ApprovalCard
            title={`${item.entity_type.replace(/_/g, ' ')} — ${item.stage_key}`}
            subtitle={item.label}
            status="pending"
            meta={[
              { label: 'Amount', value: item.amount != null ? formatCurrency(item.amount) : '—' },
              { label: 'Workshop', value: item.workshop_id ? 'Workshop-scoped' : 'Company-wide' },
              { label: 'Waiting since', value: formatDate(item.step_created_at) },
            ]}
            onApprove={() => handleApprove(item)}
            onReject={(reason) => handleReject(item, reason)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  list:   { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
});
