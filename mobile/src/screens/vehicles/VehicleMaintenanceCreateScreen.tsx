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
import { useMaintenanceCreate, useMaintenanceUpdate } from '../../hooks/useVehicles';
import { useOfflineStore }      from '../../stores/offlineStore';
import { MaintenanceType, VehiclePendingApproval } from '../../types/api';
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

// maintenanceList (used to populate the vehicle detail screen this form is
// opened from) formats dates as 'DD/MM/YYYY' for display; the date columns
// themselves expect an unambiguous ISO 'YYYY-MM-DD' on write. Convert when
// pre-filling from an existing record — the create flow never hits this
// since it starts from today() (already ISO).
function toIsoDate(ddmmyyyy: string | null): string {
  if (!ddmmyyyy) return '';
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m}-${d}`;
}

export function VehicleMaintenanceCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { vehicleId, registration, record } = route.params;
  const isEdit = !!record;

  const { createMaintenance } = useMaintenanceCreate();
  const { updateMaintenance } = useMaintenanceUpdate();
  const { isOnline }          = useOfflineStore();

  const [date,      setDate]      = useState(record ? toIsoDate(record.maintenance_date) : today());
  const [mtype,     setMtype]     = useState<MaintenanceType>(record?.maintenance_type ?? 'Scheduled');
  const [desc,      setDesc]      = useState(record?.description ?? '');
  const [cost,      setCost]      = useState(record?.cost != null ? String(record.cost) : '');
  const [nextDue,   setNextDue]   = useState(record ? toIsoDate(record.next_due_date) : '');
  const [perfBy,    setPerfBy]    = useState(record?.performed_by ?? '');
  const [notes,     setNotes]     = useState(record?.notes ?? '');
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

    const payload = {
      maintenance_date: date,
      maintenance_type: mtype,
      description:      desc.trim(),
      cost:             cost    ? parseFloat(cost)   : null,
      next_due_date:    nextDue || null,
      performed_by:     perfBy.trim() || undefined,
      notes:            notes.trim()  || undefined,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        const result = await updateMaintenance(record!.id, vehicleId, payload);
        if (result && (result as VehiclePendingApproval).pendingApproval) {
          Alert.alert('Submitted for Review', (result as VehiclePendingApproval).message);
          navigation.goBack();
          return;
        }
      } else {
        await createMaintenance(vehicleId, payload);
      }
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
        title={isEdit ? 'Edit Maintenance' : 'Add Maintenance'}
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
