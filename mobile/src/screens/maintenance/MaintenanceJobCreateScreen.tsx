import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { useMachineList } from '../../hooks/useMachines';
import { useMaintenanceJobCreate } from '../../hooks/useMaintenanceJobs';
import { MaintenanceJobsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MaintenanceJobsStackParamList, 'MaintenanceJobCreate'>;

const PRIORITIES: { value: 'normal' | 'high' | 'urgent'; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function MaintenanceJobCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { data: machineData, isLoading } = useMachineList();
  const { createJob } = useMaintenanceJobCreate();

  const [machineId, setMachineId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);

  const machines = machineData?.machines ?? [];

  if (isLoading) return <LoadingState message="Loading machines…" fullScreen />;

  async function submit() {
    if (!machineId) { Alert.alert('Machine required', 'Please select a machine.'); return; }
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a title.'); return; }
    setSubmitting(true);
    try {
      await createJob({ machine_id: machineId, title: title.trim(), description: description.trim() || undefined, priority });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not create the maintenance job.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="New Maintenance Job" dark />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.label}>Machine *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {machines.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, machineId === m.id && styles.chipActive]}
              onPress={() => setMachineId(m.id)}
            >
              <Text style={[styles.chipText, machineId === m.id && styles.chipTextActive]}>{m.machine_code} — {m.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Hydraulic leak repair" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Optional" multiline />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.chipRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity key={p.value} style={[styles.chip, priority === p.value && styles.chipActive]} onPress={() => setPriority(p.value)}>
              <Text style={[styles.chipText, priority === p.value && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting} activeOpacity={0.8}>
          <Text style={styles.submitBtnText}>{submitting ? 'Creating…' : 'Create Job'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  label: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.card },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.sm },
  submitBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
