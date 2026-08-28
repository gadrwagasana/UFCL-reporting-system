import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Alert, TextInput, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }             from '../../components/AppHeader';
import { SearchSkeleton }        from '../../components/SearchSkeleton';
import { ErrorState }            from '../../components/ErrorState';
import { EmptyState }            from '../../components/EmptyState';
import { ReasonModal }           from '../../components/ReasonModal';
import { StatusBadge }           from '../../components/StatusBadge';
import { Button }                from '../../components/Button';
import { ListSearchBar }         from '../../components/ListSearchBar';
import {
  useStockTransfersList, useStockTransferApprove, useStockTransferReceive,
  useStockTransferReportDiscrepancy,
} from '../../hooks/useStockTransfers';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import { loadSavedFilters, saveFilterPreset, removeFilterPreset, loadRecentlyViewed, type SavedFilterPreset, type RecentlyViewedEntry } from '../../utils/storage';
import type { StockTransfer, TransferVehicle } from '../../types/api';
import type { StockTransfersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<StockTransfersStackParamList, 'StockTransfersList'>;

// Inventory Integrity Phase 1 — mirrors DISCREPANCY_REASONS in
// db/services/data.js (server is the source of validation truth).
const DISCREPANCY_REASONS = [
  'Loss in Transit', 'Damaged During Transport', 'Short Shipment', 'Theft',
  'Write-off', 'Manual Count Adjustment', 'Expired Material', 'Other',
];

function LossReasonPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.lossReasonWrap}>
      {DISCREPANCY_REASONS.map((r) => (
        <TouchableOpacity
          key={r}
          style={[s.lossReasonChip, value === r && s.lossReasonChipActive]}
          onPress={() => onChange(r)}
          activeOpacity={0.7}
        >
          <Text style={[s.lossReasonChipText, value === r && s.lossReasonChipTextActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ dispatched, received, requested }: { dispatched: number; received: number; requested: number }) {
  const dispPct = requested > 0 ? Math.min(100, Math.round((dispatched / requested) * 100)) : 0;
  const recvPct = requested > 0 ? Math.min(100, Math.round((received  / requested) * 100)) : 0;
  return (
    <View>
      <Text style={s.progressText}>
        <Text style={s.progressLabel}>Disp: </Text>{dispatched}/{requested}
        {'  '}
        <Text style={s.progressLabel}>Recv: </Text>{received}/{requested}
      </Text>
      <View style={s.progressTrack}>
        <View style={[s.progressDisp, { width: `${dispPct}%` as any }]} />
        <View style={[s.progressRecv, { width: `${recvPct}%` as any }]} />
      </View>
    </View>
  );
}

// ── Receive modal ─────────────────────────────────────────────────────────────
function ReceiveModal({
  transfer, onClose, onConfirm, loading,
}: {
  transfer: StockTransfer | null;
  onClose: () => void;
  onConfirm: (qty: number, notes: string) => void;
  loading: boolean;
}) {
  const [qty, setQty]     = useState('');
  const [notes, setNotes] = useState('');
  const inTransit = transfer ? transfer.dispatched_qty - transfer.received_qty : 0;
  const canSubmit = Number(qty) > 0 && Number(qty) <= inTransit && !loading;

  React.useEffect(() => {
    if (!transfer) { setQty(''); setNotes(''); }
  }, [transfer]);

  return (
    <Modal visible={transfer !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Record Receipt</Text>
          {transfer && (
            <Text style={s.modalSub}>Receiving: {transfer.item_name} — in transit: {inTransit} {transfer.uom}</Text>
          )}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Quantity received <Text style={s.required}>*</Text></Text>
            <TextInput
              style={s.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholder={`Max: ${inTransit}`}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={s.field}>
            <Text style={s.fieldLabel}>Notes <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes…"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, !canSubmit && s.btnDisabled]}
              onPress={() => { if (canSubmit) onConfirm(Number(qty), notes.trim()); }}
              disabled={!canSubmit}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={s.confirmText}>Confirm Receipt</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Transfer row card ─────────────────────────────────────────────────────────
function TransferRow({
  item, canApprove, canAct,
  onApprove, onReject, onDispatch, onReceive, onDiscrepancy, onDetail,
}: {
  item: StockTransfer; canApprove: boolean; canAct: boolean;
  onApprove: () => void; onReject: () => void;
  onDispatch: () => void; onReceive: () => void; onDiscrepancy: () => void; onDetail: () => void;
}) {
  const showDispatch = canAct
    && ['approved', 'in_transit'].includes(item.status)
    && item.dispatched_qty < item.requested_qty;
  const showReceive  = canAct
    && ['in_transit', 'partially_received'].includes(item.status)
    && item.received_qty < item.dispatched_qty;
  const showDiscrepancy = canAct
    && ['approved', 'in_transit', 'partially_received'].includes(item.status)
    && item.received_qty < item.requested_qty;
  const showDetail   = item.dispatched_qty > 0;
  const fromMaterialRequest = !!item.reference && item.reference.startsWith('MAT-REQ-');

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          {item.reference && <Text style={s.reference}>{item.reference}</Text>}
          <Text style={s.dateText}>{item.requested_at}</Text>
          {fromMaterialRequest && <Text style={s.mrBadge}>Material Request</Text>}
        </View>
        <StatusBadge status={item.status} />
      </View>

      <Text style={s.itemName}>{item.item_name}</Text>
      <Text style={s.category}>{item.category}</Text>

      <View style={s.routeRow}>
        <Text style={s.warehouse} numberOfLines={1}>{item.from_warehouse_name}</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
        <Text style={s.warehouse} numberOfLines={1}>{item.to_warehouse_name}</Text>
      </View>

      <Text style={s.qty}>{item.requested_qty.toLocaleString()} <Text style={s.uom}>{item.uom}</Text></Text>

      <ProgressBar
        dispatched={item.dispatched_qty}
        received={item.received_qty}
        requested={item.requested_qty}
      />

      {item.status === 'rejected' && item.rejection_reason && (
        <Text style={s.rejectionReason}>{item.rejection_reason}</Text>
      )}

      {item.status === 'completed_with_discrepancy' && (
        <Text style={s.rejectionReason}>
          {item.discrepancy_qty ?? 0} {item.uom} short{item.discrepancy_notes ? `: ${item.discrepancy_notes}` : ''}
        </Text>
      )}

      {item.requested_by && (
        <Text style={s.requestedBy}>Requested by {item.requested_by}</Text>
      )}

      {(canApprove && item.status === 'pending') || showDispatch || showReceive || showDiscrepancy || showDetail ? (
        <View style={s.actions}>
          {canApprove && item.status === 'pending' && (
            <>
              <Button label="Approve" icon="checkmark" size="sm" color={Colors.success} onPress={onApprove} />
              <Button label="Reject" icon="close" size="sm" color={Colors.error} onPress={onReject} />
            </>
          )}
          {showDispatch && (
            <Button label="Dispatch" icon="car-outline" size="sm" color={Colors.navy} onPress={onDispatch} />
          )}
          {showReceive && (
            <Button label="Receive" icon="download-outline" size="sm" color={Colors.statusInTransitText} onPress={onReceive} />
          )}
          {showDiscrepancy && (
            <Button label="Short/Damaged" icon="alert-circle-outline" size="sm" color={Colors.error} onPress={onDiscrepancy} />
          )}
          {showDetail && (
            <TouchableOpacity style={s.detailBtn} onPress={onDetail} activeOpacity={0.8}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function StockTransfersListScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role ?? '');
  const canApprove = hasPermission(role as any, 'transfer.approve');
  const canAct     = hasPermission(role as any, 'transfer.act');

  const { data, isLoading, isError, refetch, isRefetching } = useStockTransfersList();
  const approveMutation    = useStockTransferApprove();
  const receiveMutation    = useStockTransferReceive();
  const discrepancyMutation = useStockTransferReportDiscrepancy();

  const [rejectTarget,     setRejectTarget]     = useState<StockTransfer | null>(null);
  const [receiveTarget,    setReceiveTarget]    = useState<StockTransfer | null>(null);
  const [discrepancyTarget, setDiscrepancyTarget] = useState<StockTransfer | null>(null);
  const [lossReason, setLossReason] = useState(DISCREPANCY_REASONS[0]);
  const [actionLoading, setActionLoading] = useState(false);
  // Phase 2 (Inventory) — in-screen search/filter, matching the toolkit
  // added to desktop's Stock Transfers page in the same phase.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Enterprise UI/UX Standardization Phase 3 — Saved Filters reference
  // implementation; see loadSavedFilters()/saveFilterPreset() in utils/storage.ts.
  type TransferFilterValues = { search: string; statusFilter: string };
  const [presets, setPresets] = useState<SavedFilterPreset<TransferFilterValues>[]>([]);
  const [savingPresetName, setSavingPresetName] = useState<string | null>(null);
  useEffect(() => {
    loadSavedFilters<TransferFilterValues>('stock-transfers').then(setPresets);
  }, []);
  function applyPreset(p: SavedFilterPreset<TransferFilterValues>) {
    setSearch(p.filterValues.search);
    setStatusFilter(p.filterValues.statusFilter);
  }
  async function handleSavePreset() {
    if (!savingPresetName?.trim()) return;
    const next = await saveFilterPreset<TransferFilterValues>('stock-transfers', savingPresetName.trim(), { search, statusFilter });
    setPresets(next);
    setSavingPresetName(null);
  }
  async function handleRemovePreset(id: string) {
    setPresets(await removeFilterPreset<TransferFilterValues>('stock-transfers', id));
  }

  // Enterprise UI/UX Standardization Phase 3 — Recently Viewed reference
  // implementation; pushed from StockTransferDetailScreen on open.
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  useEffect(() => {
    loadRecentlyViewed('stock-transfer').then(setRecentlyViewed);
  }, []);

  // Enterprise UI/UX Standardization Phase 3 — SearchSkeleton adopted here
  // as proof the component (previously procurement-only) generalizes to a
  // non-procurement list screen with the same search-bar-plus-rows shape.
  if (isLoading) return <SearchSkeleton rows={6} />;
  if (isError)   return <ErrorState  message="Could not load stock transfers" onRetry={refetch} fullScreen />;

  const { rows: allRows, items, vehicles, summary, user_workshop_id } = data!;
  const STATUS_OPTIONS = ['all', 'pending', 'approved', 'in_transit', 'partially_received', 'completed', 'rejected'];
  const rows = allRows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return r.item_name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.reference ?? '').toLowerCase().includes(q) ||
      r.from_warehouse_name.toLowerCase().includes(q) ||
      r.to_warehouse_name.toLowerCase().includes(q);
  });

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await approveMutation.mutateAsync({ id, action: 'approve' });
      if (!(res as any).ok) Alert.alert('Error', (res as any).error ?? 'Approval failed');
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setRejectTarget(null);
    setActionLoading(true);
    try {
      const res = await approveMutation.mutateAsync({ id, action: 'reject', rejectionReason: reason || undefined });
      if (!(res as any).ok) Alert.alert('Error', (res as any).error ?? 'Rejection failed');
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  const handleReceive = async (qty: number, notes: string) => {
    if (!receiveTarget) return;
    const id = receiveTarget.id;
    setReceiveTarget(null);
    setActionLoading(true);
    try {
      const res = await receiveMutation.mutateAsync({ id, qty, notes: notes || undefined });
      if (!(res as any).ok) {
        Alert.alert('Error', (res as any).error ?? 'Receipt failed');
      } else {
        Alert.alert('Receipt Recorded', (res as any).completed
          ? 'Transfer completed — all items received.'
          : 'Receipt recorded — stock added to destination.');
      }
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  const handleDiscrepancy = async (reason: string) => {
    if (!discrepancyTarget) return;
    const id = discrepancyTarget.id;
    const uom = discrepancyTarget.uom;
    const reasonType = lossReason;
    setDiscrepancyTarget(null);
    setLossReason(DISCREPANCY_REASONS[0]);
    setActionLoading(true);
    try {
      const res = await discrepancyMutation.mutateAsync({ id, notes: reason, lossReason: reasonType });
      if (!(res as any).ok) {
        Alert.alert('Error', (res as any).error ?? 'Could not close transfer');
      } else {
        Alert.alert('Transfer Closed', `${(res as any).discrepancyQty} ${uom} recorded as short (${reasonType}). Inventory movement #${(res as any).movementId} created.`);
      }
    } catch { Alert.alert('Error', 'Action failed. Please try again.'); }
    finally   { setActionLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Stock Transfers"
        subtitle="Request → Approval → Dispatch → Receipt"
        searchModule="stock_transfers"
        dark
        actions={canAct ? [{ icon: 'add', onPress: () => navigation.navigate('StockTransferNewRequest') }] : []}
      />
      <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search item, category, reference, warehouse…" />
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            {/* KPI banner — server-computed */}
            <View style={s.banner}>
              <View style={s.stat}>
                <Text style={s.statValue}>{summary.total}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statValue, summary.pending > 0 && { color: Colors.warning }]}>{summary.pending}</Text>
                <Text style={s.statLabel}>Pending</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>{summary.inTransit}</Text>
                <Text style={s.statLabel}>In Transit</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statValue, { color: Colors.success }]}>{summary.completed}</Text>
                <Text style={s.statLabel}>Completed</Text>
              </View>
            </View>

            {/* Enterprise UI/UX Standardization Phase 3 — Recently Viewed */}
            {recentlyViewed.length > 0 && (
              <View style={s.recentWrap}>
                <Text style={s.recentTitle}><Ionicons name="time-outline" size={12} color={Colors.textMuted} /> Recently Viewed</Text>
                <View style={s.recentChips}>
                  {recentlyViewed.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={s.recentChip}
                      onPress={() => navigation.navigate('StockTransferDetail', { transferId: Number(r.id) })}
                      activeOpacity={0.7}
                    >
                      <Text style={s.recentChipText}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Workshop filter notice for restricted roles */}
            {user_workshop_id && (
              <View style={s.workshopBanner}>
                <Ionicons name="business-outline" size={14} color={Colors.info} />
                <Text style={s.workshopText}>Showing transfers for your workshop</Text>
              </View>
            )}
            <FlatList
              horizontal
              data={STATUS_OPTIONS}
              keyExtractor={t => t}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={[s.chip, statusFilter === t && s.chipActive]}
                  onPress={() => setStatusFilter(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, statusFilter === t && s.chipTextActive]}>
                    {t === 'all' ? 'All' : t.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {/* Enterprise UI/UX Standardization Phase 3 — Saved Filters */}
            <View style={s.savedFiltersRow}>
              {presets.map((p) => (
                <View key={p.id} style={s.presetChip}>
                  <TouchableOpacity onPress={() => applyPreset(p)} activeOpacity={0.7}>
                    <Text style={s.presetChipText}>{p.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemovePreset(p.id)} hitSlop={8} accessibilityLabel={`Remove ${p.name} filter preset`}>
                    <Ionicons name="close" size={12} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              ))}
              {savingPresetName === null ? (
                <TouchableOpacity style={s.presetSaveBtn} onPress={() => setSavingPresetName('')} activeOpacity={0.7}>
                  <Ionicons name="bookmark-outline" size={12} color={Colors.navy} />
                  <Text style={s.presetSaveBtnText}>Save current filters</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.presetNameRow}>
                  <TextInput
                    style={s.presetNameInput}
                    value={savingPresetName}
                    onChangeText={setSavingPresetName}
                    placeholder="Preset name…"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                    maxLength={40}
                    onSubmitEditing={handleSavePreset}
                  />
                  <TouchableOpacity onPress={handleSavePreset} hitSlop={8}><Ionicons name="checkmark" size={18} color={Colors.success} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => setSavingPresetName(null)} hitSlop={8}><Ionicons name="close" size={18} color={Colors.textMuted} /></TouchableOpacity>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TransferRow
            item={item}
            canApprove={canApprove}
            canAct={canAct}
            onApprove={() => handleApprove(item.id)}
            onReject={() => setRejectTarget(item)}
            onDispatch={() => navigation.navigate('StockTransferDispatch', {
              transferId: item.id,
              remaining:  item.requested_qty - item.dispatched_qty,
              itemName:   item.item_name,
              uom:        item.uom,
              vehicles,
            })}
            onReceive={() => setReceiveTarget(item)}
            onDiscrepancy={() => setDiscrepancyTarget(item)}
            onDetail={()  => navigation.navigate('StockTransferDetail', { transferId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="swap-horizontal-outline"
            title={search || statusFilter !== 'all' ? 'No matching transfers' : 'No transfers yet'}
            subtitle={search || statusFilter !== 'all' ? 'Try a different search or filter.' : (canAct ? 'Tap + to request a stock transfer.' : 'No stock transfers have been recorded.')}
          />
        }
      />

      {/* Reject modal — reason is optional (allowEmpty) to match desktop */}
      <ReasonModal
        visible={rejectTarget !== null}
        title={`Reject transfer #${rejectTarget?.id ?? ''}`}
        message="Provide a reason for rejection (optional)."
        confirmLabel="Reject"
        allowEmpty
        loading={actionLoading}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />

      <ReceiveModal
        transfer={receiveTarget}
        onClose={() => setReceiveTarget(null)}
        onConfirm={handleReceive}
        loading={actionLoading}
      />

      <ReasonModal
        visible={discrepancyTarget !== null}
        title={`Close transfer #${discrepancyTarget?.id ?? ''} as short/damaged`}
        message={discrepancyTarget ? `${discrepancyTarget.requested_qty - discrepancyTarget.received_qty} ${discrepancyTarget.uom} will be recorded as never delivered, and a matching inventory movement will be created. Pick a movement type, then explain why.` : ''}
        confirmLabel="Close Transfer"
        loading={actionLoading}
        onCancel={() => { setDiscrepancyTarget(null); setLossReason(DISCREPANCY_REASONS[0]); }}
        onConfirm={handleDiscrepancy}
        extraContent={<LossReasonPicker value={lossReason} onChange={setLossReason} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  lossReasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.xs },
  lossReasonChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 5, paddingHorizontal: Spacing.sm, backgroundColor: Colors.card },
  lossReasonChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  lossReasonChipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  lossReasonChipTextActive: { color: Colors.white },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm, marginBottom: Spacing.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  recentWrap: { marginBottom: Spacing.sm },
  recentTitle: { fontSize: 10, color: Colors.textMuted, fontWeight: Typography.medium, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  recentChip: {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  recentChipText: { fontSize: Typography.xs, color: Colors.textPrimary },

  workshopBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.infoBg, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  workshopText: { fontSize: Typography.xs, color: Colors.info },

  chips: { gap: Spacing.xs, paddingBottom: Spacing.xs },
  chip: {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:       { fontSize: Typography.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: Colors.white, fontWeight: Typography.medium },

  savedFiltersRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  presetChipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  presetSaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.navy, borderStyle: 'dashed',
  },
  presetSaveBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  presetNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, minWidth: 160 },
  presetNameInput: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, fontSize: Typography.xs, color: Colors.textPrimary,
    backgroundColor: Colors.card,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, gap: Spacing.xs,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  reference:   { fontSize: Typography.xs, fontFamily: 'monospace', color: Colors.textMuted },
  dateText:    { fontSize: 11, color: Colors.textMuted },
  mrBadge:     { fontSize: 10, color: Colors.info, fontWeight: Typography.medium, marginTop: 1 },

  itemName:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  category:  { fontSize: 11, color: Colors.textMuted },

  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  warehouse: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },

  qty: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },
  uom: { fontSize: Typography.xs, fontWeight: '400', color: Colors.textMuted },

  progressText:  { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  progressLabel: { color: Colors.textSecondary },
  progressTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  progressDisp:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.navy, opacity: 0.45 },
  progressRecv:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.success },

  rejectionReason: { fontSize: Typography.xs, color: Colors.error, fontStyle: 'italic' },
  requestedBy:     { fontSize: 11, color: Colors.textMuted },

  actions: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  detailBtn:   { marginLeft: 'auto', padding: 4 },

  // Receive modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: Spacing.xl },
  modalCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  modalSub:     { fontSize: Typography.xs, color: Colors.textSecondary },
  field:        { gap: 4 },
  fieldLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  required:     { color: Colors.error },
  optional:     { fontWeight: '400', color: Colors.textMuted },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { fontSize: Typography.sm, color: Colors.textSecondary },
  confirmBtn: { flex: 2, backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmText:{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled:{ opacity: 0.4 },
});
