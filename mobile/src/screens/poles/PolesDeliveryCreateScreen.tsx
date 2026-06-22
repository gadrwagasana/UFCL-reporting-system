import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { format }        from 'date-fns';
import { AppHeader }     from '../../components/AppHeader';
import { FormInput }     from '../../components/FormInput';
import { FormSelect }    from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { OfflineBanner } from '../../components/OfflineBanner';
import { usePolesDeliveryCreate, usePolesList } from '../../hooks/usePoles';
import { PolesDeliveryStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = PolesDeliveryStackScreenProps<'PolesDeliveryCreate'>;

export function PolesDeliveryCreateScreen({ navigation }: Props) {
  const [deliveryDate,  setDeliveryDate]  = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deliveredQty,  setDeliveredQty]  = useState('');
  const [supplierName,  setSupplierName]  = useState('');
  const [noteRef,       setNoteRef]       = useState('');
  const [purchaseReqId, setPurchaseReqId] = useState('');
  const [notes,         setNotes]         = useState('');
  const [errors,        setErrors]        = useState<Record<string, string>>({});
  const [submitting,    setSubmitting]    = useState(false);

  const { createDelivery }  = usePolesDeliveryCreate();
  const { data: polesData } = usePolesList();

  const requestOptions = useMemo(
    () => (polesData?.requests ?? [])
      .filter((r) => r.status === 'approved')
      .map((r) => ({ label: `${r.supplier_name} — ${r.requested_qty} poles`, value: String(r.id) })),
    [polesData],
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!deliveredQty || Number(deliveredQty) <= 0) e.deliveredQty = 'Enter quantity delivered';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await createDelivery({
        delivery_date: deliveryDate,
        delivered_qty: Number(deliveredQty),
        ...(supplierName  && { supplier_name:       supplierName.trim() }),
        ...(noteRef       && { delivery_note_ref:   noteRef.trim()     }),
        ...(purchaseReqId && { purchase_request_id: Number(purchaseReqId) }),
        ...(notes         && { notes:               notes.trim()       }),
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Record Delivery" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <DatePickerField label="Delivery Date" value={deliveryDate} onChange={setDeliveryDate} maxDate={new Date()} />
          <FormInput
            label="Quantity Delivered (poles)"
            value={deliveredQty}
            onChangeText={setDeliveredQty}
            keyboardType="numeric"
            required
            error={errors.deliveredQty}
          />
          <FormInput label="Supplier Name" value={supplierName} onChangeText={setSupplierName} />
          <FormInput label="Delivery Note Ref" value={noteRef} onChangeText={setNoteRef} />
          {requestOptions.length > 0 && (
            <FormSelect
              label="Link to Purchase Request (optional)"
              value={purchaseReqId}
              options={requestOptions}
              onChange={(v) => setPurchaseReqId(String(v))}
              placeholder="Select approved request"
            />
          )}
          <FormInput label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Save Delivery</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },

  submitBtn:         { backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
