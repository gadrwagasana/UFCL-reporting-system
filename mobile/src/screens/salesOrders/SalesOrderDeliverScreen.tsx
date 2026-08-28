import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader }      from '../../components/AppHeader';
import { FormSelect }     from '../../components/FormSelect';
import { useSalesOrderDeliver, useSalesOrdersList } from '../../hooks/useSalesOrders';
import type { SalesOrdersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type Props = NativeStackScreenProps<SalesOrdersStackParamList, 'SalesOrderDeliver'>;

export function SalesOrderDeliverScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const route      = useRoute<Props['route']>();
  const { orderId, orderNumber, customerName } = route.params;

  const { data } = useSalesOrdersList();
  const vehicles = data?.dropdowns?.vehicles ?? [];
  const order = data?.rows?.find((o) => o.id === orderId);
  const deliverMutation = useSalesOrderDeliver();

  const [vehicleId,     setVehicleId]     = useState('');
  const [driverName,    setDriverName]    = useState('');
  const [deliveryDate,  setDeliveryDate]  = useState('');
  const [routeNote,     setRouteNote]     = useState('');
  const [notes,         setNotes]         = useState('');
  // Phase 1 Logistics fix — this field didn't exist at all, so a delivery
  // created from mobile never carried a qty_dispatched, which meant the
  // linked Sales Order's dispatched-quantity/status was silently never
  // updated by this flow (desktop's create form always collects this).
  const [qtyDispatched, setQtyDispatched] = useState('');

  const vehicleOptions = vehicles.map(v => ({
    label: `${v.registration} — ${v.make}${v.driver_assigned ? ` · ${v.driver_assigned}` : ''}`,
    value: String(v.id),
  }));

  const handleVehicleChange = (val: string | number) => {
    const sid = String(val);
    setVehicleId(sid);
    const chosen = vehicles.find(v => String(v.id) === sid);
    if (chosen?.driver_assigned) setDriverName(chosen.driver_assigned);
  };

  const qtyDispatchedNum = Number(qtyDispatched);
  const canSubmit = driverName.trim() && qtyDispatched.trim() && qtyDispatchedNum > 0 && !deliverMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await deliverMutation.mutateAsync({
        id:           orderId,
        driver_name:  driverName.trim(),
        vehicle_id:   vehicleId ? Number(vehicleId) : undefined,
        delivery_date: deliveryDate.trim() || undefined,
        route:        routeNote.trim() || undefined,
        notes:        notes.trim() || undefined,
        qty_dispatched: qtyDispatchedNum,
      });
      Alert.alert('Success', 'Delivery dispatched.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Error', 'Failed to record delivery. Please try again.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Record Delivery"
        subtitle={`${orderNumber} · ${customerName}`}
        onBack={() => navigation.goBack()}
        dark
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Vehicle */}
          <View style={s.field}>
            <FormSelect
              label="Vehicle (optional)"
              options={vehicleOptions}
              value={vehicleId}
              placeholder="Select vehicle…"
              onChange={handleVehicleChange}
            />
          </View>

          {/* Quantity dispatched */}
          <View style={s.field}>
            <Text style={s.label}>
              Quantity Dispatched <Text style={s.req}>*</Text>
              {order?.qty_remaining != null ? <Text style={s.opt}> ({order.qty_remaining} remaining)</Text> : null}
            </Text>
            <TextInput
              style={s.input}
              value={qtyDispatched}
              onChangeText={setQtyDispatched}
              placeholder="e.g. 20"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          {/* Driver */}
          <View style={s.field}>
            <Text style={s.label}>Driver Name <Text style={s.req}>*</Text></Text>
            <TextInput
              style={s.input}
              value={driverName}
              onChangeText={setDriverName}
              placeholder="Auto-filled from vehicle or enter name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Delivery date */}
          <View style={s.field}>
            <Text style={s.label}>Delivery Date <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={deliveryDate}
              onChangeText={setDeliveryDate}
              placeholder="YYYY-MM-DD  (defaults to today)"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Route */}
          <View style={s.field}>
            <Text style={s.label}>Route / Destination <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={routeNote}
              onChangeText={setRouteNote}
              placeholder="e.g. Kigali → Musanze"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.label}>Notes <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional delivery instructions…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {deliverMutation.isPending
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitText}>Dispatch Delivery</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  field: { gap: 6 },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  req:   { color: Colors.error },
  opt:   { fontWeight: '400', color: Colors.textMuted },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.card,
  },
  textArea: { minHeight: 72 },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm,
  },
  submitText:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled: { opacity: 0.4 },
});
