import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuthStore }    from '../../stores/authStore';
import { AppHeader }       from '../../components/AppHeader';
import { LoadingState }    from '../../components/LoadingState';
import { ErrorState }      from '../../components/ErrorState';
import { EmptyState }      from '../../components/EmptyState';
import {
  useWorkshopOverview,
  useTransferApprove,
  useMaterialRequestApproveFromOverview,
} from '../../hooks/useWorkshops';
import { hasPermission } from '../../utils/permissions';
import type { OverviewWorkshopCard, PendingTransfer, PendingMaterialRequest, LowStockItem } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function MetricsBanner({ total, active, transfers, requests, lowStockCount }: {
  total: number; active: number; transfers: number; requests: number; lowStockCount: number;
}) {
  return (
    <View style={styles.banner}>
      {[
        { label: 'Workshops',  value: total },
        { label: 'Active',     value: active },
        { label: 'Transfers',  value: transfers },
        { label: 'Mat. Req.',  value: requests },
        { label: 'Low Stock',  value: lowStockCount },
      ].map(({ label, value }) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function WorkshopCard({ item }: { item: OverviewWorkshopCard }) {
  return (
    <View style={[styles.card, !item.active && styles.cardInactive]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{item.name}</Text>
          {!item.active && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
        </View>
        {item.workshop_type ? <Text style={styles.cardType}>{item.workshop_type}</Text> : null}
        {item.location ? <Text style={styles.cardLocation}>{item.location}</Text> : null}
      </View>
      <View style={styles.cardStats}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>{item.item_count}</Text>
          <Text style={styles.cardStatLabel}>Items</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>
            {Number(item.stock_value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.cardStatLabel}>Stock Value</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>{item.machine_count}</Text>
          <Text style={styles.cardStatLabel}>Machines</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={[styles.cardStatValue, { color: Colors.success }]}>{item.machines_available}</Text>
          <Text style={styles.cardStatLabel}>Available</Text>
        </View>
      </View>
    </View>
  );
}

function TransferRow({
  item,
  canApprove,
  onApprove,
  onReject,
}: {
  item: PendingTransfer;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingTitle}>{item.item_name}</Text>
        <Text style={styles.pendingMeta}>{item.quantity} {item.uom} · {item.from_workshop} → {item.to_workshop}</Text>
        <Text style={styles.pendingMeta}>{item.requested_by} · {item.created_at}</Text>
      </View>
      {canApprove && (
        <View style={styles.pendingActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="close-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MRRow({
  item,
  canApprove,
  onApprove,
  onReject,
}: {
  item: PendingMaterialRequest;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const priorityColor = item.priority === 'urgent' ? Colors.error : item.priority === 'high' ? Colors.warning : Colors.textSecondary;
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingTitle}>{item.item_name}</Text>
        <Text style={styles.pendingMeta}>{item.requested_qty} {item.uom} · {item.workshop_name}</Text>
        <View style={styles.pendingMetaRow}>
          <Text style={[styles.priorityBadge, { color: priorityColor }]}>{item.priority.toUpperCase()}</Text>
          <Text style={styles.pendingMeta}> · {item.requested_by} · {item.requested_at}</Text>
        </View>
        {item.reason ? <Text style={styles.pendingReason}>{item.reason}</Text> : null}
      </View>
      {canApprove && (
        <View style={styles.pendingActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="close-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function LowStockRow({ item }: { item: LowStockItem }) {
  return (
    <View style={styles.lowStockCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pendingTitle}>{item.name}</Text>
        <Text style={styles.pendingMeta}>{item.category} · {item.warehouse_name}</Text>
      </View>
      <View style={styles.stockBadge}>
        <Text style={styles.stockBadgeText}>{item.total_stock}/{item.min_stock} {item.uom}</Text>
      </View>
    </View>
  );
}

export function WorkshopOverviewScreen() {
  const { isOnline } = useOfflineStore();
  const role = useAuthStore(s => s.user?.role ?? 'storekeeper');
  const canApprove = hasPermission(role as any, 'workshop.approve');

  const { data, isLoading, isError, refetch, isRefetching } = useWorkshopOverview();
  const { approveTransfer }        = useTransferApprove();
  const { approveMaterialRequest } = useMaterialRequestApproveFromOverview();

  function confirmTransfer(item: PendingTransfer, action: 'approve' | 'reject') {
    if (!isOnline) { Alert.alert('Online Required', 'Approvals require an active connection.'); return; }
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    Alert.alert(
      `${verb} Transfer`,
      `${verb} transfer of ${item.quantity} ${item.uom} "${item.item_name}" from ${item.from_workshop} to ${item.to_workshop}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb, style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await approveTransfer({ movementId: item.id, action });
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not process transfer.');
            }
          },
        },
      ],
    );
  }

  function confirmMR(item: PendingMaterialRequest, action: 'approve' | 'reject') {
    if (!isOnline) { Alert.alert('Online Required', 'Approvals require an active connection.'); return; }
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    Alert.alert(
      `${verb} Request`,
      `${verb} request for ${item.requested_qty} ${item.uom} "${item.item_name}" from ${item.workshop_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb, style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await approveMaterialRequest({
                requestId:   item.id,
                action,
                approvedQty: action === 'approve' ? item.requested_qty : undefined,
              });
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not process request.');
            }
          },
        },
      ],
    );
  }

  if (isLoading) return <LoadingState message="Loading overview…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load workshop overview" onRetry={refetch} fullScreen />;

  const workshops  = data?.workshops         ?? [];
  const transfers  = data?.pendingTransfers  ?? [];
  const requests   = data?.pendingRequests   ?? [];
  const lowStock   = data?.lowStock          ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Workshop Overview" dark />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        <MetricsBanner
          total={workshops.length}
          active={workshops.filter(w => w.active).length}
          transfers={transfers.length}
          requests={requests.length}
          lowStockCount={lowStock.length}
        />

        {/* Workshop Cards */}
        <Text style={styles.sectionTitle}>Workshops</Text>
        {workshops.length === 0
          ? <EmptyState icon="business-outline" title="No workshops" subtitle="No workshop data available." />
          : workshops.map(w => <WorkshopCard key={w.id} item={w} />)
        }

        {/* Pending Transfers */}
        {transfers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Transfers ({transfers.length})</Text>
            {transfers.map(t => (
              <TransferRow
                key={t.id}
                item={t}
                canApprove={canApprove}
                onApprove={() => confirmTransfer(t, 'approve')}
                onReject={()  => confirmTransfer(t, 'reject')}
              />
            ))}
          </>
        )}

        {/* Pending Material Requests */}
        {requests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Material Requests ({requests.length})</Text>
            {requests.map(r => (
              <MRRow
                key={r.id}
                item={r}
                canApprove={canApprove}
                onApprove={() => confirmMR(r, 'approve')}
                onReject={()  => confirmMR(r, 'reject')}
              />
            ))}
          </>
        )}

        {/* Low Stock */}
        {lowStock.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Low Stock Alerts ({lowStock.length})</Text>
            {lowStock.map((item, idx) => <LowStockRow key={idx} item={item} />)}
          </>
        )}

        {workshops.length === 0 && transfers.length === 0 && requests.length === 0 && lowStock.length === 0 && (
          <EmptyState icon="business-outline" title="No data" subtitle="Workshop data will appear here." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  cardInactive: { opacity: 0.6 },
  cardHeader:   { gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardName:     { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardType:     { fontSize: Typography.xs, color: Colors.textMuted },
  cardLocation: { fontSize: Typography.xs, color: Colors.textSecondary },
  inactiveBadge:     { backgroundColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 10, color: Colors.textMuted },

  cardStats:     { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  cardStat:      { alignItems: 'center', gap: 2 },
  cardStatValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardStatLabel: { fontSize: 10, color: Colors.textMuted },

  pendingCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm, ...Shadow.sm,
  },
  pendingInfo:    { flex: 1, gap: 2 },
  pendingTitle:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  pendingMeta:    { fontSize: Typography.xs, color: Colors.textMuted },
  pendingMetaRow: { flexDirection: 'row', alignItems: 'center' },
  pendingReason:  { fontSize: Typography.xs, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  priorityBadge:  { fontSize: Typography.xs, fontWeight: Typography.semibold },
  pendingActions: { gap: Spacing.xs, flexDirection: 'column' },
  approveBtn: {
    backgroundColor: Colors.success, borderRadius: Radius.md,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.md,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },

  lowStockCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, ...Shadow.sm,
  },
  stockBadge:     { backgroundColor: Colors.error + '20', borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 4 },
  stockBadgeText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.error },
});
