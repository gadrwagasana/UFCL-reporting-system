import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, format } from 'date-fns';
import { AppHeader }        from '../../components/AppHeader';
import { OfflineBanner }    from '../../components/OfflineBanner';
import { FormInput }        from '../../components/FormInput';
import { DatePickerField }  from '../../components/DatePickerField';
import { Button }           from '../../components/Button';
import { useCasualLabourCreate } from '../../hooks/useCasualLabour';
import { useOfflineStore }  from '../../stores/offlineStore';
import { EP }               from '../../api/endpoints';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'CasualLabourCreate'>;

interface LabourRow { role: string; quantity: string }

const today = format(new Date(), 'yyyy-MM-dd');

export function CasualLabourCreateScreen() {
  const navigation  = useNavigation<NavProp>();
  const { createRequest } = useCasualLabourCreate();
  const isOnline    = useOfflineStore((s) => s.isOnline);
  const enqueue     = useOfflineStore((s) => s.enqueue);

  const [startDate,    setStartDate]    = useState(today);
  const [endDate,      setEndDate]      = useState(today);
  const [task,         setTask]         = useState('');
  const [labourItems,  setLabourItems]  = useState<LabourRow[]>([{ role: '', quantity: '' }]);
  const [description,  setDescription]  = useState('');
  const [comments,     setComments]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  const numCasuals = labourItems.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  function addRow() {
    setLabourItems((prev) => [...prev, { role: '', quantity: '' }]);
  }

  function removeRow(idx: number) {
    if (labourItems.length === 1) return;
    setLabourItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, field: keyof LabourRow, value: string) {
    setLabourItems((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate)   e.endDate   = 'End date is required';
    if (endDate && startDate && endDate < startDate) e.endDate = 'End date must be on or after start date';
    if (!task.trim()) e.task = 'Task description is required';

    const validRows = labourItems.filter(
      (r) => r.role.trim() && Number(r.quantity) > 0,
    );
    if (validRows.length === 0) {
      e.labourItems = 'Add at least one role with a quantity greater than 0';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const validItems = labourItems
        .filter((r) => r.role.trim() && Number(r.quantity) > 0)
        .map((r) => ({ role: r.role.trim(), quantity: Number(r.quantity) }));

      const payload = {
        start_date:   startDate,
        end_date:     endDate,
        task:         task.trim(),
        num_casuals:  numCasuals,
        labour_items: validItems,
        description:  description.trim() || undefined,
        comments:     comments.trim() || undefined,
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
          </View>

          <View style={styles.card}>
            <View style={styles.breakdownHeader}>
              <Text style={styles.sectionTitle}>Labour Breakdown</Text>
              {numCasuals > 0 && (
                <Text style={styles.totalBadge}>Total: {numCasuals}</Text>
              )}
            </View>

            {errors.labourItems ? (
              <Text style={styles.rowError}>{errors.labourItems}</Text>
            ) : null}

            {labourItems.map((row, idx) => (
              <View key={idx} style={styles.labourRow}>
                <View style={styles.labourRoleCol}>
                  <FormInput
                    label={idx === 0 ? 'Role' : ''}
                    value={row.role}
                    onChangeText={(v) => {
                      updateRow(idx, 'role', v);
                      setErrors((e) => ({ ...e, labourItems: '' }));
                    }}
                    placeholder="e.g. Feller, Driver"
                  />
                </View>
                <View style={styles.labourQtyCol}>
                  <FormInput
                    label={idx === 0 ? 'Qty' : ''}
                    value={row.quantity}
                    onChangeText={(v) => {
                      updateRow(idx, 'quantity', v);
                      setErrors((e) => ({ ...e, labourItems: '' }));
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.removeBtn, idx === 0 && styles.removeBtnTop]}
                  onPress={() => removeRow(idx)}
                  disabled={labourItems.length === 1}
                >
                  <Ionicons
                    name="remove-circle"
                    size={22}
                    color={labourItems.length === 1 ? Colors.textMuted : Colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.navy} />
              <Text style={styles.addRowText}>Add Role</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Additional Details</Text>

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

          <Button
            label={isOnline ? 'Submit Request' : 'Save Offline'}
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
          />
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

  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalBadge: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.navy,
    backgroundColor: Colors.navy + '18',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  rowError: {
    fontSize: Typography.xs,
    color: Colors.error,
  },

  labourRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  labourRoleCol: { flex: 3 },
  labourQtyCol:  { flex: 1 },
  removeBtn:     { paddingBottom: Spacing.sm, paddingLeft: Spacing.xs },
  removeBtnTop:  { paddingBottom: Spacing.lg },

  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  addRowText: {
    fontSize: Typography.sm,
    color: Colors.navy,
    fontWeight: Typography.medium,
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
});
