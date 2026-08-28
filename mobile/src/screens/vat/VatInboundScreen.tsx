import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { format }       from 'date-fns';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormInput }    from '../../components/FormInput';
import { FormSelect }   from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { LoadingState } from '../../components/LoadingState';
import { useVatAvailableInputs, useVatCreate, VapInputLinePayload, VapOutputLinePayload } from '../../hooks/useVat';
import { useProductList } from '../../hooks/useProducts';
import { useCustomerDropdown } from '../../hooks/useCustomers';
import { useOfflineStore }  from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Nyanza Value-Added Production Completion Phase — replaces the old
// "pick a received transfer, then create an intake entry for it" 2-step flow
// (VatInboundScreen -> VatIntakeScreen). Input material is now consumed from
// real stock at the workshop (verified against stock_levels server-side), and
// output can be any active Product Catalog item, not just the same timber
// re-treated — so this screen goes straight to a general batch-creation form.

interface InputLine { key: string; stockItemId: number | ''; quantity: string }
interface OutputLine { key: string; productId: number | ''; quantity: string }
let _lineKey = 0;
const newKey = () => String(_lineKey++);

export function VatInboundScreen() {
  const { data: inputsData, isLoading: inputsLoading } = useVatAvailableInputs();
  const { data: productsData, isLoading: productsLoading } = useProductList('Active');
  const { data: customersData } = useCustomerDropdown();
  const { createBatch } = useVatCreate();
  const { isOnline } = useOfflineStore();

  const availableInputs = inputsData?.rows ?? [];
  const activeProducts  = productsData?.rows ?? [];
  const customers        = customersData?.rows ?? [];

  const [batchDate, setBatchDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [productionType, setProductionType] = useState('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [orderRef, setOrderRef] = useState('');
  const [operator, setOperator] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [notes, setNotes] = useState('');
  const [inputLines, setInputLines]   = useState<InputLine[]>([{ key: newKey(), stockItemId: '', quantity: '' }]);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([{ key: newKey(), productId: '', quantity: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const inputOptions  = availableInputs.map(i => ({ label: `${i.name} — ${i.available} ${i.uom || ''} available`, value: i.stock_item_id }));
  const productOptions = activeProducts.map(p => ({ label: `${p.type}${p.sub_type ? ' ' + p.sub_type : ''} ${p.size}`, value: p.id }));
  const customerOptions = [{ label: '— None —', value: 0 }, ...customers.map(c => ({ label: c.name, value: c.id }))];

  function addInputLine()  { setInputLines(l => [...l, { key: newKey(), stockItemId: '', quantity: '' }]); }
  function removeInputLine(key: string) { setInputLines(l => l.length > 1 ? l.filter(x => x.key !== key) : l); }
  function addOutputLine() { setOutputLines(l => [...l, { key: newKey(), productId: '', quantity: '' }]); }
  function removeOutputLine(key: string) { setOutputLines(l => l.length > 1 ? l.filter(x => x.key !== key) : l); }

  async function handleSubmit() {
    setError('');
    const inputs: VapInputLinePayload[] = inputLines
      .filter(l => l.stockItemId && l.quantity)
      .map(l => ({ stock_item_id: Number(l.stockItemId), quantity: Number(l.quantity) }));
    const outputs: VapOutputLinePayload[] = outputLines
      .filter(l => l.productId && l.quantity)
      .map(l => ({ output_product_id: Number(l.productId), quantity: Number(l.quantity) }));
    if (!inputs.length) { setError('Add at least one input line.'); return; }
    if (!outputs.length) { setError('Add at least one output line.'); return; }
    if (!isOnline) { setError('Production batches need real-time stock validation — please connect and try again.'); return; }

    setSubmitting(true);
    try {
      await createBatch({
        batch_date: batchDate,
        production_type: productionType.trim() || undefined,
        customer_id: customerId ? Number(customerId) : undefined,
        order_reference: orderRef.trim() || undefined,
        operator: operator.trim() || undefined,
        supervisor: supervisor.trim() || undefined,
        notes: notes.trim() || undefined,
        inputs, outputs,
      });
      Alert.alert('Batch Saved', 'Production batch recorded — output line(s) are pending Quality Inspection.');
      setInputLines([{ key: newKey(), stockItemId: '', quantity: '' }]);
      setOutputLines([{ key: newKey(), productId: '', quantity: '' }]);
      setProductionType(''); setCustomerId(''); setOrderRef(''); setOperator(''); setSupervisor(''); setNotes('');
    } catch (err: any) {
      setError(err?.message ?? 'Could not save batch.');
    } finally {
      setSubmitting(false);
    }
  }

  if (inputsLoading || productsLoading) return <LoadingState message="Loading production form…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="New Production Batch" dark />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <DatePickerField label="Batch Date" value={batchDate} onChange={setBatchDate} maxDate={new Date()} />
          <FormInput label="Production Type" value={productionType} onChangeText={setProductionType} placeholder="e.g. Kiln-drying, Pallet manufacturing" />
          <FormSelect label="Customer (optional)" value={customerId || null} options={customerOptions} onChange={(v) => setCustomerId(Number(v) || '')} />
          <FormInput label="Order Reference" value={orderRef} onChangeText={setOrderRef} placeholder="e.g. Customer PO #" />
          <FormInput label="Operator" value={operator} onChangeText={setOperator} />
          <FormInput label="Supervisor" value={supervisor} onChangeText={setSupervisor} />
          <FormInput label="Notes" value={notes} onChangeText={setNotes} multiline />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Input material (consumed from stock)</Text>
          {inputLines.map((line, idx) => (
            <View key={line.key} style={styles.lineRow}>
              <View style={{ flex: 2 }}>
                <FormSelect
                  label={idx === 0 ? 'Item' : ''}
                  value={line.stockItemId || null}
                  options={inputOptions}
                  onChange={(v) => setInputLines(l => l.map(x => x.key === line.key ? { ...x, stockItemId: Number(v) } : x))}
                  placeholder="Select item"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label={idx === 0 ? 'Qty' : ''}
                  value={line.quantity}
                  onChangeText={(v) => setInputLines(l => l.map(x => x.key === line.key ? { ...x, quantity: v } : x))}
                  keyboardType="numeric"
                />
              </View>
              {inputLines.length > 1 && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeInputLine(line.key)}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={addInputLine}>
            <Ionicons name="add" size={16} color={Colors.navy} />
            <Text style={styles.addBtnText}>Add input</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Output product(s)</Text>
          {outputLines.map((line, idx) => (
            <View key={line.key} style={styles.lineRow}>
              <View style={{ flex: 2 }}>
                <FormSelect
                  label={idx === 0 ? 'Product' : ''}
                  value={line.productId || null}
                  options={productOptions}
                  onChange={(v) => setOutputLines(l => l.map(x => x.key === line.key ? { ...x, productId: Number(v) } : x))}
                  placeholder="Select product"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label={idx === 0 ? 'Qty' : ''}
                  value={line.quantity}
                  onChangeText={(v) => setOutputLines(l => l.map(x => x.key === line.key ? { ...x, quantity: v } : x))}
                  keyboardType="numeric"
                />
              </View>
              {outputLines.length > 1 && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeOutputLine(line.key)}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={addOutputLine}>
            <Ionicons name="add" size={16} color={Colors.navy} />
            <Text style={styles.addBtnText}>Add output</Text>
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Save Production Batch</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },

  lineRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  removeBtn: { paddingBottom: Spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  addBtnText: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.medium },

  errorText: { color: Colors.error, fontSize: Typography.sm, textAlign: 'center' },

  submitBtn:         { backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
