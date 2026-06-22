import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, ScrollView, RefreshControl,
  TouchableOpacity, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { ApprovalCard } from '../../components/ApprovalCard';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBadge }  from '../../components/StatusBadge';
import { useAuth }      from '../../hooks/useAuth';
import { usePolesRequests, usePolesApprove } from '../../hooks/usePolesRequests';
import { useMonthlyDashboard, useMonthlyApprove } from '../../hooks/useMonthlyDashboard';
import { CeoApprovalsStackScreenProps } from '../../navigation/types';
import { PolesRequest } from '../../types/api';
import { formatDate, formatDateTime, formatCurrency, formatNumber, monthKey } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';
import { format, addMonths, subMonths, parseISO } from 'date-fns';

type Tab = 'poles' | 'monthly';
type NavProps = CeoApprovalsStackScreenProps<'PendingApprovals'>['navigation'];

// ─── Month picker ─────────────────────────────────────────────────────────────

interface MonthPickerProps {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
}
function MonthPicker({ currentDate, onPrev, onNext }: MonthPickerProps) {
  const label = format(currentDate, 'MMMM yyyy');
  const isCurrentMonth = format(currentDate, 'yyyy-MM') === monthKey();
  return (
    <View style={styles.monthPicker}>
      <TouchableOpacity onPress={onPrev} style={styles.monthArrow} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={Colors.navy} />
      </TouchableOpacity>
      <Text style={styles.monthLabel}>{label}</Text>
      <TouchableOpacity
        onPress={onNext}
        style={styles.monthArrow}
        hitSlop={8}
        activeOpacity={isCurrentMonth ? 1 : 0.7}
        disabled={isCurrentMonth}
      >
        <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? Colors.textMuted : Colors.navy} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string | number | undefined }
function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value != null ? String(value) : '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Monthly tab content ──────────────────────────────────────────────────────

interface MonthlyTabProps { currentDate: Date }

