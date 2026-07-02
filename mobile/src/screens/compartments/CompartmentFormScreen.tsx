import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useCompartmentCreate, useCompartmentUpdate } from '../../hooks/useCompartments';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuthStore }    from '../../stores/authStore';
import { CompartmentsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<CompartmentsStackParamList, 'CompartmentForm'>;
type RoutePropT = RouteProp<CompartmentsStackParamList, 'CompartmentForm'>;

const STATUS_OPTIONS = [
  { label: 'Active',    value: 'Active' },
  { label: 'Completed', value: 'Completed' },
];

export function CompartmentFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const compartment = route.params?.compartment;
  const isEdit      = !!compartment;

  const role         = useAuthStore(s => s.user?.role ?? '');
  const isSupervisor = role === 'supervisor';

  const { createCompartment } = useCompartmentCreate();
  const { updateCompartment } = useCompartmentUpdate();
  const { isOnline }          = useOfflineStore();

  // Entry date: convert 'DD/MM/YYYY' from server to 'YYYY-MM-DD' for input
  const toIso = (dmy?: string) => {
    if (!dmy) return new Date().toISOString().slice(0, 10);
    const [d, m, y] = dmy.split('/');
    return `${y}-${m}-${d}`;
  };

  const [entryDate, setEntryDate] = useState(toIso(compartment?.entry_date));
  const [comptName, setComptName] = useState(compartment?.compt_name ?? '');
  const [subName,   setSubName]   = useState(compartment?.sub_name   ?? '');
  const [species,   setSpecies]   = useState(compartment?.species    ?? '');
  const [areaHa,    setAreaHa]    = useState(compartment?.area_ha != null ? String(compartment.area_ha) : '');
  const [status,    setStatus]    = useState(compartment?.status     ?? 'Active');
  const [submitting, setSubmitting] = useState(false);

  // Live volume preview: area × 219
  const [volumePreview, setVolumePreview] = useState<number | null>(
    compartment?.area_ha ? Math.round(Number(compartment.area_ha) * 219 * 100) / 100 : null
  );

  useEffect(() => {
    const v = parseFloat(areaHa);
    setVolumePreview(v > 0 ? Math.round(v * 219 * 100) / 100 : null);
  }, [areaHa]);

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Saving compartments requires an active connection.');
      return;
    }
    if (!comptName.trim())      { Alert.alert('Required', 'Compartment name is required.'); return; }
    if (!species.trim())        { Alert.alert('Required', 'Species is required.');           return; }
    if (!areaHa || parseFloat(areaHa) <= 0) { Alert.alert('Required', 'Area (ha) must be greater than 0.'); return; }
    if (!entryDate)             { Alert.alert('Required', 'Entry date is required.');        return; }

    const payload: Record<string, unknown> = {
      compt_name: comptName.trim(),
      sub_name:   subName.trim() || null,
      species:    species.trim(),
      area_ha:    parseFloat(areaHa),
      entry_date: entryDate,
      ...(isEdit ? { status } : {}),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        const result = await updateCompartment({ id: compartment!.id, payload }) as any;
        if (result?.pendingApproval) {
          Alert.alert('Submitted for Review', result.message ?? 'Your edit has been sent for approval.');
          navigation.goBack();
          return;
        }
      } else {
        await createCompartment(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save compartment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Compartment' : 'Add Compartment'}
        subtitle={isEdit ? compartment!.compt_name : 'Volume is auto-calculated at 219 m³/ha'}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <FormInput
            label="Entry Date * (YYYY-MM-DD)"
            value={entryDate}
            onChangeText={setEntryDate}
            placeholder="2025-01-15"
          />
          <FormInput
            label="Compartment Name *"
            value={comptName}
            onChangeText={setComptName}
            placeholder="e.g. Compt A1"
            required
          />
          <FormInput
            label="Sub Name"
            value={subName}
            onChangeText={setSubName}
            placeholder="e.g. Block 1, Sub A (optional)"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forest Data</Text>
          <FormInput
            label="Species *"
            value={species}
            onChangeText={setSpecies}
            placeholder="e.g. Eucalyptus, Pine"
            required
          />
          <FormInput
            label="Area (ha) *"
            value={areaHa}
            onChangeText={setAreaHa}
            placeholder="0.000"
            keyboardType="decimal-pad"
            required
          />

          {/* Live volume preview */}
          <View style={styles.volumePreview}>
            <Text style={styles.volumePreviewLabel}>Auto-calculated volume</Text>
            <Text style={styles.volumePreviewValue}>
              {volumePreview !== null ? `${volumePreview.toFixed(1)} m³` : '— m³'}
            </Text>
            <Text style={styles.volumePreviewSub}>= Area (ha) × 219 m³/ha</Text>
          </View>
        </View>

        {isEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <FormSelect
              label="Status"
              value={status}
              onChange={v => setStatus(String(v) as 'Active' | 'Completed')}
              options={STATUS_OPTIONS}
            />
            {isSupervisor && (
              <Text style={styles.govNote}>
                As supervisor, your edit will be submitted for manager approval.
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>
                {isEdit
                  ? (isSupervisor ? 'Submit for Approval' : 'Save Changes')
                  : 'Add Compartment'}
              </Text>}
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

  volumePreview: {
    backgroundColor: Colors.success + '12',
    borderWidth: 1, borderColor: Colors.success + '40',
    borderRadius: Radius.md, padding: Spacing.sm, gap: 2,
  },
  volumePreviewLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.success },
  volumePreviewValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.success },
  volumePreviewSub:   { fontSize: 10, color: Colors.textMuted },

  govNote: {
    fontSize: Typography.xs, color: Colors.warning,
    fontStyle: 'italic', marginTop: Spacing.xs,
  },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
