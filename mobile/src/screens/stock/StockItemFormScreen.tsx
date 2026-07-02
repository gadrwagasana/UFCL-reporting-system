import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { useStockItemCreate, useStockItemUpdate, useStockCategories } from '../../hooks/useStock';
import { useOfflineStore } from '../../stores/offlineStore';
import { StockCatalogStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<StockCatalogStackParamList, 'StockItemForm'>;
type RoutePropT = RouteProp<StockCatalogStackParamList, 'StockItemForm'>;

const DEFAULT_CATS = ['Timber', 'Poles', 'Fuel', 'Spare Parts', 'Tools', 'Packaging', 'Raw Materials', 'Other'];

export function StockItemFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const item       = route.params?.item;
  const isEdit     = !!item;

  const { isOnline } = useOfflineStore();
  const { createStockItem } = useStockItemCreate();
  const { updateStockItem } = useStockItemUpdate();
  const { data: catsData }  = useStockCategories();

  const customCats = catsData?.rows?.map(c => c.name) ?? [];
  const catHints   = customCats.length ? customCats : DEFAULT_CATS;

  const [category,  setCategory]  = useState(item?.category  ?? '');
  const [name,      setName]      = useState(item?.name       ?? '');
  const [sku,       setSku]       = useState(item?.sku        ?? '');
  const [uom,       setUom]       = useState(item?.uom        ?? '');
  const [unitCost,  setUnitCost]  = useState(item?.unit_cost  != null ? String(item.unit_cost)  : '0');
  const [minStock,  setMinStock]  = useState(item?.min_stock  != null ? String(item.min_stock)  : '0');
  const [maxStock,  setMaxStock]  = useState(item?.max_stock  != null ? String(item.max_stock)  : '');
  const [notes,     setNotes]     = useState(item?.notes      ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isOnline) { Alert.alert('Online Required', 'Saving requires an active connection.'); return; }
    if (!category.trim()) { Alert.alert('Required', 'Category is required.'); return; }
    if (!name.trim())     { Alert.alert('Required', 'Name is required.');     return; }
    if (!uom.trim())      { Alert.alert('Required', 'Unit of measure is required.'); return; }

    const payload = {
      category:  category.trim(),
      name:      name.trim(),
      sku:       sku.trim() || null,
      uom:       uom.trim(),
      unit_cost: parseFloat(unitCost)  || 0,
      min_stock: parseInt(minStock, 10) || 0,
      max_stock: maxStock ? parseInt(maxStock, 10) : null,
      notes:     notes.trim() || null,
      ...(isEdit ? { active: true } : {}),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        const result = await updateStockItem({ id: item!.id, payload }) as any;
        if (result?.pendingApproval) {
          Alert.alert('Submitted for Review', result.message ?? 'Edit sent for approval.');
        }
      } else {
        await createStockItem(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save item.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Stock Item' : 'Add Stock Item'}
        subtitle={isEdit ? item!.name : undefined}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <FormInput
            label="Category *"
            value={category}
            onChangeText={setCategory}
            placeholder={`e.g. ${catHints[0]}`}
            required
          />
          <Text style={styles.hint}>Available: {catHints.slice(0, 5).join(', ')}{catHints.length > 5 ? '…' : ''}</Text>
          <FormInput label="Name *"  value={name} onChangeText={setName}  placeholder="Item name" required />
          <FormInput label="SKU"     value={sku}  onChangeText={setSku}   placeholder="Stock keeping unit (optional)" />
          <FormInput label="Unit of Measure *" value={uom} onChangeText={setUom} placeholder="e.g. pcs, kg, litres" required />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock Settings</Text>
          <FormInput label="Unit Cost (RWF)" value={unitCost} onChangeText={setUnitCost} placeholder="0" keyboardType="numeric" />
          <FormInput label="Min Stock"       value={minStock} onChangeText={setMinStock} placeholder="0" keyboardType="numeric" />
          <FormInput label="Max Stock"       value={maxStock} onChangeText={setMaxStock} placeholder="No limit" keyboardType="numeric" />
          <FormInput label="Notes"           value={notes}   onChangeText={setNotes}    placeholder="Optional notes" />
        </View>

        <TouchableOpacity
          style={[styles.btn, (submitting || !isOnline) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>{isEdit ? 'Save Changes' : 'Add Item'}</Text>}
        </TouchableOpacity>

      </ScrollView>
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
  hint: { fontSize: 10, color: Colors.textMuted, marginTop: -Spacing.xs },
  btn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
