import React, { useState } from 'react';
import {
  StyleSheet, View, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { AppHeader }     from '../../components/AppHeader';
import { FormInput }     from '../../components/FormInput';
import { OfflineBanner } from '../../components/OfflineBanner';
import { usePolesPurchaseCreate } from '../../hooks/usePoles';
import { PolesPurchaseStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = PolesPurchaseStackScreenProps<'PolesPurchaseCreate'>;

export function PolesPurchaseCreateScreen({ navigation }: Props) {
  const [supplierName, setSupplierName] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [unitPrice,    setUnitPrice]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [submitting,   setSubmitting]   = useState(false);

  const { createRequest } = usePolesPurchaseCreate();

  function validate() {
    const e: Record<string, string> = {};
    if (!supplierName.trim())                       e.supplierName = 'Supplier name is required';
    if (!requestedQty || Number(requestedQty) <= 0) e.requestedQty = 'Enter quantity to request';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await createRequest({
        supplier_name: supplierName.trim(),
        requested_qty: Number(requestedQty),
        ...(unitPrice && { unit_price: Number(unitPrice) }),
        ...(notes     && { notes: notes.trim()           }),
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
      <AppHeader title="New Purchase Request" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <FormInput
            label="Supplier Name"
            value={supplierName}
            onChangeText={setSupplierName}
            required
            error={errors.supplierName}
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Quantity (poles)"
                value={requestedQty}
                onChangeText={setRequestedQty}
                keyboardType="numeric"
                required
                error={errors.requestedQty}
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Unit Price (optional)"
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="numeric"
              />
            </View>
          </View>
          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Submit Request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  row:     { flexDirection: 'row', gap: Spacing.sm },
  col:     { flex: 1 },

  submitBtn:         { backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
