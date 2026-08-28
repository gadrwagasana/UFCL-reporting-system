import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormInput }     from '../../components/FormInput';
import { FormSelect }    from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { useMachineLogCreate, useMachineLogUpdate, useMachineLogList, useMachineFuelIssued } from '../../hooks/useMachineLog';
import { MachineLogStackScreenProps } from '../../navigation/types';
import { useOfflineStore } from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

const SHIFTS = ['Full Day', 'Day Shift', 'Night Shift'];

type Props = MachineLogStackScreenProps<'MachineLogCreate'>;

// Remediation Phase 3 — dual-purpose create/edit, mirroring the same
// create-vs-edit-one-form pattern LogTransportCreateScreen already adopted
// this program (optional `entry` route param puts it into edit mode).
export function MachineLogCreateScreen({ navigation }: Props) {
  const route    = useRoute<Props['route']>();
  const existing = route.params?.entry;
  const { createLog }   = useMachineLogCreate();
  const { updateLog }   = useMachineLogUpdate();
  const { data: listData } = useMachineLogList();
  const isOnline        = useOfflineStore((s) => s.isOnline);

  const machines        = listData?.machines ?? [];
  const itemCategories  = listData?.itemCategories ?? [];

  const [machineId, setMachineId]         = useState(existing ? String(existing.machine_id) : '');
  const [logDate, setLogDate]             = useState<string>(existing?.log_date ?? new Date().toISOString().split('T')[0]);
  const [shift, setShift]                 = useState(existing?.shift ?? 'Full Day');
  const [hoursWorked, setHoursWorked]     = useState(existing?.hours_worked != null ? String(existing.hours_worked) : '');
  const [downtimeHours, setDowntimeHours] = useState(existing?.downtime_hours != null ? String(existing.downtime_hours) : '');
  const [downtimeReason, setDowntimeReason] = useState(existing?.downtime_reason ?? '');
  const [fuelConsumed, setFuelConsumed]       = useState(existing?.fuel_consumed != null ? String(existing.fuel_consumed) : '');
  const [dailyProduction, setDailyProduction] = useState(existing?.daily_production != null ? String(existing.daily_production) : '');
  const [capacityPerDay, setCapacityPerDay]   = useState(existing?.capacity_per_day != null ? String(existing.capacity_per_day) : '');
  const [productType, setProductType]         = useState(existing?.product_type ?? '');
  const [logsLoaded, setLogsLoaded]           = useState(existing?.logs_loaded != null ? String(existing.logs_loaded) : '');
  const [logsUnloaded, setLogsUnloaded]       = useState(existing?.logs_unloaded != null ? String(existing.logs_unloaded) : '');
  const [loadingTrips, setLoadingTrips]       = useState(existing?.loading_trips != null ? String(existing.loading_trips) : '');
  const [itemCategory, setItemCategory]       = useState(existing?.item_category ?? '');
  const [remarks, setRemarks]                 = useState(existing?.remarks ?? '');
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
      const payload = {
        machine_id:       Number(machineId),
        log_date:         logDate,
        shift,
        hours_worked:     hoursWorked      ? parseFloat(hoursWorked)     : undefined,
        downtime_hours:   downtimeHours    ? parseFloat(downtimeHours)   : undefined,
        downtime_reason:  downtimeReason.trim() || undefined,
        fuel_consumed:    fuelConsumed     ? parseFloat(fuelConsumed)    : undefined,
        daily_production: dailyProduction  ? parseFloat(dailyProduction) : undefined,
        capacity_per_day: capacityPerDay  ? parseFloat(capacityPerDay)  : undefined,
        product_type:     productType.trim() || undefined,
        logs_loaded:      logsLoaded      ? parseFloat(logsLoaded)      : undefined,
        logs_unloaded:    logsUnloaded    ? parseFloat(logsUnloaded)    : undefined,
        loading_trips:    loadingTrips    ? parseInt(loadingTrips, 10)  : undefined,
        item_category:    itemCategory || undefined,
        remarks:          remarks.trim() || undefined,
      };
      if (existing) {
        const result = await updateLog(existing.id, payload);
        if (result && 'pendingApproval' in result && result.pendingApproval) {
          Alert.alert('Submitted for Review', result.message);
        }
      } else {
        await createLog(payload);
      }
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
      <AppHeader title={existing ? 'Edit Machine Log' : 'Log Machine Shift'} dark onBack={() => navigation.goBack()} />

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
          label="Capacity per Day"
          value={capacityPerDay}
          onChangeText={setCapacityPerDay}
          keyboardType="decimal-pad"
          placeholder="Optional"
        />

        <FormInput
          label="Product Type"
          value={productType}
          onChangeText={setProductType}
          placeholder="e.g. Sawn Timber, Poles"
        />

        <FormInput
          label="Logs Loaded (m³)"
          value={logsLoaded}
          onChangeText={setLogsLoaded}
          keyboardType="decimal-pad"
          placeholder="Optional"
        />

        <FormInput
          label="Logs Unloaded (m³)"
          value={logsUnloaded}
          onChangeText={setLogsUnloaded}
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
            : <Text style={styles.submitText}>{existing ? 'Save Changes' : 'Save Log'}</Text>
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
