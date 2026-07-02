import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { FormSelect }   from '../../components/FormSelect';
import { useDispatchList, useDispatchCreate } from '../../hooks/useDispatch';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

export function DispatchFormScreen() {
  const navigation = useNavigation();

  const { data, isLoading } = useDispatchList();
  const createMutation = useDispatchCreate();

  const [deliveryOrderId, setDeliveryOrderId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingDeliveries = data?.pendingDeliveries ?? [];
  const doOptions = pendingDeliveries.map(d => ({
    value: String(d.id),
    label: [
      d.order_number,
      d.customer_name || d.driver_name || '',
      d.so_order_number ? `(${d.so_order_number})` : '',
    ].filter(Boolean).join(' — '),
  }));

  const canSubmit = deliveryOrderId !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createMutation.mutateAsync({
        delivery_order_id: Number(deliveryOrderId),
        notes: notes.trim() || undefined,
      });
      if (!(result as any).ok) {
        Alert.alert('Error', (result as any).error ?? 'Failed to create dispatch request');
        return;
      }
      Alert.alert('Submitted', 'Dispatch request submitted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar style="light" />
        <AppHeader title="New Dispatch Request" onBack={() => navigation.goBack()} dark />
        <View style={s.center}>
          <ActivityIndicator color={Colors.navy} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="New Dispatch Request" onBack={() => navigation.goBack()} dark />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.hint}>
            Requests must be approved by a manager before the vehicle leaves the yard.
          </Text>

          {pendingDeliveries.length === 0 ? (
            <View style={s.noDeliveries}>
              <Text style={s.noDeliveriesText}>
                No assigned delivery orders available. A delivery order must have status "Assigned" before a dispatch request can be raised.
              </Text>
            </View>
          ) : (
            <FormSelect
              label="Delivery Order"
              required
              options={doOptions}
              value={deliveryOrderId}
              onChange={v => setDeliveryOrderId(String(v))}
              placeholder="Select a delivery order…"
            />
          )}

          <View style={s.field}>
            <Text style={s.label}>Notes <Text style={s.optional}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Reason or instructions…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && s.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={s.submitText}>Submit Request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, gap: Spacing.base,
  },
  hint: {
    fontSize: Typography.xs, color: Colors.textSecondary,
    backgroundColor: Colors.navyBg, borderRadius: Radius.sm,
    padding: Spacing.sm,
  },

  noDeliveries: {
    backgroundColor: Colors.warningBg, borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  noDeliveriesText: { fontSize: Typography.sm, color: Colors.warning },

  field: { gap: 6 },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  optional: { fontWeight: '400', color: Colors.textMuted },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg, minHeight: 80,
  },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
