import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }   from '../../components/AppHeader';
import { FormSelect }  from '../../components/FormSelect';
import { useStockTransfersList, useStockTransferCreate } from '../../hooks/useStockTransfers';
import { Colors, Spacing, Typography, Radius } from '../../theme';

export function StockTransferFormScreen() {
  const navigation = useNavigation();
  const { data }   = useStockTransfersList();
  const createMutation = useStockTransferCreate();

  const [itemId,         setItemId]         = useState('');
  const [fromWarehouse,  setFromWarehouse]  = useState('');
  const [toWarehouse,    setToWarehouse]    = useState('');
  const [qty,            setQty]            = useState('');
  const [reference,      setReference]      = useState('');
  const [notes,          setNotes]          = useState('');

  const items      = data?.items      ?? [];
  const warehouses = data?.warehouses ?? [];

  const itemOptions = items.map(it => ({
    label: `${it.name} (${it.category}) — stock: ${it.total_stock} ${it.uom}`,
    value: String(it.id),
  }));
  const warehouseOptions = warehouses.map(wh => ({ label: wh.name, value: String(wh.id) }));

  const selectedItem = items.find(it => String(it.id) === itemId);
  const qtyNum       = Number(qty);
  const canSubmit    = itemId && fromWarehouse && toWarehouse
    && fromWarehouse !== toWarehouse
    && qtyNum > 0
    && !createMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await createMutation.mutateAsync({
        item_id:           Number(itemId),
        from_warehouse_id: Number(fromWarehouse),
        to_warehouse_id:   Number(toWarehouse),
        requested_qty:     qtyNum,
        reference:         reference.trim() || undefined,
        notes:             notes.trim()     || undefined,
      });
      Alert.alert('Success', 'Stock transfer request created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to create transfer request. Please try again.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="New Transfer Request" onBack={() => navigation.goBack()} dark />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Item */}
          <View style={s.field}>
            <FormSelect
              label="Stock Item"
              options={itemOptions}
              value={itemId}
              placeholder="Select item…"
              onChange={v => setItemId(String(v))}
              required
            />
            {selectedItem && (
              <Text style={s.hint}>
                Available across all warehouses: {selectedItem.total_stock} {selectedItem.uom}
              </Text>
            )}
          </View>

          {/* Source warehouse */}
          <View style={s.field}>
            <FormSelect
              label="From Warehouse"
              options={warehouseOptions}
              value={fromWarehouse}
              placeholder="Source warehouse…"
              onChange={v => setFromWarehouse(String(v))}
              required
            />
          </View>

          {/* Destination warehouse */}
          <View style={s.field}>
            <FormSelect
              label="To Warehouse"
              options={warehouseOptions.filter(o => o.value !== fromWarehouse)}
              value={toWarehouse}
              placeholder="Destination warehouse…"
              onChange={v => setToWarehouse(String(v))}
              required
            />
            {fromWarehouse && toWarehouse && fromWarehouse === toWarehouse && (
              <Text style={s.error}>Source and destination cannot be the same.</Text>
            )}
          </View>

          {/* Quantity */}
          <View style={s.field}>
            <Text style={s.label}>
              Quantity {selectedItem ? `(${selectedItem.uom})` : ''} <Text style={s.req}>*</Text>
            </Text>
            <TextInput
              style={s.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Reference */}
          <View style={s.field}>
            <Text style={s.label}>Reference <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. TRF-2026-001"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.label}>Notes <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {createMutation.isPending
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitText}>Submit Transfer Request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  field: { gap: 6 },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  req:   { color: Colors.error },
  opt:   { fontWeight: '400', color: Colors.textMuted },
  hint:  { fontSize: Typography.xs, color: Colors.textMuted },
  error: { fontSize: Typography.xs, color: Colors.error },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.card,
  },
  textArea: { minHeight: 80 },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm,
  },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled: { opacity: 0.4 },
});
