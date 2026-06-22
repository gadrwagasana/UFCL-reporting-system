import React, { useEffect, useState } from 'react';
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
import { useMachineLogCreate, useMachineLogList, useMachineFuelIssued } from '../../hooks/useMachineLog';
import { MachineLogStackScreenProps } from '../../navigation/types';
import { useOfflineStore } from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

const SHIFTS = ['Full Day', 'AM', 'PM'];

type Props = MachineLogStackScreenProps<'MachineLogCreate'>;

export function MachineLogCreateScreen({ navigation }: Props) {
  const { createLog }   = useMachineLogCreate();
  const { data: listData } = useMachineLogList();
  const isOnline        = useOfflineStore((s) => s.isOnline);

  const machines        = listData?.machines ?? [];
  const itemCategories  = listData?.itemCategories ?? [];

  const [machineId, setMachineId]         = useState('');
  const [logDate, setLogDate]             = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift]                 = useState('Full Day');
  const [hoursWorked, setHoursWorked]     = useState('');
  const [downtimeHours, setDowntimeHours] = useState('');
  const [downtimeReason, setDowntimeReason] = useState('');
  const [fuelConsumed, setFuelConsumed]   = useState('');
  const [dailyProduction, setDailyProduction] = useState('');
  const [loadingTrips, setLoadingTrips]   = useState('');
  const [itemCategory, setItemCategory]   = useState('');
  const [remarks, setRemarks]             = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});

  // Auto-populate fuel consumed from fuel issued lookup
  const { data: fuelIssuedData } = useMachineFuelIssued(
    machineId ? Number(machineId) : null,
    logDate,
  );

  useEffect(() => {
    if (fuelIssuedData?.issued != null && fuelIssuedData.issued > 0 && !fuelConsumed) {
      setFuelConsumed(String(fuelIssuedData.issued));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuelIssuedData]);

  const machineOptions = machines.map((m) => ({
    label: m.name + (m.machine_code ? ` (${m.machine_code})` : ''),
    value: String(m.id),
  }));

  const shiftOptions    = SHIFTS.map((s) => ({ label: s, value: s }));
  const categoryOptions = itemCategories.map((c) => ({ label: c.name, value: String(c.id) }));

  const downtimeFloat = parseFloat(downtimeHours) || 0;

  function validate() {
    const e: Record<string, string> = {};
    if (!machineId) e.machineId = 'Machine is required';
    if (downtimeFloat > 0 && !downtimeReason.trim()) {
      e.downtimeReason = 'Describe reason for downtime';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Offline', 'Machine logs require an internet connection.');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createLog({
        machine_id:       Number(machineId),
        log_date:         logDate,
        shift,
        hours_worked:     hoursWorked      ? parseFloat(hoursWorked)     : undefined,
        downtime_hours:   downtimeHours    ? parseFloat(downtimeHours)   : undefined,
        downtime_reason:  downtimeReason.trim() || undefined,
        fuel_consumed:    fuelConsumed     ? parseFloat(fuelConsumed)    : undefined,
        daily_production: dailyProduction  ? parseFloat(dailyProduction) : undefined,
        loading_trips:    loadingTrips     ? parseInt(loadingTrips, 10)  : undefined,
        item_category:    itemCategory || undefined,
        remarks:          remarks.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save machine log.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Log Machine Shift" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!isOnline && (
          <View style={styles.warnBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
            <Text style={styles.warnText}>You are offline. Connect to save.</Text>
          </View>
        )}

        <FormSelect
          label="Machine"
          value={machineId}
          options={machineOptions}
          placeholder="Select machine"
          onChange={(v) => setMachineId(String(v))}
          error={errors.machineId}
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
          label="Shift"
          value={shift}
          options={shiftOptions}
          onChange={(v) => setShift(String(v))}
        />

        <FormInput
          label="Hours Worked"
          value={hoursWorked}
          onChangeText={setHoursWorked}
          keyboardType="decimal-pad"
          placeholder="e.g. 8"
        />

        <FormInput
          label="Downtime Hours"
          value={downtimeHours}
          onChangeText={setDowntimeHours}
          keyboardType="decimal-pad"
          placeholder="0"
        />

        {downtimeFloat > 0 && (
          <FormInput
            label="Downtime Reason"
            value={downtimeReason}
            onChangeText={setDowntimeReason}
            placeholder="Describe reason for downtime"
            multiline
            error={errors.downtimeReason}
            required
          />
        )}

        <FormInput
          label="Fuel Consumed (L)"
          value={fuelConsumed}
          onChangeText={setFuelConsumed}
          keyboardType="decimal-pad"
          placeholder={fuelIssuedData?.issued ? `${fuelIssuedData.issued}L issued` : 'Optional'}
          hint={fuelIssuedData?.issued ? `${fuelIssuedData.issued}L was issued to this machine today` : undefined}
        />

        <FormInput
          label="Daily Production"
          value={dailyProduction}
          onChangeText={setDailyProduction}
          keyboardType="decimal-pad"
          placeholder="Optional"
        />

        <FormInput
          label="Loading Trips"
          value={loadingTrips}
          onChangeText={setLoadingTrips}
          keyboardType="numeric"
          placeholder="Optional"
        />

        {categoryOptions.length > 0 && (
          <FormSelect
            label="Item Category"
            value={itemCategory}
            options={[{ label: 'None', value: '' }, ...categoryOptions]}
            onChange={(v) => setItemCategory(String(v))}
          />
        )}

        <FormInput
          label="Remarks"
          value={remarks}
          onChangeText={setRemarks}
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
            : <Text style={styles.submitText}>Save Log</Text>
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
