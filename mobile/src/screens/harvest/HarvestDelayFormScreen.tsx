import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useHarvestDelayCreate } from '../../hooks/useHarvest';
import { useCompartments } from '../../hooks/useHarvest';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<HarvestStackParamList, 'HarvestDelayForm'>;

const CATEGORY_OPTIONS = [
  'Weather', 'Equipment Breakdown', 'Transport Unavailable', 'Labour Shortage', 'Safety Stop', 'Other',
].map((c) => ({ label: c, value: c }));

export function HarvestDelayFormScreen() {
  const navigation = useNavigation<NavProp>();
  const { createDelay } = useHarvestDelayCreate();
  const { data: comptData } = useCompartments();

  const [category,   setCategory]   = useState('Weather');
  const [comptId,     setComptId]   = useState('');
  const [duration,    setDuration]  = useState('');
  const [impact,      setImpact]    = useState('');
  const [submitting,  setSubmitting] = useState(false);

  const compartmentOptions = (comptData?.rows ?? []).map((c) => ({
    label: c.compt_name + (c.sub_name ? ` (${c.sub_name})` : ''),
    value: String(c.id),
  }));

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await createDelay({
        category,
        ...(comptId && { compt_id: Number(comptId) }),
        ...(duration.trim() && { duration_hours: Number(duration) }),
        ...(impact.trim() && { production_impact: impact.trim() }),
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not log delay.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Log Operational Delay" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delay Details</Text>

          <FormSelect
            label="Category"
            value={category}
            onChange={(v) => setCategory(String(v))}
            options={CATEGORY_OPTIONS}
            required
          />

          <FormInput
            label="Duration (hours)"
            value={duration}
            onChangeText={setDuration}
            placeholder="Optional"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Affected Compartment (optional)</Text>
          <FormSelect
            label="Compartment"
            value={comptId}
            onChange={(v) => setComptId(String(v))}
            options={[{ label: '— None / general —', value: '' }, ...compartmentOptions]}
            placeholder="Select compartment"
          />
        </View>

        <View style={styles.section}>
          <FormInput
            label="Production Impact (optional)"
            value={impact}
            onChangeText={setImpact}
            placeholder="What was affected, e.g. 2 crews idle"
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
            : <Text style={styles.submitText}>Log Delay</Text>}
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

  submitBtn: {
    backgroundColor: Colors.green, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
