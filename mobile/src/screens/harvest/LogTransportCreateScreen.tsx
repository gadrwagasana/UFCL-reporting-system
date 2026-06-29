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
import { FormSelect }      from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { useLogTransportCreate } from '../../hooks/useLogTransport';
import { useCompartments }       from '../../hooks/useHarvest';
import { useOfflineStore }        from '../../stores/offlineStore';
import { EP }                     from '../../api/endpoints';
import { LogTransportStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<LogTransportStackParamList, 'LogTransportCreate'>;

export function LogTransportCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { createEntry }       = useLogTransportCreate();
  const { data: comptData }   = useCompartments();
  const { isOnline, enqueue } = useOfflineStore();

  const [transportDate, setTransportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [qty,           setQty]           = useState('');
  const [tractorPlate,  setTractorPlate]  = useState('');
  const [loggersNumber, setLoggersNumber] = useState('');
  const [comptId,       setComptId]       = useState('');
  const [subName,       setSubName]       = useState('');
  const [notes,         setNotes]         = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  const compartmentOptions = (comptData?.rows ?? []).map((c) => ({
    label: c.compt_name + (c.sub_name ? ` (${c.sub_name})` : '') + (c.species ? ` — ${c.species}` : ''),
    value: String(c.id),
  }));

  async function handleSubmit() {
    const qtyNum = Number(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Required', 'Quantity must be a positive number.'); return;
    }

    const payload = {
      transport_date:  transportDate,
      qty_transported: qtyNum,
      ...(tractorPlate.trim()  && { tractor_plate:  tractorPlate.trim() }),
      ...(loggersNumber.trim() && { loggers_number: loggersNumber.trim() }),
      ...(comptId              && { compt_id: Number(comptId) }),
      ...(subName              && { sub_name: subName }),
      ...(notes.trim()         && { notes: notes.trim() }),
    };

    setSubmitting(true);
    try {
      if (!isOnline) {
        enqueue({ endpoint: EP.LOG_TRANSPORT_CREATE, method: 'POST', body: payload, context: 'log-transport' });
        Alert.alert('Saved Offline', 'Transport record will sync when connected.');
        navigation.goBack();
        return;
      }
      await createEntry(payload);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save transport record.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Log Transport" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transport Details</Text>

          <DatePickerField
            label="Transport Date"
            value={transportDate}
            onChange={setTransportDate}
            maxDate={new Date()}
          />

          <FormInput
            label="Quantity (logs)"
            value={qty}
            onChangeText={setQty}
            placeholder="0"
            keyboardType="numeric"
            required
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle & Driver</Text>

          <FormInput
            label="Vehicle / Tractor Plate"
            value={tractorPlate}
            onChangeText={setTractorPlate}
            placeholder="e.g. RAB 123A"
            autoCapitalize="characters"
          />

          <FormInput
            label="Logger Machine / Number"
            value={loggersNumber}
            onChangeText={setLoggersNumber}
            placeholder="Optional"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Source Compartment (optional)</Text>

          <FormSelect
            label="Compartment"
            value={comptId}
            onChange={(v) => {
              const id = String(v);
              setComptId(id);
              const found = (comptData?.rows ?? []).find((c) => String(c.id) === id);
              setSubName(found?.sub_name ?? '');
            }}
            options={[{ label: '— None —', value: '' }, ...compartmentOptions]}
            placeholder="Select compartment"
          />
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

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
