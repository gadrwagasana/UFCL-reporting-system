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
import { useVehicleFuelCreate } from '../../hooks/useVehicleFuel';
import { useDeliveryList }      from '../../hooks/useDeliveries';
import { VehicleFuelStackScreenProps } from '../../navigation/types';
import { useOfflineStore } from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type Props = VehicleFuelStackScreenProps<'VehicleFuelCreate'>;

export function VehicleFuelCreateScreen({ navigation }: Props) {
  const { createLog }  = useVehicleFuelCreate();
  const isOnline       = useOfflineStore((s) => s.isOnline);
  const { data: deliveryData } = useDeliveryList();
  const vehicles = deliveryData?.vehicles ?? [];

  const [vehicleId, setVehicleId]         = useState('');
  const [logDate, setLogDate]             = useState<string>(new Date().toISOString().split('T')[0]);
  const [liters, setLiters]               = useState('');
  const [costPerLiter, setCostPerLiter]   = useState('');
  const [odometer, setOdometer]           = useState('');
  const [notes, setNotes]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});

  const vehicleOptions = vehicles.map((v) => ({
    label: `${v.registration}${v.driver_assigned ? ` — ${v.driver_assigned}` : ''}`,
    value: String(v.id),
  }));

  const litersNum      = parseFloat(liters) || 0;
  const costPerLiterNum = parseFloat(costPerLiter) || 0;
  const totalCost      = litersNum > 0 && costPerLiterNum > 0 ? litersNum * costPerLiterNum : null;

  function validate() {
    const e: Record<string, string> = {};
    if (!vehicleId) e.vehicleId = 'Vehicle is required';
    if (!liters)    e.liters    = 'Litres is required';
    else if (parseFloat(liters) <= 0) e.liters = 'Must be greater than 0';
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
        vehicle_id:     Number(vehicleId),
        log_date:       logDate,
        liters:         parseFloat(liters),
        cost_per_liter: costPerLiterNum > 0 ? costPerLiterNum : undefined,
        total_cost:     totalCost ?? undefined,
        odometer:       odometer ? parseInt(odometer, 10) : undefined,
        notes:          notes.trim() || undefined,
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
      <AppHeader title="Log Fuel" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!isOnline && (
          <View style={styles.warnBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
            <Text style={styles.warnText}>You are offline. Connect to save.</Text>
          </View>
        )}

        <FormSelect
          label="Vehicle"
          value={vehicleId}
          options={vehicleOptions}
          placeholder="Select vehicle"
          onChange={(v) => setVehicleId(String(v))}
          error={errors.vehicleId}
          required
        />

        <DatePickerField
          label="Date"
          value={logDate}
          onChange={setLogDate}
          maxDate={new Date()}
          required
        />

        <FormInput
          label="Litres"
          value={liters}
          onChangeText={setLiters}
          keyboardType="decimal-pad"
          placeholder="e.g. 45.5"
          error={errors.liters}
          required
        />

        <FormInput
          label="Cost per Litre (RWF)"
          value={costPerLiter}
          onChangeText={setCostPerLiter}
          keyboardType="decimal-pad"
          placeholder="Optional"
        />

        {totalCost !== null && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Cost</Text>
            <Text style={styles.totalValue}>RWF {totalCost.toLocaleString()}</Text>
          </View>
        )}

        <FormInput
          label="Odometer (km)"
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
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

  totalCard:  { backgroundColor: Colors.navy + '1A', borderRadius: Radius.md, padding: Spacing.base, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  totalValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.navy },

  submitBtn:      { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  submitDisabled: { opacity: 0.4 },
  submitText:     { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
