import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }          from '../../components/AppHeader';
import { LoadingState }       from '../../components/LoadingState';
import { ErrorState }         from '../../components/ErrorState';
import { EmptyState }         from '../../components/EmptyState';
import { DeletionReasonModal } from '../../components/DeletionReasonModal';
import { useStockItems, useStockItemDelete, useStockConsume } from '../../hooks/useStock';
import { useAuthStore }   from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { hasPermission }  from '../../utils/permissions';
import type { StockItem } from '../../types/api';
import { StockCatalogStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<StockCatalogStackParamList, 'StockCatalogList'>;

// ── Consume Modal ─────────────────────────────────────────────────────────────
interface ConsumeModalProps {
  item: StockItem;
  warehouses: Array<{ id: number; name: string }>;
  onClose: () => void;
  userWorkshopId?: number;
}
function ConsumeModal({ item, warehouses, onClose, userWorkshopId }: ConsumeModalProps) {
  const { consumeStock } = useStockConsume();
  const { isOnline }     = useOfflineStore();

  const defaultWh  = warehouses.find(w => w.id === userWorkshopId) ?? warehouses[0];
  const [qty,      setQty]      = useState('1');
  const [whId,     setWhId]     = useState(defaultWh?.id ?? 0);
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);

  async function handleConsume() {
    if (!isOnline) { Alert.alert('Online Required', 'Consumption requires a connection.'); return; }
    const q = parseFloat(qty);
    if (!q || q <= 0) { Alert.alert('Invalid', 'Enter a quantity greater than 0.'); return; }
    if (!whId)        { Alert.alert('Invalid', 'Select a warehouse.'); return; }
    setSaving(true);
    try {
      await consumeStock({ item_id: item.id, quantity: q, warehouse_id: whId, notes: notes.trim() || undefined });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not record consumption.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Use: {item.name}</Text>
        <Text style={styles.sheetSub}>Current stock: {item.total_stock} {item.uom}</Text>

        <Text style={styles.fieldLabel}>Quantity ({item.uom})</Text>
        <TextInput
          style={styles.fieldInput}
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          placeholder="1"
          placeholderTextColor={Colors.textMuted}
        />

        {warehouses.length > 1 && (
          <>
            <Text style={styles.fieldLabel}>Warehouse</Text>
            <View style={styles.whRow}>
              {warehouses.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.whChip, whId === w.id && styles.whChipActive]}
                  onPress={() => setWhId(w.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.whChipText, whId === w.id && styles.whChipTextActive]}>
                    {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.fieldInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Purpose or reference…"
          placeholderTextColor={Colors.textMuted}
        />

        <TouchableOpacity
          style={[styles.consumeBtn, saving && styles.btnDisabled]}
          onPress={handleConsume}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.consumeBtnText}>Record Usage</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export function StockCatalogScreen() {
  const navigation  = useNavigation<NavProp>();
  const role        = useAuthStore(s => s.user?.role ?? '');
  const { isOnline } = useOfflineStore();
  const { data, isLoading, isError, refetch, isRefetching } = useStockItems();
  const { deleteStockItem } = useStockItemDelete();

  const canManage = hasPermission(role as any, 'stock.catalog');

  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('All');
  const [consumeItem, setConsumeItem] = useState<StockItem | null>(null);
  const [deleteItem,  setDeleteItem]  = useState<StockItem | null>(null);

  const rows       = data?.rows ?? [];
  const warehouses = data?.warehouses ?? [];
  const categories = data?.categories ?? [];
  const userWsId   = data?.user_workshop_id;

  const catOptions = ['All', ...categories.map(c => c.name)];

  const filtered = useMemo(() => {
    let r = rows;
    if (catFilter !== 'All') r = r.filter(i => i.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, search, catFilter]);

  const lowStock   = rows.filter(i => Number(i.total_stock) <= Number(i.min_stock));
  const totalValue = rows.reduce((s, i) => s + Number(i.total_stock) * Number(i.unit_cost), 0);

  async function handleDelete(reason: string) {
    if (!deleteItem) return;
    await deleteStockItem({ id: deleteItem.id, reason });
    setDeleteItem(null);
  }

  if (isLoading) return <LoadingState message="Loading stock catalog…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load stock catalog" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Stock Catalog"
        dark
        actions={canManage ? [
          { icon: 'pricetag-outline', onPress: () => navigation.navigate('StockCategories') },
          { icon: 'add-circle-outline', onPress: () => navigation.navigate('StockItemForm', {}) },
        ] : undefined}
      />

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            {/* Metrics */}
            <View style={styles.banner}>
              {[
                { label: 'Items',    value: String(rows.length) },
                { label: 'Reorder',  value: String(lowStock.length), accent: lowStock.length > 0 },
                { label: 'Cats',     value: String(categories.length) },
                { label: 'Val (RWF)', value: Math.round(totalValue / 1000) + 'k' },
              ].map(s => (
                <View key={s.label} style={styles.stat}>
                  <Text style={[styles.statValue, (s as any).accent && { color: Colors.error }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Low-stock alert */}
            {lowStock.length > 0 && (
              <View style={styles.alertBanner}>
                <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                <Text style={styles.alertText}>
                  {lowStock.length} item{lowStock.length > 1 ? 's' : ''} at or below reorder level
                </Text>
              </View>
            )}

            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search items…"
                placeholderTextColor={Colors.textMuted}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Category filter chips */}
            <FlatList
              horizontal
              data={catOptions}
              keyExtractor={c => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.chip, catFilter === c && styles.chipActive]}
                  onPress={() => setCatFilter(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, catFilter === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              )}
            />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={search || catFilter !== 'All' ? 'No matches' : 'No stock items'}
            subtitle={search || catFilter !== 'All' ? 'Try a different search or filter.' : 'Add your first stock item.'}
          />
        }
        renderItem={({ item }) => {
          const low = Number(item.total_stock) <= Number(item.min_stock);
          const out = Number(item.total_stock) === 0;
          return (
            <View style={[styles.row, out && styles.rowOut, !out && low && styles.rowLow]}>
              <View style={styles.rowHead}>
                <View style={styles.catBadge}><Text style={styles.catText}>{item.category}</Text></View>
                {out && <View style={styles.badgeRed}><Text style={styles.badgeText}>Out</Text></View>}
                {!out && low && <View style={styles.badgeAmber}><Text style={styles.badgeText}>Reorder</Text></View>}
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.sku ? <Text style={styles.sku}>{item.sku}</Text> : null}
              <View style={styles.rowMeta}>
                <Text style={[styles.stockQty, out ? styles.stockRed : low ? styles.stockAmber : styles.stockOk]}>
                  {item.total_stock} <Text style={styles.uom}>{item.uom}</Text>
                </Text>
                <Text style={styles.metaText}>Min {item.min_stock}</Text>
                <Text style={styles.metaText}>RWF {Number(item.unit_cost).toLocaleString()}/u</Text>
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setConsumeItem(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.navy} />
                  <Text style={styles.actionText}>Use</Text>
                </TouchableOpacity>
                {canManage && (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => navigation.navigate('StockItemForm', { item })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={16} color={Colors.navy} />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionDanger]}
                      onPress={() => {
                        if (!isOnline) { Alert.alert('Online Required', 'Deleting requires a connection.'); return; }
                        setDeleteItem(item);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        }}
      />

      {consumeItem && (
        <ConsumeModal
          item={consumeItem}
          warehouses={warehouses}
          userWorkshopId={userWsId}
          onClose={() => setConsumeItem(null)}
        />
      )}

      {deleteItem && (
        <DeletionReasonModal
          visible
          title={`Delete "${deleteItem.name}"?`}
          onCancel={() => setDeleteItem(null)}
          onConfirm={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm, marginBottom: Spacing.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warning + '15', borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  alertText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, marginBottom: Spacing.xs,
    ...Shadow.sm,
  },
  searchIcon:  { marginRight: Spacing.xs },
  searchInput: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, paddingVertical: Spacing.sm },

  chips: { gap: Spacing.xs, paddingBottom: Spacing.xs },
  chip: {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:       { fontSize: Typography.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: Typography.medium },

  row: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  rowOut: { borderLeftColor: Colors.error },
  rowLow: { borderLeftColor: Colors.warning },

  rowHead:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  sku:      { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  rowMeta:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },

  stockQty:   { fontSize: Typography.sm, fontWeight: Typography.bold },
  stockRed:   { color: Colors.error },
  stockAmber: { color: Colors.warning },
  stockOk:    { color: Colors.success },
  uom:        { fontSize: Typography.xs, fontWeight: '400', color: Colors.textMuted },
  metaText:   { fontSize: Typography.xs, color: Colors.textSecondary },

  catBadge: { backgroundColor: Colors.navy + '15', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  catText:  { fontSize: 10, color: Colors.navy, fontWeight: Typography.medium },
  badgeRed:   { backgroundColor: Colors.error + '20', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeAmber: { backgroundColor: Colors.warning + '20', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:  { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textPrimary },

  rowActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: Colors.navy + '10', borderRadius: Radius.sm,
  },
  actionDanger: { backgroundColor: Colors.error + '10' },
  actionText:   { fontSize: 11, color: Colors.navy, fontWeight: Typography.medium },

  // Sheet (consume modal)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  sheetTitle:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  sheetSub:    { fontSize: Typography.xs, color: Colors.textSecondary },
  fieldLabel:  { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary },
  fieldInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    fontSize: Typography.base, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  whRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  whChip:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  whChipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  whChipText:     { fontSize: Typography.xs, color: Colors.textSecondary },
  whChipTextActive: { color: Colors.white, fontWeight: Typography.medium },
  consumeBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  btnDisabled:    { opacity: 0.5 },
  consumeBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  cancelBtn:      { alignItems: 'center', paddingVertical: Spacing.xs },
  cancelText:     { fontSize: Typography.sm, color: Colors.textMuted },
});
