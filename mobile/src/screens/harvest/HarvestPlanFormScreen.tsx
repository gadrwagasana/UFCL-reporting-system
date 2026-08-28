import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { AppHeader }       from '../../components/AppHeader';
import { FormInput }       from '../../components/FormInput';
import { FormSelect }      from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { useHarvestPlanCreate, useHarvestPlanUpdate, useCompartments } from '../../hooks/useHarvest';
import { MachinePendingApproval } from '../../types/api';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Harvesting Phase 2 (Workstream 1) — mirrors HarvestCreateScreen's dual
// create/edit pattern exactly (established Stabilization Phase 5, reused for
// Harvest Records in Harvesting Phase 1).

type NavProp    = NativeStackNavigationProp<HarvestStackParamList, 'HarvestPlanForm'>;
type RoutePropT = RouteProp<HarvestStackParamList, 'HarvestPlanForm'>;

function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return format(new Date(), 'yyyy-MM-dd');
  return `${y}-${m}-${d}`;
}

const PRIORITY_OPTIONS = [
  { label: 'Low',    value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High',   value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

export function HarvestPlanFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const plan       = route.params?.plan;
  const isEdit     = !!plan;

  const { createPlan } = useHarvestPlanCreate();
  const { updatePlan } = useHarvestPlanUpdate();
  const { data: comptData } = useCompartments();

  const [plannedDate, setPlannedDate] = useState(plan ? toIsoDate(plan.planned_date) : format(new Date(), 'yyyy-MM-dd'));
  const [species,     setSpecies]     = useState(plan?.species ?? '');
  const [comptId,     setComptId]     = useState(plan?.compt_id ? String(plan.compt_id) : '');
  const [subName,     setSubName]     = useState(plan?.sub_name ?? '');
  const [priority,    setPriority]    = useState(plan?.priority ?? 'normal');
  const [targetVol,   setTargetVol]   = useState(plan?.target_volume_m3 != null ? String(plan.target_volume_m3) : '');
  const [targetLogs,  setTargetLogs]  = useState(plan?.target_logs != null ? String(plan.target_logs) : '');
  const [notes,       setNotes]       = useState(plan?.notes ?? '');
  const [submitting,  setSubmitting]  = useState(false);

  const compartmentOptions = (comptData?.rows ?? [])
    .filter((c) => c.status !== 'Completed' || String(c.id) === comptId)
    .map((c) => ({
      label: c.compt_name + (c.sub_name ? ` (${c.sub_name})` : '') + (c.species ? ` — ${c.species}` : '') + (c.status === 'Completed' ? ' [Completed]' : ''),
      value: String(c.id),
    }));

  async function handleSubmit() {
    if (!species.trim()) {
      Alert.alert('Required', 'Species is required.'); return;
    }
    if (!plannedDate) {
      Alert.alert('Required', 'Planned date is required.'); return;
    }

    const payload = {
      planned_date: plannedDate,
      species:      species.trim(),
      priority,
      ...(comptId          && { compt_id: Number(comptId) }),
      ...(subName          && { sub_name: subName }),
      ...(targetVol.trim() && { target_volume_m3: Number(targetVol) }),
      ...(targetLogs.trim() && { target_logs: Number(targetLogs) }),
      ...(notes.trim()     && { notes: notes.trim() }),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        const result = await updatePlan(plan!.id, payload);
        if (result && (result as MachinePendingApproval).pendingApproval) {
          Alert.alert('Submitted for Review', (result as MachinePendingApproval).message);
          navigation.goBack();
          return;
        }
        navigation.goBack();
        return;
      }
      await createPlan(payload);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save harvest plan.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={isEdit ? 'Edit Harvest Plan' : 'New Harvest Plan'} dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Details</Text>

          <DatePickerField
            label="Planned Date"
            value={plannedDate}
            onChange={setPlannedDate}
          />

          <FormInput
            label="Species"
            value={species}
            onChangeText={setSpecies}
            placeholder="e.g. Eucalyptus, Pine"
            required
          />

          <FormSelect
            label="Priority"
            value={priority}
            onChange={(v) => setPriority(String(v))}
            options={PRIORITY_OPTIONS}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compartment (optional)</Text>

          <FormSelect
            label="Compartment"
            value={comptId}
            onChange={(v) => {
              const id = String(v);
              setComptId(id);
              const found = (comptData?.rows ?? []).find((c) => String(c.id) === id);
              setSubName(found?.sub_name ?? '');
              if (found?.species) setSpecies(found.species);
            }}
            options={[{ label: '— None —', value: '' }, ...compartmentOptions]}
            placeholder="Select compartment"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Targets (optional)</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Target Volume (m³)"
                value={targetVol}
                onChangeText={setTargetVol}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Target Logs"
                value={targetLogs}
                onChangeText={setTargetLogs}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <FormInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes…"
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
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Create Plan'}</Text>}
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
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  row: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },

  submitBtn: {
    backgroundColor: Colors.green, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
