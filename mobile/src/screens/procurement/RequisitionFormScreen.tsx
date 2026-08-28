import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormSelect } from '../../components/FormSelect';
import { useProcurementRequisitionActions, useWorkshops, RequisitionItemInput } from '../../hooks/useProcurementRequisitions';
import { useStockItems } from '../../hooks/useMaterialRequests';
import { useAuth } from '../../hooks/useAuth';
import { ProcurementStackParamList } from '../../navigation/types';
import { ProcurementPriority } from '../../types/api';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'RequisitionForm'>;
type RouteType = RouteProp<ProcurementStackParamList, 'RequisitionForm'>;

const PRIORITIES: ProcurementPriority[] = ['low', 'medium', 'high', 'urgent'];

function Field({ label, value, onChangeText, ...rest }: { label: string; value: string; onChangeText: (v: string) => void; [k: string]: any }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholderTextColor={Colors.textMuted} {...rest} />
    </View>
  );
}

interface DraftItem { description: string; quantity: string; unit: string; estimated_unit_price: string; stock_item_id: number | null }

export function RequisitionFormScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const existing = params?.requisition;
  const { create, update } = useProcurementRequisitionActions();
  const { workshopId: authWorkshopId } = useAuth();
  const { data: stockItemsRes } = useStockItems();
  const { data: workshopsRes } = useWorkshops();
  const stockItems = stockItemsRes?.rows ?? [];
  const workshops = workshopsRes?.rows ?? [];
  // A user already assigned to a workshop is workshop-restricted server-side
  // (procurementRequisitionCreate always uses their own workshop_id and
  // ignores anything submitted) — showing the picker to them would be
  // misleading, so it's only shown to users with no fixed workshop. Mirrors
  // desktop's renderProcurementRequisitions "New requisition" overlay.
  const showWorkshopPicker = !authWorkshopId && workshops.length > 0;
  const stockItemOptions = [
    { label: '— Not linked (free text only) —', value: 0 },
    ...stockItems.map((si) => ({ label: `${si.category ? si.category + ' — ' : ''}${si.name}${si.uom ? ` (${si.uom})` : ''}`, value: si.id })),
  ];

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [department, setDepartment] = useState(existing?.department ?? '');
  const [budgetCode, setBudgetCode] = useState(existing?.budget_code ?? '');
  const [priority, setPriority] = useState<ProcurementPriority>(existing?.priority ?? 'medium');
  const [workshopId, setWorkshopId] = useState<number | null>(null);
  // Procurement Exception Management Phase 2 — pre-fill from the requisition's
  // current items when editing (previously this always started blank, even
  // in edit mode, since editing was never reachable from any screen before
  // this phase wired up an Edit button).
  const [items, setItems] = useState<DraftItem[]>(
    params?.items?.length
      ? params.items.map((it) => ({
          description: it.description, quantity: String(it.quantity), unit: it.unit ?? '',
          estimated_unit_price: String(it.estimated_unit_price ?? 0), stock_item_id: it.stock_item_id ?? null,
        }))
      : [{ description: '', quantity: '1', unit: '', estimated_unit_price: '0', stock_item_id: null }]
  );
  const [saving, setSaving] = useState(false);

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: '1', unit: '', estimated_unit_price: '0', stock_item_id: null }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const estimatedTotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.estimated_unit_price) || 0), 0);

  async function onSave() {
    if (!title.trim()) return Alert.alert('Title is required');
    const validItems = items.filter((it) => it.description.trim());
    if (!validItems.length) return Alert.alert('Add at least one line item');

    setSaving(true);
    try {
      const itemPayload: RequisitionItemInput[] = validItems.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 1,
        unit: it.unit.trim() || undefined,
        estimated_unit_price: Number(it.estimated_unit_price) || 0,
        stock_item_id: it.stock_item_id ?? undefined,
      }));
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        department: department.trim() || undefined,
        budget_code: budgetCode.trim() || undefined,
        priority,
        workshop_id: showWorkshopPicker && workshopId ? workshopId : undefined,
        items: itemPayload,
      };
      if (existing) {
        await update(existing.id, payload);
        showToast('Requisition updated.');
        navigation.goBack();
      } else {
        const res = await create(payload);
        if (!res.ok) { Alert.alert('Could not create requisition', res.error ?? 'Please try again.'); return; }
        showToast('Requisition created.');
        // Navigation-consistency fix (Phase 2A): open the new requisition's
        // detail view directly instead of returning to the list.
        if (res.id) navigation.replace('RequisitionDetail', { requisitionId: res.id });
        else navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('Could not save requisition', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={existing ? 'Edit Requisition' : 'New Requisition'} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {existing?.status === 'returned_for_revision' ? (
          <View style={styles.revisionNotice}>
            <Text style={styles.revisionNoticeText}>This requisition was returned for revision. Correct the items below, then save and resubmit from the detail screen.</Text>
          </View>
        ) : null}
        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="e.g. Workshop hand tools" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Purpose / justification" />
        <Field label="Department" value={department} onChangeText={setDepartment} />
        <Field label="Budget Code" value={budgetCode} onChangeText={setBudgetCode} />

        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity key={p} style={[styles.priorityChip, priority === p && styles.priorityChipActive]} onPress={() => setPriority(p)}>
                <Text style={[styles.priorityChipText, priority === p && styles.priorityChipTextActive]}>{p.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {showWorkshopPicker ? (
          <FormSelect
            label="Workshop"
            options={[{ label: '— None / not workshop-specific —', value: 0 }, ...workshops.map((w) => ({ label: w.name, value: w.id }))]}
            value={workshopId ?? 0}
            onChange={(v) => setWorkshopId(Number(v) || null)}
          />
        ) : null}

        <Text style={styles.sectionTitle}>Line Items</Text>
        {items.map((it, i) => (
          <View key={i} style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemIndex}>Item {i + 1}</Text>
              {items.length > 1 ? (
                <TouchableOpacity onPress={() => removeItem(i)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Description"
              placeholderTextColor={Colors.textMuted}
              value={it.description}
              onChangeText={(v) => updateItem(i, { description: v })}
            />
            <View style={styles.itemFieldsRow}>
              <TextInput style={[styles.input, styles.itemSmallInput]} placeholder="Qty" keyboardType="numeric" placeholderTextColor={Colors.textMuted} value={it.quantity} onChangeText={(v) => updateItem(i, { quantity: v })} />
              <TextInput style={[styles.input, styles.itemSmallInput]} placeholder="Unit" placeholderTextColor={Colors.textMuted} value={it.unit} onChangeText={(v) => updateItem(i, { unit: v })} />
              <TextInput style={[styles.input, styles.itemSmallInput]} placeholder="Unit Price" keyboardType="numeric" placeholderTextColor={Colors.textMuted} value={it.estimated_unit_price} onChangeText={(v) => updateItem(i, { estimated_unit_price: v })} />
            </View>
            {stockItemOptions.length > 0 ? (
              <FormSelect
                label="Link to stock item (optional — enables automatic inventory update on receipt)"
                options={stockItemOptions}
                value={it.stock_item_id ?? 0}
                onChange={(v) => updateItem(i, { stock_item_id: Number(v) || null })}
              />
            ) : null}
          </View>
        ))}
        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Ionicons name="add" size={16} color={Colors.navy} />
          <Text style={styles.addItemBtnText}>Add Line Item</Text>
        </TouchableOpacity>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalValue}>{estimatedTotal.toLocaleString()}</Text>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Requisition'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  revisionNotice: { backgroundColor: Colors.warning + '20', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.base },
  revisionNoticeText: { fontSize: Typography.xs, color: Colors.warning },
  field: { marginBottom: Spacing.sm },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card, marginBottom: Spacing.xs },
  priorityRow: { flexDirection: 'row', gap: Spacing.xs },
  priorityChip: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.xs, alignItems: 'center' },
  priorityChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  priorityChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted },
  priorityChipTextActive: { color: Colors.white },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.base, marginBottom: Spacing.sm },
  itemCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  itemIndex: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted },
  itemFieldsRow: { flexDirection: 'row', gap: Spacing.xs },
  itemSmallInput: { flex: 1, marginBottom: 0 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.navy, borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: Spacing.sm, marginBottom: Spacing.base },
  addItemBtnText: { color: Colors.navy, fontWeight: Typography.semibold, fontSize: Typography.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider, marginBottom: Spacing.sm },
  totalLabel: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  totalValue: { fontSize: Typography.lg, color: Colors.textPrimary, fontWeight: Typography.bold },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
