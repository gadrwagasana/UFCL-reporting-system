import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppHeader }    from '../../components/AppHeader';
import { ApprovalCard } from '../../components/ApprovalCard';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { get, post }    from '../../api/client';
import { EP }           from '../../api/endpoints';
import { PolesRequest } from '../../types/api';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { Colors, Spacing, Typography } from '../../theme';

type Tab = 'poles' | 'monthly';

interface PolesListResponse { ok: true; rows: PolesRequest[] }

export function ApprovalsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('poles');
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<PolesListResponse>({
    queryKey: ['ceo-poles-requests'],
    queryFn:  () => get<PolesListResponse>(EP.CEO_POLES_REQUESTS),
    staleTime: 2 * 60_000,
  });

  const pending = (data?.rows ?? []).filter((r) => r.status === 'pending');

  async function handleApprove(id: number) {
    await post(EP.CEO_POLES_APPROVE(id), {});
    qc.invalidateQueries({ queryKey: ['ceo-poles-requests'] });
    qc.invalidateQueries({ queryKey: ['ceo-overview'] });
  }

  async function handleReject(id: number, reason: string) {
    await post(EP.CEO_POLES_REJECT(id), { reason });
    qc.invalidateQueries({ queryKey: ['ceo-poles-requests'] });
    qc.invalidateQueries({ queryKey: ['ceo-overview'] });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Approvals" />

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['poles', 'monthly'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'poles' ? 'Poles Purchases' : 'Monthly'}
              {t === 'poles' && pending.length > 0
                ? <Text style={styles.badge}> {pending.length}</Text>
                : null}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'poles' ? (
        isLoading ? (
          <LoadingState message="Loading requests…" fullScreen />
        ) : isError ? (
          <ErrorState message="Could not load requests" onRetry={refetch} fullScreen />
        ) : (
          <FlatList
            data={data?.rows ?? []}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={(data?.rows ?? []).length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
            ListEmptyComponent={
              <EmptyState
                icon="checkmark-done-outline"
                title="No pending requests"
                subtitle="All poles purchase requests have been reviewed."
              />
            }
            renderItem={({ item }) => (
              <ApprovalCard
                title={item.supplier_name}
                subtitle={`Qty: ${item.requested_qty}`}
                status={item.status}
                meta={[
                  { label: 'Requested',  value: formatDate(item.requested_at) },
                  { label: 'Unit price', value: item.unit_price ? formatCurrency(item.unit_price) : '—' },
                  ...(item.rejection_reason ? [{ label: 'Reason', value: item.rejection_reason }] : []),
                ]}
                onApprove={item.status === 'pending' ? () => handleApprove(item.id) : undefined}
                onReject={item.status === 'pending' ? (reason) => handleReject(item.id, reason) : undefined}
              />
            )}
          />
        )
      ) : (
        /* Monthly approval placeholder — Sprint 2 */
        <View style={styles.emptyContainer}>
          <EmptyState icon="calendar-outline" title="Monthly Approval" subtitle="Monthly sign-off will be available in Sprint 2." />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.white,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.navy,
  },
  tabText: {
    fontSize: Typography.base,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  tabTextActive: {
    color: Colors.navy,
    fontWeight: Typography.semibold,
  },
  badge: {
    color: Colors.orange,
    fontWeight: Typography.bold,
  },
});
