import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, FlatList, Modal,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp }     from '@react-navigation/native-stack';
import { AppHeader }   from '../../components/AppHeader';
import { FormSelect }  from '../../components/FormSelect';
import { FormInput }   from '../../components/FormInput';
import { useStockMovementCreate, useStockAdjustmentRequestCreate } from '../../hooks/useStock';
import { useOfflineStore } from '../../stores/offlineStore';
import type { StockItem } from '../../types/api';
import { StockMovementsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<StockMovementsStackParamList, 'StockMovementForm'>;
type RoutePropT = RouteProp<StockMovementsStackParamList, 'StockMovementForm'>;

// Phase 1 (Inventory consolidation) — 'Transfer' removed: moving stock
// between warehouses now goes exclusively through the dedicated Stock
// Transfers screens (request→approve→dispatch→receive), not this shortcut.
const MOVEMENT_TYPES = [
  { label: 'Stock In',    value: 'in' },
  { label: 'Stock Out',   value: 'out' },
  { label: 'Adjustment',  value: 'adjustment' },
  { label: 'Return',      value: 'return' },
] as const;

// ── Item Picker Modal ─────────────────────────────────────────────────────────
function ItemPickerModal({ items, onSelect, onClose }: {
  items: StockItem[];
  onSelect: (item: StockItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = q.trim()
    ? items.filter(i =>
        i.name.toLowerCase().includes(q.toLowerCase()) ||
        (i.sku ?? '').toLowerCase().includes(q.toLowerCase()) ||
        i.category.toLowerCase().includes(q.toLowerCase())
      )
    : items;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.pickerSheet}>
        <Text style={styles.pickerTitle}>Select Item</Text>
        <View style={styles.pickerSearch}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.pickerInput}
            value={q}
            onChangeText={setQ}
            placeholder="Search…"
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          style={styles.pickerList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pickerRow} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
              <View>
                <Text style={styles.pickerName}>{item.name}</Text>
                <Text style={styles.pickerMeta}>{item.category} · {item.total_stock} {item.uom} in stock</Text>
              </View>
              <Text style={styles.pickerCost}>RWF {Number(item.unit_cost).toLocaleString()}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function StockMovementFormScreen() {
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RoutePropT>();
  const { items, warehouses, userWorkshopId } = route.params;
  const { isOnline } = useOfflineStore();
  const { createMovement } = useStockMovementCreate();
  const { requestAdjustment } = useStockAdjustmentRequestCreate();

  const defaultWh = warehouses.find(w => w.id === userWorkshopId) ?? warehouses[0];

  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movType,      setMovType]      = useState<string>('in');
  const [quantity,     setQuantity]     = useState('');
  const [unitCost,     setUnitCost]     = useState('');
  const [fromWh,       setFromWh]       = useState(defaultWh?.id?.toString() ?? '');
  const [reference,    setReference]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [showPicker,   setShowPicker]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // Auto-fill unit cost when item selected
  useEffect(() => {
    if (selectedItem?.default_unit_cost != null) {
      setUnitCost(String(selectedItem.default_unit_cost));
    } else if (selectedItem?.unit_cost != null) {
      setUnitCost(String(selectedItem.unit_cost));
    }
  }, [selectedItem]);

  const whOptions = warehouses.map(w => ({ label: w.name, value: String(w.id) }));

  async function handleSubmit() {
    if (!isOnline) { Alert.alert('Online Required', 'Recording movements requires a connection.'); return; }
    if (!selectedItem) { Alert.alert('Required', 'Select an item.'); return; }
    const q = parseFloat(quantity);
    const isAdjustment = movType === 'adjustment';
    // Stock & Inventory Phase 3 — adjustment quantity is the target ("set
    // to"), which can legitimately be 0 (e.g. a recount finds nothing
    // left); every other type is a positive delta.
    if (!Number.isFinite(q) || (isAdjustment ? q < 0 : q <= 0)) { Alert.alert('Required', 'Enter a valid quantity.'); return; }
    if (!fromWh) { Alert.alert('Required', 'Select a warehouse.'); return; }
    // Phase 2 (Stock Adjustments) — same reason requirement enforced server-side.
    if (isAdjustment && !notes.trim()) { Alert.alert('Required', 'A reason is required for stock adjustments.'); return; }

    setSubmitting(true);
    try {
      if (isAdjustment) {
        // Stock & Inventory Phase 3 (Priority 4/5) — adjustments now
        // require manager approval instead of writing stock_levels
        // immediately; submits a request instead of an immediate movement.
        await requestAdjustment({
          item_id:      selectedItem.id,
          quantity:     q,
          warehouse_id: parseInt(fromWh, 10),
          reference:    reference.trim() || null,
          notes:        notes.trim(),
        });
        Alert.alert('Request submitted', 'Adjustment request submitted — awaiting manager approval.');
      } else {
        const payload: Record<string, unknown> = {
          item_id:       selectedItem.id,
          movement_type: movType,
          quantity:      q,
          unit_cost:     parseFloat(unitCost) || selectedItem.unit_cost,
          warehouse_id:  parseInt(fromWh, 10),
          reference:     reference.trim() || null,
          notes:         notes.trim() || null,
        };
        await createMovement(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not record movement.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Record Movement" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Item picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock Item</Text>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            {selectedItem ? (
              <View>
                <Text style={styles.pickerTriggerName}>{selectedItem.name}</Text>
                <Text style={styles.pickerTriggerMeta}>
                  {selectedItem.category} · {selectedItem.total_stock} {selectedItem.uom}
                </Text>
              </View>
            ) : (
              <Text style={styles.pickerTriggerPlaceholder}>Tap to select item…</Text>
            )}
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Movement type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movement Details</Text>
          <FormSelect
            label="Type *"
            value={movType}
            onChange={v => setMovType(String(v))}
            options={MOVEMENT_TYPES as unknown as Array<{ label: string; value: string }>}
          />
          <FormInput
            label="Quantity *"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="numeric"
          />
          <FormInput
            label="Unit Cost (RWF)"
            value={unitCost}
            onChangeText={setUnitCost}
            placeholder="Auto-filled from item"
            keyboardType="numeric"
          />
        </View>

        {/* Warehouse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warehouse</Text>
          <FormSelect
            label="Warehouse *"
            value={fromWh}
            onChange={v => setFromWh(String(v))}
            options={whOptions}
          />
        </View>

        {/* Reference & Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reference</Text>
          <FormInput label="Reference / PO Number" value={reference} onChangeText={setReference} placeholder="Optional" />
          <FormInput
            label={movType === 'adjustment' ? 'Reason *' : 'Notes'}
            value={notes}
            onChangeText={setNotes}
            placeholder={movType === 'adjustment' ? 'Required — why is stock being adjusted?' : 'Optional'}
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, (submitting || !isOnline) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Record Movement</Text>}
        </TouchableOpacity>

      </ScrollView>

      {showPicker && (
        <ItemPickerModal
          items={items}
          onSelect={item => setSelectedItem(item)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
  },

  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  pickerTriggerName:        { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  pickerTriggerMeta:        { fontSize: Typography.xs, color: Colors.textSecondary },
  pickerTriggerPlaceholder: { fontSize: Typography.sm, color: Colors.textMuted },

  btn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },

  // Picker modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.base,
  },
  pickerTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm,
  },
  pickerInput: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, paddingVertical: Spacing.xs },
  pickerList:  { flex: 1 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerName: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  pickerMeta: { fontSize: Typography.xs, color: Colors.textSecondary },
  pickerCost: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.semibold },
});
