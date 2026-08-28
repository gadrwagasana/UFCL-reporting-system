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
import { useHarvestCreate, useHarvestUpdate, useCompartments, useHarvestPlans } from '../../hooks/useHarvest';
import { useOfflineStore } from '../../stores/offlineStore';
import { EP }              from '../../api/endpoints';
import { MachinePendingApproval } from '../../types/api';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp   = NativeStackNavigationProp<HarvestStackParamList, 'HarvestCreate'>;
type RoutePropT = RouteProp<HarvestStackParamList, 'HarvestCreate'>;

// harvest_date is returned as 'DD/MM/YYYY' for display (HarvestListScreen/
// HarvestDetailScreen) but the date columns themselves expect ISO
// 'YYYY-MM-DD' on write — same conversion needed as the vehicle-maintenance
// edit form (Stabilization Phase 5, F-16).
function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return format(new Date(), 'yyyy-MM-dd');
  return `${y}-${m}-${d}`;
}

export function HarvestCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const entry      = route.params?.entry;
  const isEdit     = !!entry;

  const { createEntry }       = useHarvestCreate();
  const { updateEntry }       = useHarvestUpdate();
  const { data: comptData }   = useCompartments();
  const { data: planData }    = useHarvestPlans();
  const { isOnline, enqueue } = useOfflineStore();

  const [harvestDate, setHarvestDate] = useState(entry ? toIsoDate(entry.harvest_date) : format(new Date(), 'yyyy-MM-dd'));
  const [species,     setSpecies]     = useState(entry?.species ?? '');
  const [quantity,    setQuantity]    = useState(entry ? String(entry.quantity) : '');
  const [comptId,     setComptId]     = useState(entry?.compt_id ? String(entry.compt_id) : '');
  const [subName,     setSubName]     = useState(entry?.sub_name ?? '');
  const [logsCrosscut,    setLogsCrosscut]    = useState(entry?.logs_crosscut != null ? String(entry.logs_crosscut) : '');
  const [logsHandrolled,  setLogsHandrolled]  = useState(entry?.logs_handrolled != null ? String(entry.logs_handrolled) : '');
  const [notes,       setNotes]       = useState(entry?.notes ?? '');
  const [planId,      setPlanId]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // Harvesting Phase 2 (Workstream 1) — "Planning feeds Harvest Records":
  // only offered on create (execution against a plan), matching desktop's
  // "Log Harvest" overlay. Only open (not yet Completed/Cancelled) plans.
  const planOptions = (planData?.rows ?? [])
    .filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled')
    .map((p) => ({
      label: `${p.species} — ${p.planned_date}${p.compt_name ? ' — ' + p.compt_name : ''}`,
      value: String(p.id),
    }));

  // Harvesting Phase 1 (Workstream 3 parity fix) — desktop's compartment
  // picker disables already-completed compartments (nothing left to harvest
  // there) and auto-fills species along with sub-name; this screen only did
  // the latter. When editing, the entry's own (possibly now-completed)
  // compartment must stay selectable, or the edit form would be unable to
  // save the record's existing value.
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
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      Alert.alert('Required', 'Quantity must be a positive number.'); return;
    }

    const payload = {
      harvest_date:    harvestDate,
      species:         species.trim(),
      quantity:        qty,
      ...(comptId           && { compt_id: Number(comptId) }),
      ...(subName           && { sub_name: subName }),
      ...(logsCrosscut.trim()   && { logs_crosscut:   Number(logsCrosscut) }),
      ...(logsHandrolled.trim() && { logs_handrolled: Number(logsHandrolled) }),
      ...(notes.trim()      && { notes: notes.trim() }),
      ...(!isEdit && planId && { plan_id: Number(planId) }),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        if (!isOnline) {
          Alert.alert('Online Required', 'Editing a harvest entry requires an active connection.');
          return;
        }
        const result = await updateEntry(entry!.id, payload);
        if (result && (result as MachinePendingApproval).pendingApproval) {
          Alert.alert('Submitted for Review', (result as MachinePendingApproval).message);
          navigation.goBack();
          return;
        }
        navigation.goBack();
        return;
      }
      if (!isOnline) {
        enqueue({ endpoint: EP.HARVEST_CREATE, method: 'POST', body: payload, context: 'harvest' });
        Alert.alert('Saved Offline', 'Entry will sync when connected.');
        navigation.goBack();
        return;
      }
      await createEntry(payload);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save harvest entry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={isEdit ? 'Edit Harvest Entry' : 'Log Harvest'} dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Harvest Details</Text>

          <DatePickerField
            label="Harvest Date"
            value={harvestDate}
            onChange={setHarvestDate}
            maxDate={new Date()}
          />

          <FormInput
            label="Species"
            value={species}
            onChangeText={setSpecies}
            placeholder="e.g. Eucalyptus, Pine"
            required
          />

          <FormInput
            label="Quantity (trees)"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="numeric"
            required
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
              // Workstream 3 parity fix — desktop auto-fills species too, not just sub-name.
              if (found?.species) setSpecies(found.species);
            }}
            options={[{ label: '— None —', value: '' }, ...compartmentOptions]}
            placeholder="Select compartment"
          />
        </View>

        {!isEdit && planOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fulfills Plan (optional)</Text>
            <FormSelect
              label="Harvest plan"
              value={planId}
              onChange={(v) => setPlanId(String(v))}
              options={[{ label: '— None (ad hoc) —', value: '' }, ...planOptions]}
              placeholder="Select a plan"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Details (optional)</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Crosscut Logs"
                value={logsCrosscut}
                onChangeText={setLogsCrosscut}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Handrolled Logs"
                value={logsHandrolled}
                onChangeText={setLogsHandrolled}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <FormInput
            label="Remarks (optional)"
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
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : isOnline ? 'Save Entry' : 'Save Offline'}</Text>}
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
