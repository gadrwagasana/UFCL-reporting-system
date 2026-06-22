import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { AppHeader }       from '../../components/AppHeader';
import { FormInput }       from '../../components/FormInput';
import { DatePickerField } from '../../components/DatePickerField';
import { useSawmillCreate } from '../../hooks/useSawmill';
import { useOfflineStore }  from '../../stores/offlineStore';
import { EP }               from '../../api/endpoints';
import { SawmillStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<SawmillStackParamList, 'SawmillProductionCreate'>;

export function SawmillProductionCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { createEntry }       = useSawmillCreate();
  const { isOnline, enqueue } = useOfflineStore();

  const [prodDate,      setProdDate]      = useState(format(new Date(), 'yyyy-MM-dd'));
  const [machine,       setMachine]       = useState('');
  const [productSize,   setProductSize]   = useState('');
  const [kilnDried,     setKilnDried]     = useState('');
  const [ccaTreated,    setCcaTreated]    = useState('');
  const [untreated,     setUntreated]     = useState('');
  const [waste,         setWaste]         = useState('');
  const [logsReceived,  setLogsReceived]  = useState('');
  const [downtimeHours, setDowntimeHours] = useState('');
  const [remarks,       setRemarks]       = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  const totalTimber =
    (Number(kilnDried) || 0) + (Number(ccaTreated) || 0) + (Number(untreated) || 0);

  async function handleSubmit() {
    // Backend rule: machine required if timber > 0
    if (totalTimber > 0 && !machine.trim()) {
      Alert.alert('Required', 'Machine is required when recording timber production.'); return;
    }

    const payload = {
      date: prodDate,    // API field is `date`, NOT `log_date`
      ...(machine.trim()       && { machine: machine.trim() }),
      ...(productSize.trim()   && { product_size: productSize.trim() }),
      ...(kilnDried            && { timber_kiln_dried:   Number(kilnDried) }),
      ...(ccaTreated           && { timber_cca_treated:  Number(ccaTreated) }),
      ...(untreated            && { timber_untreated:    Number(untreated) }),
      ...(waste                && { timber_waste:        Number(waste) }),
      ...(logsReceived         && { logs_received:       Number(logsReceived) }),
      ...(downtimeHours        && { downtime_hours:      Number(downtimeHours) }),
      ...(remarks.trim()       && { remarks: remarks.trim() }),
    };

    setSubmitting(true);
    try {
      if (!isOnline) {
        enqueue({ endpoint: EP.SAWMILL_CREATE, method: 'POST', body: payload, context: 'sawmill' });
        Alert.alert('Saved Offline', 'Production record will sync when connected.');
        navigation.goBack();
        return;
      }
      await createEntry(payload);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save production record.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Log Production" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Production Details</Text>

          <DatePickerField
            label="Production Date"
            value={prodDate}
            onChange={setProdDate}
            maxDate={new Date()}
          />

          <FormInput
            label="Machine"
            value={machine}
            onChangeText={setMachine}
            placeholder="e.g. Sawmill #1"
            hint={totalTimber > 0 ? 'Required when recording timber' : undefined}
          />

          <FormInput
            label="Product Size"
            value={productSize}
            onChangeText={setProductSize}
            placeholder="e.g. 4×4 Timber"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timber Produced (units)</Text>

          {totalTimber > 0 && (
            <View style={styles.totalChip}>
              <Text style={styles.totalText}>Total: {totalTimber} units</Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Kiln Dried"
                value={kilnDried}
                onChangeText={setKilnDried}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="CCA Treated"
                value={ccaTreated}
                onChangeText={setCcaTreated}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>

          <FormInput
            label="Untreated"
            value={untreated}
            onChangeText={setUntreated}
            placeholder="0"
            keyboardType="numeric"
          />

          <FormInput
            label="Waste"
            value={waste}
            onChangeText={setWaste}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other (optional)</Text>

          <FormInput
            label="Logs Received"
            value={logsReceived}
            onChangeText={setLogsReceived}
            placeholder="0"
            keyboardType="numeric"
            hint="Must have log transport entries for this date"
          />

          <FormInput
            label="Downtime Hours"
            value={downtimeHours}
            onChangeText={setDowntimeHours}
            placeholder="0"
            keyboardType="numeric"
          />

          <FormInput
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
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
            : <Text style={styles.submitText}>{isOnline ? 'Save Record' : 'Save Offline'}</Text>}
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

  totalChip: {
    backgroundColor: Colors.navyBg ?? '#EEF2FF', borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start',
  },
  totalText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.navy },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