function MonthlyTab({ currentDate }: MonthlyTabProps) {
  const { can } = useAuth();
  const mk = format(currentDate, 'yyyy-MM');
  const { data, isLoading, isError, refetch, isRefetching } = useMonthlyDashboard(mk);
  const { approveMonth } = useMonthlyApprove(mk);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved]   = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      await approveMonth();
      setApproved(true);
      setConfirmVisible(false);
    } catch {
      Alert.alert('Error', 'Could not approve monthly report. Please try again.');
    } finally {
      setApproving(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading monthly data…" fullScreen />;
  if (isError)   return <ErrorState message="Could not load monthly report" onRetry={refetch} fullScreen />;
  if (!data)     return <EmptyState icon="calendar-outline" title="No data" subtitle="No report found for this month." />;

  const isPending  = data.status === 'pending' && !approved;
  const isApproved = data.status === 'approved' || approved;
  const monthLabel = format(parseISO(`${mk}-01`), 'MMMM yyyy');

  return (
    <ScrollView
      contentContainerStyle={styles.monthlyScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
      }
    >
      {/* Summary card */}
      <View style={styles.card}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTitle}>{monthLabel} Report</Text>
          <StatusBadge status={isApproved ? 'approved' : 'pending'} />
        </View>
        {isApproved && data.approved_by_name ? (
          <Text style={styles.summaryMeta}>
            Approved by {data.approved_by_name}
            {data.approved_at ? ` · ${formatDateTime(data.approved_at)}` : ''}
          </Text>
        ) : null}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Harvest</Text>
          <View style={styles.statsRow}>
            <StatCard label="Logs"    value={formatNumber(data.harvest?.total_logs)} />
            <StatCard label="Trees"   value={formatNumber(data.harvest?.total_trees)} />
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Sawmill</Text>
          <View style={styles.statsRow}>
            <StatCard label="Volume (m³)"   value={formatNumber(data.sawmill?.total_volume_m3, 2)} />
            <StatCard label="Production"    value={formatNumber(data.sawmill?.total_production)} />
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Poles</Text>
          <View style={styles.statsRow}>
            <StatCard label="Purchase Requests" value={formatNumber(data.poles?.total_purchase_requests)} />
            <StatCard label="Delivered"          value={formatNumber(data.poles?.total_delivered)} />
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Sales</Text>
          <View style={styles.statsRow}>
            <StatCard label="Orders"        value={formatNumber(data.sales?.total_orders)} />
            <StatCard label="Revenue (ETB)" value={formatNumber(data.sales?.total_revenue, 0)} />
          </View>
        </View>
      </View>

      {/* Approve button */}
      {isPending && can('monthly.approve') && (
        <TouchableOpacity
          style={styles.approveMonthBtn}
          onPress={() => setConfirmVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
          <Text style={styles.approveMonthBtnText}>Approve {monthLabel} Report</Text>
        </TouchableOpacity>
      )}

      {/* Success state */}
      {approved && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.successBannerText}>Report approved successfully</Text>
        </View>
      )}

      {/* Confirm modal */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Approve {monthLabel}?</Text>
            <Text style={styles.modalBody}>
              This will sign off the {monthLabel} report. This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setConfirmVisible(false)}
                disabled={approving}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnApprove]}
                onPress={handleApprove}
                disabled={approving}
                activeOpacity={0.8}
              >
                {approving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.modalBtnApproveText}>Approve</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function ApprovalsScreen() {
  const navigation = useNavigation<NavProps>();
  const [activeTab, setActiveTab] = useState<Tab>('poles');
  const [monthDate, setMonthDate] = useState(() => new Date());

  const { data, isLoading, isError, refetch, isRefetching } = usePolesRequests();
  const { approve, reject } = usePolesApprove();

  const pending = (data?.rows ?? []).filter((r) => r.status === 'pending');

  async function handleApprove(id: number) {
    try {
      await approve(id);
    } catch {
      Alert.alert('Error', 'Could not approve request. Please try again.');
    }
  }

  async function handleReject(id: number, reason: string) {
    try {
      await reject(id, reason);
    } catch {
      Alert.alert('Error', 'Could not reject request. Please try again.');
    }
  }

  function navigateToDetail(item: PolesRequest) {
    navigation.navigate('ApprovalDetail', { item });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Approvals" dark />

      {/* Tab bar */}
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
              {t === 'poles' && pending.length > 0 ? (
                <Text style={styles.badge}> {pending.length}</Text>
              ) : null}
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
            contentContainerStyle={
              (data?.rows ?? []).length === 0 ? styles.emptyContainer : styles.list
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={Colors.navy}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="checkmark-done-outline"
                title="No pending requests"
                subtitle="All poles purchase requests have been reviewed."
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => navigateToDetail(item)}
                activeOpacity={0.85}
              >
                <ApprovalCard
                  title={item.supplier_name}
                  subtitle={`Qty: ${item.requested_qty}`}
                  status={item.status}
                  meta={[
                    { label: 'Requested',  value: formatDate(item.requested_at) },
                    { label: 'Unit price', value: item.unit_price ? formatCurrency(item.unit_price) : '—' },
                    ...(item.rejection_reason
                      ? [{ label: 'Reason', value: item.rejection_reason }]
                      : []),
                  ]}
                  onApprove={item.status === 'pending' ? () => handleApprove(item.id) : undefined}
                  onReject={item.status === 'pending' ? (reason) => handleReject(item.id, reason) : undefined}
                />
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        <View style={styles.monthlyContainer}>
          <MonthPicker
            currentDate={monthDate}
            onPrev={() => setMonthDate((d) => subMonths(d, 1))}
            onNext={() => setMonthDate((d) => addMonths(d, 1))}
          />
          <MonthlyTab currentDate={monthDate} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  list:   { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
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

  // Monthly
  monthlyContainer: { flex: 1 },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  monthArrow: {
    padding: Spacing.xs,
  },
  monthLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  monthlyScroll: {
    padding: Spacing.base,
    gap: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  summaryTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  summaryMeta: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  statsGrid: { gap: Spacing.base },
  statsSection: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  statsSectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  approveMonthBtn: {
    backgroundColor: Colors.green,
    borderRadius: Radius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  approveMonthBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  successBannerText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.success,
  },

  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...Shadow.lg,
  },
  modalTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalBody: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: Typography.base * 1.45,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnCancelText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  modalBtnApprove: {
    backgroundColor: Colors.green,
  },
  modalBtnApproveText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
