import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormInput }     from '../../components/FormInput';
import { FormSelect }    from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { useMachineFuelCreate, useMachineFuelTargets } from '../../hooks/useMachineFuel';
import { MachineFuelStackScreenProps } from '../../navigation/types';
import { useOfflineStore } from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

const FUEL_TYPES = ['Diesel', 'Petroleum/Essence', 'Petrol', 'Chain Oil', 'Engine Oil'];

type Props = MachineFuelStackScreenProps<'MachineFuelCreate'>;

export function MachineFuelCreateScreen({ navigation }: Props) {
  const { createLog }      = useMachineFuelCreate();
  const { data: targetsData } = useMachineFuelTargets();
  const isOnline           = useOfflineStore((s) => s.isOnline);
  const targets            = targetsData?.rows ?? [];

  const [targetId, setTargetId]       = useState('');
  const [targetSource, setTargetSource] = useState<'machine' | 'vehicle' | null>(null);
  const [logDate, setLogDate]         = useState<string>(new Date().toISOString().split('T')[0]);
  const [fuelType, setFuelType]       = useState('Diesel');
  const [quantity, setQuantity]       = useState('');
  const [operator, setOperator]       = useState('');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  const targetOptions = targets.map((t) => ({
    label: `${t.label}${t.plate_number ? ` (${t.plate_number})` : ''} — ${t.source}`,
    value: String(t.id) + ':' + t.source,
  }));

  const fuelTypeOptions = FUEL_TYPES.map((f) => ({ label: f, value: f }));

  function handleTargetChange(v: string | number) {
    const raw = String(v);
    const [id, source] = raw.split(':');
    setTargetId(id);
    setTargetSource(source as 'machine' | 'vehicle');
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!targetId)  e.targetId  = 'Select a machine or vehicle';
    if (!fuelType)  e.fuelType  = 'Fuel type is required';
    if (!quantity)  e.quantity  = 'Quantity is required';
    else if (parseFloat(quantity) <= 0) e.quantity = 'Must be greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Offline', 'Fuel logs require an internet connection.');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createLog({
        log_date:   logDate,
        fuel_type:  fuelType,
        quantity:   parseFloat(quantity),
        machine_id: targetSource === 'machine' ? Number(targetId) : undefined,
        vehicle_id: targetSource === 'vehicle' ? Number(targetId) : undefined,
        operator:   operator.trim() || undefined,
        notes:      notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save fuel log.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Log Machine Fuel" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!isOnline && (
          <View style={styles.warnBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
            <Text style={styles.warnText}>You are offline. Connect to save.</Text>
          </View>
        )}

        <FormSelect
          label="Machine / Vehicle"
          value={targetId ? targetId + ':' + targetSource : ''}
          options={targetOptions}
          placeholder="Select machine or vehicle"
          onChange={handleTargetChange}
          error={errors.targetId}
          required
        />

        <DatePickerField
          label="Date"
          value={logDate}
          onChange={setLogDate}
          maxDate={new Date()}
          required
        />

        <FormSelect
          label="Fuel Type"
          value={fuelType}
          options={fuelTypeOptions}
          onChange={(v) => setFuelType(String(v))}
          error={errors.fuelType}
          required
        />

        <FormInput
          label="Quantity (litres)"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="e.g. 30"
          error={errors.quantity}
          required
        />

        <FormInput
          label="Operator"
          value={operator}
          onChangeText={setOperator}
          placeholder="Optional"
        />

        <FormInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
        />

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Save Fuel Log</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warning + '1A', borderRadius: Radius.md, padding: Spacing.sm },
  warnText:   { fontSize: Typography.xs, color: Colors.warning },

  submitBtn:      { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  submitDisabled: { opacity: 0.4 },
  submitText:     { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
