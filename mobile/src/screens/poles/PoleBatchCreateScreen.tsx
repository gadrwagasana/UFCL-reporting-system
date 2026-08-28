import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { format }       from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormInput }    from '../../components/FormInput';
import { FormSelect }   from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { LoadingState } from '../../components/LoadingState';
import { usePoleProductionBatchCreate } from '../../hooks/usePoles';
import { usePolesList } from '../../hooks/usePoles';
import { useProductList } from '../../hooks/useProducts';
import { useOfflineStore }  from '../../stores/offlineStore';
import { PolesProductionStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Pole Production Phase 1 — consumes raw logs from the pooled balance
// usePolesList already computes (same balance the legacy poles_units entry
// screen validates against), produces one or more real Product Catalog
// "Poles" output lines. Mirrors VatInboundScreen's own output-line builder
// (poles only ever has ONE input — a raw log count — so no input-line list
// here, unlike VAT's stock-item input lines).

type NavProp = NativeStackNavigationProp<PolesProductionStackParamList, 'PoleBatchCreate'>;

interface OutputLine { key: string; productId: number | ''; quantity: string }
let _lineKey = 0;
const newKey = () => String(_lineKey++);

export function PoleBatchCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { data: polesData }               = usePolesList();
  const { data: productsData, isLoading } = useProductList('Active');
  const { createBatch }                   = usePoleProductionBatchCreate();
  const { isOnline }                      = useOfflineStore();

  const activePoleProducts = (productsData?.rows ?? []).filter((p) => p.type === 'Poles');
  const productOptions = activePoleProducts.map((p) => ({
    label: `${p.type} ${p.size}`, value: p.id,
  }));
  const availableQty = polesData?.available_qty ?? null;

  const [batchDate, setBatchDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [inputQty, setInputQty]     = useState('');
  const [operator, setOperator]     = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [downtimeMinutes, setDowntimeMinutes] = useState('');
  const [downtimeReason, setDowntimeReason]   = useState('');
  const [notes, setNotes]           = useState('');
  const [outputLines, setOutputLines] = useState<OutputLine[]>([{ key: newKey(), productId: '', quantity: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  function addOutputLine() { setOutputLines((l) => [...l, { key: newKey(), productId: '', quantity: '' }]); }
  function removeOutputLine(key: string) { setOutputLines((l) => (l.length > 1 ? l.filter((x) => x.key !== key) : l)); }

  async function handleSubmit() {
    setError('');
    const qty = Number(inputQty);
    if (!qty || qty <= 0) { setError('Enter the raw log quantity consumed.'); return; }
    const outputs = outputLines
      .filter((l) => l.productId && l.quantity)
      .map((l) => ({ output_product_id: Number(l.productId), quantity: Number(l.quantity) }));
    if (!outputs.length) { setError('Add at least one output line.'); return; }
    if (!isOnline) { setError('Production batches need real-time stock validation — please connect and try again.'); return; }

    setSubmitting(true);
    try {
      await createBatch({
        batch_date: batchDate,
        input_raw_log_qty: qty,
        operator: operator.trim() || undefined,
        supervisor: supervisor.trim() || undefined,
        downtime_minutes: downtimeMinutes ? Number(downtimeMinutes) : undefined,
        downtime_reason: downtimeReason.trim() || undefined,
        notes: notes.trim() || undefined,
        outputs,
      });
      Alert.alert('Batch Saved', 'Production batch recorded — output line(s) are pending Quality Inspection.');
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save batch.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading production form…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="New Production Batch" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <DatePickerField label="Batch Date" value={batchDate} onChange={setBatchDate} maxDate={new Date()} />
          <FormInput
            label="Raw Logs Consumed"
            value={inputQty}
            onChangeText={setInputQty}
            keyboardType="numeric"
            required
            hint={availableQty != null ? `${availableQty} available` : undefined}
          />
          <FormInput label="Operator" value={operator} onChangeText={setOperator} />
          <FormInput label="Supervisor" value={supervisor} onChangeText={setSupervisor} />
          <FormInput label="Downtime (minutes)" value={downtimeMinutes} onChangeText={setDowntimeMinutes} keyboardType="numeric" />
          {Number(downtimeMinutes) > 0 && (
            <FormInput label="Downtime Reason" value={downtimeReason} onChangeText={setDowntimeReason} />
          )}
          <FormInput label="Notes" value={notes} onChangeText={setNotes} multiline />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Output product(s) — from Product Catalog</Text>
          {outputLines.map((line, idx) => (
            <View key={line.key} style={styles.lineRow}>
              <View style={{ flex: 2 }}>
                <FormSelect
                  label={idx === 0 ? 'Product' : ''}
                  value={line.productId || null}
                  options={productOptions}
                  onChange={(v) => setOutputLines((l) => l.map((x) => (x.key === line.key ? { ...x, productId: Number(v) } : x)))}
                  placeholder="Select pole spec"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label={idx === 0 ? 'Qty' : ''}
                  value={line.quantity}
                  onChangeText={(v) => setOutputLines((l) => l.map((x) => (x.key === line.key ? { ...x, quantity: v } : x)))}
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
