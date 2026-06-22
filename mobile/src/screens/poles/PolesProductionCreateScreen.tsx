import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { format }        from 'date-fns';
import { AppHeader }     from '../../components/AppHeader';
import { FormInput }     from '../../components/FormInput';
import { DatePickerField } from '../../components/DatePickerField';
import { useSawmillCreate } from '../../hooks/useSawmill';
import { usePolesList }     from '../../hooks/usePoles';
import { useOfflineStore }  from '../../stores/offlineStore';
import { EP }               from '../../api/endpoints';
import { PolesProductionStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = PolesProductionStackScreenProps<'PolesProductionCreate'>;

export function PolesProductionCreateScreen({ navigation }: Props) {
  const [date,         setDate]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [polesUnits,   setPolesUnits]   = useState('');
  const [polesWaste,   setPolesWaste]   = useState('');
  const [productSize,  setProductSize]  = useState('');
  const [logsReceived, setLogsReceived] = useState('');
  const [remarks,      setRemarks]      = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [submitting,   setSubmitting]   = useState(false);

  const { createEntry }        = useSawmillCreate();
  const { data: polesData }    = usePolesList();
  const { isOnline, enqueue }  = useOfflineStore();

  const available = polesData?.available_qty ?? null;

  function validate() {
    const e: Record<string, string> = {};
    if (!polesUnits || Number(polesUnits) <= 0) e.polesUnits = 'Enter poles units produced';
    if (polesWaste && Number(polesWaste) < 0)   e.polesWaste = 'Waste cannot be negative';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);

    const payload = {
      date,
      poles_units:    Number(polesUnits),
      ...(polesWaste    && { poles_waste:   Number(polesWaste)   }),
      ...(productSize   && { product_size:  productSize           }),
      ...(logsReceived  && { logs_received: Number(logsReceived)  }),
      ...(remarks       && { remarks                               }),
    };

    try {
      if (!isOnline) {
        enqueue({ endpoint: EP.SAWMILL_CREATE, method: 'POST', body: payload, context: 'poles-production' });
        Alert.alert('Saved Offline', 'Production entry will sync when you reconnect.', [
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
      <AppHeader title="Log Poles Production" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {available !== null && (
          <View style={[styles.stockBanner, available === 0 && styles.stockBannerAlert]}>
            <Text style={[styles.stockValue, available === 0 && styles.stockValueAlert]}>{available}</Text>
            <Text style={styles.stockLabel}>
              {available === 0 ? 'No approved stock available' : 'poles available from approved stock'}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <DatePickerField
            label="Production Date"
            value={date}
            onChange={setDate}
            maxDate={new Date()}
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Poles Produced"
                value={polesUnits}
                onChangeText={setPolesUnits}
                keyboardType="numeric"
                required
                error={errors.polesUnits}
                hint={available !== null ? `Max: ${available}` : undefined}
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Production Waste"
                value={polesWaste}
                onChangeText={setPolesWaste}
                keyboardType="numeric"
                error={errors.polesWaste}
              />
            </View>
          </View>
          <FormInput
            label="Product Size / Specification"
            value={productSize}
            onChangeText={setProductSize}
            placeholder="e.g. 9m Class 3"
          />
          <FormInput
            label="Logs Received"
            value={logsReceived}
            onChangeText={setLogsReceived}
            keyboardType="numeric"
          />
          <FormInput
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
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
            : <Text style={styles.submitText}>{isOnline ? 'Save Production Entry' : 'Save Offline'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  stockBanner:      { alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  stockBannerAlert: { backgroundColor: Colors.errorBg },
  stockValue:       { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.success },
  stockValueAlert:  { color: Colors.error },
  stockLabel:       { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },

  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  row:     { flexDirection: 'row', gap: Spacing.sm },
  col:     { flex: 1 },

  submitBtn:         { backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
