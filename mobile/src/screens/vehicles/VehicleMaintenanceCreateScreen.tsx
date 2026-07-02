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
import { FormSelect }   from '../../components/FormSelect';
import { useMaintenanceCreate } from '../../hooks/useVehicles';
import { useOfflineStore }      from '../../stores/offlineStore';
import { MaintenanceType }      from '../../types/api';
import { VehiclesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<VehiclesStackParamList, 'VehicleMaintenanceCreate'>;
type RoutePropT = RouteProp<VehiclesStackParamList, 'VehicleMaintenanceCreate'>;

const TYPE_OPTIONS: { label: string; value: MaintenanceType }[] = [
  { label: 'Scheduled',  value: 'Scheduled' },
  { label: 'Corrective', value: 'Corrective' },
  { label: 'Inspection', value: 'Inspection' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VehicleMaintenanceCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { vehicleId, registration } = route.params;

  const { createMaintenance } = useMaintenanceCreate();
  const { isOnline }          = useOfflineStore();

  const [date,      setDate]      = useState(today());
  const [mtype,     setMtype]     = useState<MaintenanceType>('Scheduled');
  const [desc,      setDesc]      = useState('');
  const [cost,      setCost]      = useState('');
  const [nextDue,   setNextDue]   = useState('');
  const [perfBy,    setPerfBy]    = useState('');
  const [notes,     setNotes]     = useState('');
  const [submitting,setSubmitting]= useState(false);

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Maintenance records require an active connection.');
      return;
    }
    if (!desc.trim()) {
      Alert.alert('Required', 'Description is required.'); return;
    }
    if (!date) {
      Alert.alert('Required', 'Date is required.'); return;
    }

    setSubmitting(true);
    try {
      await createMaintenance(vehicleId, {
        maintenance_date: date,
        maintenance_type: mtype,
        description:      desc.trim(),
        cost:             cost    ? parseFloat(cost)   : null,
        next_due_date:    nextDue || null,
        performed_by:     perfBy.trim() || undefined,
        notes:            notes.trim()  || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save maintenance record.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Add Maintenance"
        subtitle={registration}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Date * (YYYY-MM-DD)"
                value={date}
                onChangeText={setDate}
                placeholder="2025-06-30"
              />
            </View>
            <View style={styles.col}>
              <FormSelect
                label="Type *"
                value={mtype}
                onChange={(v) => setMtype(v as MaintenanceType)}
                options={TYPE_OPTIONS}
                required
              />
            </View>
          </View>

          <FormInput
            label="Description *"
            value={desc}
            onChangeText={setDesc}
            placeholder="What was done?"
            required
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Cost (RWF)"
                value={cost}
                onChangeText={setCost}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Next Due (YYYY-MM-DD)"
                value={nextDue}
                onChangeText={setNextDue}
                placeholder="2026-06-30"
              />
            </View>
          </View>

          <FormInput
            label="Performed By"
            value={perfBy}
            onChangeText={setPerfBy}
            placeholder="Name or garage"
          />

          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            multiline
            numberOfLines={2}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Save Maintenance Record</Text>}
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

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
