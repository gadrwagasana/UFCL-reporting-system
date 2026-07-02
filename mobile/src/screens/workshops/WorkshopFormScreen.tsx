import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useWorkshopCreate, useWorkshopUpdate } from '../../hooks/useWorkshops';
import { useOfflineStore } from '../../stores/offlineStore';
import { WorkshopManagementStackParamList } from '../../navigation/types';
import { WORKSHOP_TYPES } from '../../constants/workshopEnums';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<WorkshopManagementStackParamList, 'WorkshopForm'>;
type RoutePropT = RouteProp<WorkshopManagementStackParamList, 'WorkshopForm'>;

const TYPE_OPTIONS = [
  { label: '— Select type —', value: '' },
  ...WORKSHOP_TYPES.map(t => ({ label: t, value: t })),
];

export function WorkshopFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const workshop   = route.params?.workshop;
  const isEdit     = !!workshop;

  const { createWorkshop } = useWorkshopCreate();
  const { updateWorkshop } = useWorkshopUpdate();
  const { isOnline }       = useOfflineStore();

  const [name,     setName]     = useState(workshop?.name          ?? '');
  const [location, setLocation] = useState(workshop?.location      ?? '');
  const [type,     setType]     = useState(workshop?.workshop_type  ?? '');
  const [capacity, setCapacity] = useState(workshop?.capacity != null ? String(workshop.capacity) : '');
  const [notes,    setNotes]    = useState(workshop?.notes          ?? '');
  const [active,   setActive]   = useState(workshop?.active !== false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Saving workshops requires an active connection.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Required', 'Workshop name is required.'); return;
    }

    const payload: Record<string, unknown> = {
      name:          name.trim(),
      location:      location.trim() || null,
      workshop_type: type || null,
      capacity:      capacity ? Number(capacity) : null,
      notes:         notes.trim() || null,
      active,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateWorkshop({ id: workshop!.id, payload });
      } else {
        await createWorkshop(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save workshop.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Workshop' : 'Add Workshop'}
        subtitle={isEdit ? workshop!.name : undefined}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <FormInput
            label="Name *"
            value={name}
            onChangeText={setName}
            placeholder="Workshop name"
            required
          />
          <FormInput
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Block A, North Site"
          />
          <FormSelect
            label="Workshop Type"
            value={type}
            onChange={v => setType(String(v))}
            options={TYPE_OPTIONS}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capacity & Notes</Text>
          <FormInput
            label="Capacity (units)"
            value={capacity}
            onChangeText={setCapacity}
            placeholder="0"
            keyboardType="numeric"
          />
          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            multiline
            numberOfLines={3}
          />
        </View>

        {isEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Active</Text>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: Colors.border, true: Colors.navy }}
                thumbColor={Colors.white}
              />
            </View>
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
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Add Workshop'}</Text>}
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

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  toggleLabel: { fontSize: Typography.base, color: Colors.textPrimary },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
