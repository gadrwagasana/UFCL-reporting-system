import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { format }       from 'date-fns';
import { AppHeader }    from '../../components/AppHeader';
import { FormInput }    from '../../components/FormInput';
import { FormSelect }   from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { useVatCreate, VAT_TYPES } from '../../hooks/useVat';
import { useOfflineStore }  from '../../stores/offlineStore';
import { EP }               from '../../api/endpoints';
import { VatInboundStackScreenProps } from '../../navigation/types';
import { VatTypeValueAdded } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = VatInboundStackScreenProps<'VatIntakeCreate'>;

export function VatIntakeScreen({ navigation, route }: Props) {
  const { transferId, productSize, available } = route.params;

  const [entryDate,      setEntryDate]      = useState(format(new Date(), 'yyyy-MM-dd'));
  const [typeValueAdded, setTypeValueAdded] = useState<VatTypeValueAdded | ''>('');
  const [numTimber,      setNumTimber]      = useState('');
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [submitting,     setSubmitting]     = useState(false);

  const { createEntry }       = useVatCreate();
  const { isOnline, enqueue } = useOfflineStore();

  const typeOptions = VAT_TYPES.map((t) => ({ label: t, value: t }));

  function validate() {
    const e: Record<string, string> = {};
    if (!typeValueAdded)                      e.type      = 'Select treatment type';
    if (!numTimber || Number(numTimber) <= 0) e.numTimber = 'Enter number of timber pieces';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);

    const payload = {
      entry_date:         entryDate,
      type_value_added:   typeValueAdded as VatTypeValueAdded,
      product_size:       productSize,
      num_timber:         Number(numTimber),
      source_transfer_id: transferId,
    };

    try {
      if (!isOnline) {
        enqueue({ endpoint: EP.VAT_CREATE, method: 'POST', body: payload, context: 'vat-intake' });
        Alert.alert('Saved Offline', 'VAT intake entry will sync when you reconnect.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      await createEntry(payload);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save entry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Record VAT Intake" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.transferCard}>
          <Text style={styles.transferLabel}>Product Size (from transfer)</Text>
          <Text style={styles.transferSize}>{productSize}</Text>
          <Text style={styles.transferAvailable}>{available} pieces available from this transfer</Text>
        </View>

        <View style={styles.section}>
          <DatePickerField label="Entry Date" value={entryDate} onChange={setEntryDate} maxDate={new Date()} />

          <FormSelect
            label="Treatment Type"
            value={typeValueAdded}
            options={typeOptions}
            onChange={(v) => setTypeValueAdded(v as VatTypeValueAdded)}
            required
            error={errors.type}
          />

          <FormInput
            label="Number of Timber Pieces"
            value={numTimber}
            onChangeText={setNumTimber}
            keyboardType="numeric"
            required
            error={errors.numTimber}
            hint={`Available: ${available} pieces from this transfer`}
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
            : <Text style={styles.submitText}>{isOnline ? 'Save Intake Entry' : 'Save Offline'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  transferCard: {
    backgroundColor: Colors.navyBg, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  transferLabel:     { fontSize: Typography.xs, color: Colors.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  transferSize:      { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.navy },
  transferAvailable: { fontSize: Typography.sm, color: Colors.navy, opacity: 0.8 },

  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },

  submitBtn:         { backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
