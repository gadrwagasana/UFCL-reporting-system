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
import { useMaintScheduleCreate } from '../../hooks/useMachines';
import { useOfflineStore }        from '../../stores/offlineStore';
import { MachinesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<MachinesStackParamList, 'MachineMaintScheduleCreate'>;
type RoutePropT = RouteProp<MachinesStackParamList, 'MachineMaintScheduleCreate'>;

export function MachineMaintScheduleCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { machineId, machineName } = route.params;

  const { createSchedule } = useMaintScheduleCreate();
  const { isOnline }       = useOfflineStore();

  const [mtype,   setMtype]   = useState('');
  const [freq,    setFreq]    = useState('30');
  const [last,    setLast]    = useState('');
  const [nextDue, setNextDue] = useState('');
  const [hours,   setHours]   = useState('1');
  const [notes,   setNotes]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Maintenance schedules require an active connection.');
      return;
    }
    if (!mtype.trim()) {
      Alert.alert('Required', 'Maintenance type is required.'); return;
    }

    setSubmitting(true);
    try {
      await createSchedule(machineId, {
        maintenance_type: mtype.trim(),
        frequency_days:   freq   ? parseInt(freq,   10) : 30,
        estimated_hours:  hours  ? parseFloat(hours)    : 1,
        last_performed:   last     || null,
        next_due:         nextDue  || null,
        notes:            notes.trim() || null,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save schedule.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Add Schedule"
        subtitle={machineName}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <FormInput
            label="Maintenance Type *"
            value={mtype}
            onChangeText={setMtype}
            placeholder="e.g. Oil Change, Filter Replace"
            required
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Frequency (days)"
                value={freq}
                onChangeText={setFreq}
                placeholder="30"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Est. Hours"
                value={hours}
                onChangeText={setHours}
                placeholder="1"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Last Performed (YYYY-MM-DD)"
                value={last}
                onChangeText={setLast}
                placeholder="2025-06-01"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Next Due (YYYY-MM-DD)"
                value={nextDue}
                onChangeText={setNextDue}
                placeholder="2025-07-01"
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

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Save Schedule</Text>}
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
