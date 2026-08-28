// ERP Enterprise Completion Phase 4 — Pending Edit / Deletion Request
// governance review on mobile. Structure mirrors ceo/ApprovalsScreen.tsx's
// tabbed layout exactly (tab bar + FlatList + ApprovalCard), the established
// pattern for a two-queue approval hub on this platform.
import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }     from '../../components/AppHeader';
import { ApprovalCard }  from '../../components/ApprovalCard';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import {
  usePendingEdits, usePendingEditsReview,
  useDeletionRequests, useDeletionRequestReview,
} from '../../hooks/useGovernance';
import { PendingEditRequest, DeletionRequestItem } from '../../types/api';
import { Colors, Spacing, Typography } from '../../theme';

type Tab = 'edits' | 'deletions';

// ─── Edit Requests tab ────────────────────────────────────────────────────────

function EditRequestsTab() {
  const { data, isLoading, isError, refetch, isRefetching } = usePendingEdits();
  const { review } = usePendingEditsReview();

  async function handleApprove(id: number) {
    try { await review(id, 'Approved'); }
    catch { Alert.alert('Error', 'Could not approve request. Please try again.'); }
  }
  async function handleReject(id: number, reason: string) {
    try { await review(id, 'Rejected', reason); }
    catch { Alert.alert('Error', 'Could not reject request. Please try again.'); }
  }

  if (isLoading) return <LoadingState message="Loading edit requests…" fullScreen />;
  if (isError)   return <ErrorState message="Could not load edit requests" onRetry={refetch} fullScreen />;

  const rows = data?.rows ?? [];

  return (
    <FlatList<PendingEditRequest>
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      ListEmptyComponent={
        <EmptyState
          icon="checkmark-done-outline"
          title="No pending edit requests"
          subtitle="Nothing is waiting for your review."
        />
      }
      renderItem={({ item }) => (
        <ApprovalCard
          title={item.entity_ref || `${item.entity_type} #${item.entity_id}`}
          subtitle={`${item.entity_type} · ${item.required_level} approval`}
          status={item.status}
          meta={[
            { label: 'Submitted by', value: item.submitted_by_name || '—' },
            { label: 'Submitted',    value: item.submitted_at },
            ...(item.reviewed_by_name
              ? [{ label: 'Reviewed by', value: item.reviewed_by_name }]
              : []),
            ...(item.review_notes ? [{ label: 'Notes', value: item.review_notes }] : []),
          ]}
          onApprove={item.status === 'Pending' ? () => handleApprove(item.id) : undefined}
          onReject={item.status === 'Pending' ? (reason) => handleReject(item.id, reason) : undefined}
        />
      )}
    />
  );
}

// ─── Deletion Requests tab ────────────────────────────────────────────────────

function DeletionRequestsTab() {
  const { data, isLoading, isError, refetch, isRefetching } = useDeletionRequests();
  const { review } = useDeletionRequestReview();

  async function handleApprove(id: number) {
    try { await review(id, 'Approved'); }
    catch { Alert.alert('Error', 'Could not approve deletion. Please try again.'); }
  }
  async function handleReject(id: number, reason: string) {
    try { await review(id, 'Rejected', reason); }
    catch { Alert.alert('Error', 'Could not reject deletion request. Please try again.'); }
  }

  if (isLoading) return <LoadingState message="Loading deletion requests…" fullScreen />;
  if (isError)   return <ErrorState message="Could not load deletion requests" onRetry={refetch} fullScreen />;

  const rows = data?.rows ?? [];

  return (
    <FlatList<DeletionRequestItem>
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      ListEmptyComponent={
        <EmptyState
          icon="trash-outline"
          title="No pending deletion requests"
          subtitle="Nothing is waiting for your review."
        />
      }
      renderItem={({ item }) => (
        <ApprovalCard
          title={item.entity_ref || `${item.entity_type} #${item.record_id}`}
          subtitle={`${item.entity_type} · ${item.required_level} approval`}
          status={item.status}
          meta={[
            { label: 'Requested by', value: item.requested_by_name || '—' },
            { label: 'Requested',    value: item.requested_at_fmt },
            { label: 'Reason',       value: item.deletion_reason || '—' },
            ...(item.reviewed_by_name
              ? [{ label: 'Reviewed by', value: item.reviewed_by_name }]
              : []),
          ]}
          onApprove={item.status === 'pending' ? () => handleApprove(item.id) : undefined}
          onReject={item.status === 'pending' ? (reason) => handleReject(item.id, reason) : undefined}
        />
      )}
    />
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export function GovernanceScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('edits');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Pending Approvals" dark hideNotifications hideGovernance
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <View style={styles.tabs}>
        {(['edits', 'deletions'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'edits' ? 'Edit Requests' : 'Deletion Requests'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'edits' ? <EditRequestsTab /> : <DeletionRequestsTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
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
});
