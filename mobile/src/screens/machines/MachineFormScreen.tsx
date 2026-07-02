import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useMachineList, useMachineCreate, useMachineUpdate } from '../../hooks/useMachines';
import { useOfflineStore } from '../../stores/offlineStore';
import { MachinesStackParamList } from '../../navigation/types';
import { MACHINE_STATUS, MACHINE_FUEL_TYPE, MachineStatus } from '../../constants/machineEnums';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<MachinesStackParamList, 'MachineForm'>;
type RoutePropT = RouteProp<MachinesStackParamList, 'MachineForm'>;

const STATUS_OPTIONS = MACHINE_STATUS.map(s => ({ label: s, value: s }));
const FUEL_OPTIONS   = [
  { label: '— No fuel type —', value: '' },
  ...MACHINE_FUEL_TYPE.map(f => ({ label: f, value: f })),
];

export function MachineFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const machine    = route.params?.machine;
  const isEdit     = !!machine;

  const { data: listData }  = useMachineList();
  const { createMachine }   = useMachineCreate();
  const { updateMachine }   = useMachineUpdate();
  const { isOnline }        = useOfflineStore();

  const categories = listData?.categories ?? [];
  const workshops  = listData?.workshops  ?? [];

  const catOptions = [
    { label: '— Select category —', value: '' },
    ...categories.map(c => ({ label: c.name, value: String(c.id) })),
  ];
  const wshOptions = [
    { label: '— Unassigned —', value: '' },
    ...workshops.map(w => ({ label: w.name + (w.workshop_type ? ` (${w.workshop_type})` : ''), value: String(w.id) })),
  ];

  const [code,     setCode]     = useState(machine?.machine_code          ?? '');
  const [name,     setName]     = useState(machine?.name                  ?? '');
  const [catId,    setCatId]    = useState(machine?.category_id ? String(machine.category_id) : '');
  const [wshId,    setWshId]    = useState(machine?.workshop_id  ? String(machine.workshop_id)  : '');
  const [status,   setStatus]   = useState<MachineStatus>(machine?.status ?? 'Available');
  const [plate,    setPlate]    = useState(machine?.plate_number           ?? '');
  const [cap,      setCap]      = useState(machine?.production_capacity != null ? String(machine.production_capacity) : '');
  const [capUnit,  setCapUnit]  = useState(machine?.capacity_unit         ?? 'm³');
  const [fuelRate, setFuelRate] = useState(machine?.fuel_consumption_rate != null ? String(machine.fuel_consumption_rate) : '');
  const [fuelType, setFuelType] = useState(machine?.fuel_type             ?? '');
  const [mfg,      setMfg]      = useState(machine?.manufacturer          ?? '');
  const [model,    setModel]    = useState(machine?.model_number           ?? '');
  const [serial,   setSerial]   = useState(machine?.serial_number          ?? '');
  const [year,     setYear]     = useState(machine?.year_manufactured != null ? String(machine.year_manufactured) : '');
  const [acquired, setAcquired] = useState(machine?.date_acquired?.slice(0, 10) ?? '');
  const [notes,    setNotes]    = useState(machine?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Saving machines requires an active connection.');
      return;
    }
    if (!code.trim() && !isEdit) {
      Alert.alert('Required', 'Machine code is required.'); return;
    }
    if (!name.trim()) {
      Alert.alert('Required', 'Machine name is required.'); return;
    }
    if (!catId) {
      Alert.alert('Required', 'Category is required.'); return;
    }

    const payload = {
      name:                  name.trim(),
      category_id:           Number(catId),
      workshop_id:           wshId ? Number(wshId) : null,
      status,
      plate_number:          plate.trim()   || null,
      production_capacity:   cap      ? parseFloat(cap)      : 0,
      capacity_unit:         capUnit.trim() || 'm³',
      fuel_consumption_rate: fuelRate ? parseFloat(fuelRate) : 0,
      fuel_type:             fuelType || null,
      manufacturer:          mfg.trim()    || null,
      model_number:          model.trim()  || null,
      serial_number:         serial.trim() || null,
      year_manufactured:     year    ? parseInt(year, 10) : null,
      date_acquired:         acquired || null,
      notes:                 notes.trim()  || null,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        const result = await updateMachine(machine!.id, payload);
        if (result && 'pendingApproval' in result) {
          Alert.alert('Submitted for Review', result.message ?? 'Your edit has been sent for approval.');
          navigation.goBack();
          return;
        }
      } else {
        await createMachine({ ...payload, machine_code: code.trim() });
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save machine.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Machine' : 'Register Machine'}
        subtitle={isEdit ? `${machine!.machine_code} — ${machine!.name}` : undefined}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          {isEdit ? (
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyLabel}>Machine Code</Text>
              <Text style={styles.readonlyValue}>{machine!.machine_code}</Text>
            </View>
          ) : (
            <FormInput
              label="Machine Code *"
              value={code}
              onChangeText={setCode}
              placeholder="e.g. SW-001"
              required
            />
          )}
          <FormInput
            label="Name *"
            value={name}
            onChangeText={setName}
            placeholder="Machine name"
            required
          />
          <FormSelect
            label="Category *"
            value={catId}
            onChange={(v) => setCatId(String(v))}
            options={catOptions}
            required
          />
          <FormSelect
            label="Assigned Workshop"
            value={wshId}
            onChange={(v) => setWshId(String(v))}
            options={wshOptions}
          />
        </View>

        {/* Status & Plate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <FormSelect
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as MachineStatus)}
                options={STATUS_OPTIONS}
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Plate / Fleet No."
                value={plate}
                onChangeText={setPlate}
                placeholder="e.g. RAA 001A"
              />
            </View>
          </View>
        </View>

        {/* Specifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.row}>
            <View style={[styles.col, { flex: 2 }]}>
              <FormInput
                label="Production Capacity"
                value={cap}
                onChangeText={setCap}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Unit"
                value={capUnit}
                onChangeText={setCapUnit}
                placeholder="m³"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Fuel Rate (L/hr)"
                value={fuelRate}
                onChangeText={setFuelRate}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              <FormSelect
                label="Fuel Type"
                value={fuelType}
                onChange={(v) => setFuelType(String(v))}
                options={FUEL_OPTIONS}
              />
            </View>
          </View>
        </View>

        {/* Asset Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asset Info</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput label="Manufacturer" value={mfg}    onChangeText={setMfg}    placeholder="e.g. Caterpillar" />
            </View>
            <View style={styles.col}>
              <FormInput label="Model"        value={model}  onChangeText={setModel}  placeholder="e.g. 320D" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput label="Serial Number" value={serial}   onChangeText={setSerial}   placeholder="" />
            </View>
            <View style={styles.col}>
              <FormInput label="Year Manufactured" value={year} onChangeText={setYear} placeholder="2020" keyboardType="numeric" />
            </View>
          </View>
          <FormInput
            label="Date Acquired (YYYY-MM-DD)"
            value={acquired}
            onChangeText={setAcquired}
            placeholder="2021-01-15"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            multiline
            numberOfLines={3}
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
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Register Machine'}</Text>}
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
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },

  readonlyField: { gap: 4 },
  readonlyLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  readonlyValue: {
    fontFamily: 'monospace', fontSize: Typography.base, fontWeight: Typography.bold,
    color: Colors.textPrimary, paddingVertical: Spacing.xs,
  },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
