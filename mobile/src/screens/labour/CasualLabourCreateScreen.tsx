import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, format } from 'date-fns';
import { AppHeader }        from '../../components/AppHeader';
import { OfflineBanner }    from '../../components/OfflineBanner';
import { FormInput }        from '../../components/FormInput';
import { DatePickerField }  from '../../components/DatePickerField';
import { useCasualLabourCreate } from '../../hooks/useCasualLabour';
import { useOfflineStore }  from '../../stores/offlineStore';
import { EP }               from '../../api/endpoints';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'CasualLabourCreate'>;

const today = format(new Date(), 'yyyy-MM-dd');

export function CasualLabourCreateScreen() {
  const navigation  = useNavigation<NavProp>();
  const { createRequest } = useCasualLabourCreate();
  const isOnline    = useOfflineStore((s) => s.isOnline);
  const enqueue     = useOfflineStore((s) => s.enqueue);

  const [startDate,   setStartDate]   = useState(today);
  const [endDate,     setEndDate]     = useState(today);
  const [task,        setTask]        = useState('');
  const [numCasuals,  setNumCasuals]  = useState('');
  const [description, setDescription] = useState('');
  const [comments,    setComments]    = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate)   e.endDate   = 'End date is required';
    if (endDate && startDate && endDate < startDate) e.endDate = 'End date must be on or after start date';
    if (!task.trim())         e.task        = 'Task description is required';
    const n = Number(numCasuals);
    if (!numCasuals.trim() || isNaN(n) || n <= 0) e.numCasuals = 'Enter a number greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        start_date:  startDate,
        end_date:    endDate,
        task:        task.trim(),
        num_casuals: Number(numCasuals),
        description: description.trim() || undefined,
        comments:    comments.trim() || undefined,
      };

      if (!isOnline) {
        await enqueue({
          endpoint: EP.LABOUR_CREATE,
          method:   'POST',
          body:     payload as Record<string, unknown>,
          context:  'casual-labour',
        });
        Alert.alert(
          'Saved Offline',
          'Your request has been saved and will be submitted automatically when you reconnect.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }

      await createRequest(payload);
      navigation.goBack();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Could not submit request. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="New Labour Request" dark onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                Offline — request will be queued and synced when connected.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Request Details</Text>

            <DatePickerField
              label="Start Date"
              value={startDate}
              onChange={(d) => { setStartDate(d); setErrors((e) => ({ ...e, startDate: '' })); }}
              required
              error={errors.startDate}
            />

            <DatePickerField
              label="End Date"
              value={endDate}
              onChange={(d) => { setEndDate(d); setErrors((e) => ({ ...e, endDate: '' })); }}
              minDate={startDate ? addDays(new Date(startDate), 0) : undefined}
              required
              error={errors.endDate}
            />

            <FormInput
              label="Task Description"
              value={task}
              onChangeText={(v) => { setTask(v); setErrors((e) => ({ ...e, task: '' })); }}
              placeholder="e.g. Tree felling, Log transport"
              required
              error={errors.task}
            />

            <FormInput
              label="Number of Casuals"
              value={numCasuals}
              onChangeText={(v) => { setNumCasuals(v); setErrors((e) => ({ ...e, numCasuals: '' })); }}
              keyboardType="numeric"
              placeholder="0"
              required
              error={errors.numCasuals}
            />

            <FormInput
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details about the work"
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />

            <FormInput
              label="Comments (optional)"
              value={comments}
              onChangeText={setComments}
              placeholder="Any special notes"
              multiline
              numberOfLines={2}
              style={styles.multilineShort}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : (
                <Text style={styles.submitBtnText}>
                  {isOnline ? 'Submit Request' : 'Save Offline'}
                </Text>
              )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  flex:   { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  offlineBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  offlineBannerText: {
    fontSize: Typography.sm,
    color: Colors.warning,
    fontWeight: Typography.medium,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  multiline: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  multilineShort: {
    height: 60,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },

  submitBtn: {
    height: Layout.buttonHeight,
    backgroundColor: Colors.green,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
