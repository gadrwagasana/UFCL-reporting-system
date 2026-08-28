import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }     from '../../components/AppHeader';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { KpiCard }       from '../../components/KpiCard';
import { ReasonModal }   from '../../components/ReasonModal';
import { useShowroomInventory, useShowroomDamageList, useShowroomDamageCreate } from '../../hooks/useShowroom';
import { useResolutionCreate } from '../../hooks/useTimberLifecycle';
import { ShowroomInventoryRow, ShowroomDamageReportRow } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const SHOWROOM_WAREHOUSE_ID = 5;

// Timber Lifecycle Phase 3 (Workstream 12) — genuinely new: no existing
// Showroom-specific screen or backend beyond a warehouse row and a role.
// Direct sale is NOT duplicated here — that already works generically on
// the existing Sales Orders tab with Showroom selected as the workshop.
//
// Stock & Inventory Phase 4 (audit finding H-13) — the quantity/reason
// capture used to be two chained Alert.prompt calls, which is iOS-only
// (react-native has no Android implementation); an Android user tapping
// "Report Damage" got no dialog and no error, a silent dead end. The item
// picker (Alert.alert with a button per item, no text input) is unaffected
// and stays as-is — only the quantity+reason capture moves to ReasonModal,
// the same cross-platform component 14 other screens already use, via its
// existing `extraContent` slot (built for exactly this "needs more than
// free text" case) for the quantity field.
function handleReportDamage(rows: ShowroomInventoryRow[], onPick: (item: ShowroomInventoryRow) => void) {
  if (!rows.length) { Alert.alert('No Stock', 'No showroom stock to report as damaged.'); return; }
  Alert.alert('Report Damaged Stock', 'Select the item to report:', [
    ...rows.map(r => ({
      text: `${r.name} (${r.stock} available)`,
      onPress: () => onPick(r),
    })),
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function InventoryRow({ item }: { item: ShowroomInventoryRow }) {
  return (
    <View style={styles.invRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.invName}>{item.name}</Text>
        <Text style={styles.invMeta}>{item.category}{item.sku ? ` · ${item.sku}` : ''}</Text>
      </View>
      <Text style={styles.invStock}>{item.stock.toLocaleString()}</Text>
    </View>
  );
}

function DamageRow({ item, onResolve }: { item: ShowroomDamageReportRow; onResolve: () => void }) {
  return (
    <View style={styles.dmgRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.invName}>{item.stock_item_name ?? 'Unknown'}</Text>
        <Text style={styles.invMeta}>{item.quantity} units · {item.reason}</Text>
      </View>
      {item.status === 'pending' ? (
        <TouchableOpacity style={styles.resolveBtn} onPress={onResolve}>
          <Text style={styles.resolveBtnText}>Resolve</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.resolvedBadge}><Text style={styles.resolvedBadgeText}>Resolved</Text></View>
      )}
    </View>
  );
}

export function ShowroomScreen() {
  const { data: invData, isLoading, isError, refetch, isRefetching } = useShowroomInventory();
  const { data: dmgData, refetch: refetchDamage } = useShowroomDamageList();
  const { report } = useShowroomDamageCreate();
  const { resolve } = useResolutionCreate();

  const rows = invData?.rows ?? [];
  const dmgRows = dmgData?.rows ?? [];
  const totalUnits = rows.reduce((s, r) => s + r.stock, 0);
  const pendingCount = dmgRows.filter(d => d.status === 'pending').length;

  // Stock & Inventory Phase 4 (audit finding H-13) — state for the
  // cross-platform damage-report modal replacing the iOS-only Alert.prompt
  // chain (see handleReportDamage above).
  const [damageItem, setDamageItem] = useState<ShowroomInventoryRow | null>(null);
  const [damageQty, setDamageQty] = useState('');
  const [reportingDamage, setReportingDamage] = useState(false);

  function closeDamageModal() { setDamageItem(null); setDamageQty(''); }

  async function submitDamage(reason: string) {
    if (!damageItem) return;
    const qty = Number(damageQty);
    if (!damageQty || Number.isNaN(qty) || qty <= 0 || qty > damageItem.stock) {
      Alert.alert('Invalid Quantity', `Enter a number between 1 and ${damageItem.stock}.`);
      return;
    }
    setReportingDamage(true);
    try {
      await report({ stock_item_id: damageItem.id, warehouse_id: SHOWROOM_WAREHOUSE_ID, quantity: qty, reason });
      closeDamageModal();
      Alert.alert('Reported', 'Removed from sellable stock — pending resolution.');
      refreshAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to report damage.');
    } finally {
      setReportingDamage(false);
    }
  }

  function refreshAll() { refetch(); refetchDamage(); }

  function handleResolve(d: ShowroomDamageReportRow) {
    Alert.alert('Resolve To', `Choose a destination for ${d.quantity} unit(s).`, [
      {
        text: 'Disposal', onPress: async () => {
          try { await resolve({ source_type: 'showroom_damage', source_id: d.id, destination: 'Disposal', volume: d.quantity }); refreshAll(); }
          catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to resolve.'); }
        },
      },
      { text: 'Firewood / Scrap Sale (needs desktop)', onPress: () => Alert.alert('Use Desktop', 'This destination needs a warehouse — please use the desktop app to complete this resolution.') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (isLoading) return <LoadingState message="Loading showroom stock…" fullScreen />;
  if (isError) return <ErrorState message="Could not load showroom stock" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Showroom" subtitle="Stock, damage checks and sales" dark />
      <FlatList
        data={dmgRows}
        keyExtractor={(item) => `dmg-${item.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshAll} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            <View style={styles.tileGrid}>
              <KpiCard variant="tile" title="Items" value={rows.length} />
              <KpiCard variant="tile" title="Total units" value={totalUnits} />
              <KpiCard variant="tile" title="Pending damage" value={pendingCount} warn={pendingCount > 0} />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Inventory</Text>
                <TouchableOpacity style={styles.reportBtn} onPress={() => handleReportDamage(rows, setDamageItem)}>
                  <Text style={styles.reportBtnText}>Report Damage</Text>
                </TouchableOpacity>
              </View>
              {rows.length === 0 ? (
                <Text style={styles.emptyText}>No stock at the Showroom yet.</Text>
              ) : rows.map(r => <InventoryRow key={r.id} item={r} />)}
            </View>

            <Text style={styles.sectionTitle}>Damage reports</Text>
          </>
        }
        ListEmptyComponent={<EmptyState icon="checkmark-circle-outline" title="No damage reported" subtitle="Nothing to resolve." />}
        renderItem={({ item }) => <DamageRow item={item} onResolve={() => handleResolve(item)} />}
      />
      <ReasonModal
        visible={!!damageItem}
        title="Report Damaged Stock"
        message={damageItem ? `${damageItem.name} — how many of ${damageItem.stock} units are damaged, and why?` : ''}
        confirmLabel="Report"
        loading={reportingDamage}
        onCancel={closeDamageModal}
        onConfirm={submitDamage}
        extraContent={
          <TextInput
            style={styles.qtyInput}
            value={damageQty}
            onChangeText={setDamageQty}
            placeholder="Quantity damaged"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  qtyInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm, marginBottom: Spacing.base },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptyText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },

  reportBtn: { backgroundColor: Colors.warning, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  reportBtnText: { fontSize: Typography.xs, color: Colors.white, fontWeight: Typography.semibold },

  invRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },
  invName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  invMeta: { fontSize: Typography.xs, color: Colors.textMuted },
  invStock: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace' },

  dmgRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  resolveBtn: { borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  resolveBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  resolvedBadge: { backgroundColor: Colors.successBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  resolvedBadgeText: { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },
});
