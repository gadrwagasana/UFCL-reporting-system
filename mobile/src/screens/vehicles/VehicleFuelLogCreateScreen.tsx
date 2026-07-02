import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { FormInput }    from '../../components/FormInput';
import { useFuelLogCreate } from '../../hooks/useVehicles';
import { useOfflineStore }  from '../../stores/offlineStore';
import { VehiclesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<VehiclesStackParamList, 'VehicleFuelLogCreate'>;
type RoutePropT = RouteProp<VehiclesStackParamList, 'VehicleFuelLogCreate'>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VehicleFuelLogCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { vehicleId, registration } = route.params;

  const { createFuelLog } = useFuelLogCreate();
  const { isOnline }      = useOfflineStore();

  const [date,   setDate]   = useState(today());
  const [liters, setLiters] = useState('');
  const [cpl,    setCpl]    = useState('');
  const [odo,    setOdo]    = useState('');
  const [notes,  setNotes]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live total cost preview
  const totalPreview =
    liters && cpl ? (parseFloat(liters) * parseFloat(cpl)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Fuel logging requires an active connection.');
      return;
    }
    const l = parseFloat(liters);
    if (!liters || isNaN(l) || l <= 0) {
      Alert.alert('Required', 'Litres must be a positive number.'); return;
    }
    if (!date) {
      Alert.alert('Required', 'Date is required.'); return;
    }

    setSubmitting(true);
    try {
      await createFuelLog(vehicleId, {
        log_date:       date,
        liters:         l,
        cost_per_liter: cpl    ? parseFloat(cpl) : null,
        odometer:       odo    ? parseFloat(odo)  : null,
        notes:          notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save fuel log.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Log Fuel"
        subtitle={registration}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <FormInput
            label="Date * (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            placeholder="2025-06-30"
          />
          <FormInput
            label="Litres *"
            value={liters}
            onChangeText={setLiters}
            placeholder="0.0"
            keyboardType="decimal-pad"
            required
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Cost per litre (RWF)"
                value={cpl}
                onChangeText={setCpl}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Odometer (km)"
                value={odo}
                onChangeText={setOdo}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            multiline
            numberOfLines={2}
          />
        </View>

        {totalPreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Total Cost Preview</Text>
            <Text style={styles.previewValue}>RWF {totalPreview}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Save Fuel Log</Text>}
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
  row: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },

  previewBox: {
    backgroundColor: Colors.navyBg, borderRadius: Radius.lg,
    padding: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  previewLabel: { fontSize: Typography.xs, color: Colors.navy, textTransform: 'uppercase', letterSpacing: 0.6 },
  previewValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.navy, marginTop: 4 },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
