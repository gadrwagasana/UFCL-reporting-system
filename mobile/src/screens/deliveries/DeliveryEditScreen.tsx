import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { AppHeader }      from '../../components/AppHeader';
import { OfflineBanner }  from '../../components/OfflineBanner';
import { FormInput }      from '../../components/FormInput';
import { FormSelect }     from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import { useDeliveryUpdate, useDeliveryList } from '../../hooks/useDeliveries';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../../theme';

type Props = DeliveryStackScreenProps<'DeliveryEdit'>;

function parseDDMMYYYY(s: string | undefined): string | null {
  if (!s) return null;
  const p = s.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : null;
}

export function DeliveryEditScreen({ route, navigation }: Props) {
  const { order } = route.params;
  const { data: deliveryData } = useDeliveryList();
  const updateMutation = useDeliveryUpdate();

  const vehicles = deliveryData?.vehicles ?? [];

  const initialVehicle = useMemo(
    () => vehicles.find(v => v.registration === order.vehicle_registration),
    [vehicles, order.vehicle_registration],
  );

  const [driverName,    setDriverName]    = useState(order.driver_name ?? '');
  const [vehicleId,     setVehicleId]     = useState(initialVehicle ? String(initialVehicle.id) : '');
  const [qtyDispatched, setQtyDispatched] = useState(order.qty_dispatched != null ? String(order.qty_dispatched) : '');
  const [deliveryDate,  setDeliveryDate]  = useState<string | null>(parseDDMMYYYY(order.delivery_date));
  const [routeVal,      setRouteVal]      = useState(order.route ?? '');
  const [notes,         setNotes]         = useState(order.notes ?? '');
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const vehicleOptions = useMemo(() => [
    { label: '— None —', value: '' },
    ...vehicles.map(v => ({
      label: v.registration + (v.make ? ` (${v.make}${v.model ? ' ' + v.model : ''})` : ''),
      value: String(v.id),
    })),
  ], [vehicles]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!driverName.trim()) e.driverName = 'Driver name is required';
    if (qtyDispatched && (isNaN(Number(qtyDispatched)) || Number(qtyDispatched) <= 0))
      e.qtyDispatched = 'Quantity must be a positive number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      const res = await updateMutation.mutateAsync({
        id:             order.id,
        driver_name:    driverName.trim(),
        vehicle_id:     vehicleId ? Number(vehicleId) : null,
        delivery_date:  deliveryDate || null,
        route:          routeVal.trim()  || undefined,
        notes:          notes.trim()     || undefined,
        qty_dispatched: qtyDispatched ? Number(qtyDispatched) : null,
      });
      if ((res as any).pendingApproval) {
        Alert.alert('Submitted', 'Change submitted for manager approval.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'Could not update delivery order. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Edit Delivery Order" subtitle={order.order_number} dark onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Driver & Vehicle</Text>

            <FormInput
              label="Driver Name"
              value={driverName}
              onChangeText={v => { setDriverName(v); setErrors(e => ({ ...e, driverName: '' })); }}
              placeholder="Full name of the driver"
              required
              error={errors.driverName}
            />

            <FormSelect
              label="Vehicle (optional)"
              value={vehicleId}
              options={vehicleOptions}
              onChange={v => setVehicleId(String(v))}
              placeholder="Select vehicle"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>

            <FormInput
              label="Qty Dispatched (this trip)"
              value={qtyDispatched}
              onChangeText={v => { setQtyDispatched(v); setErrors(e => ({ ...e, qtyDispatched: '' })); }}
              keyboardType="numeric"
              placeholder="Optional"
              error={errors.qtyDispatched}
            />

            <DatePickerField
              label="Delivery Date (optional)"
              value={deliveryDate}
              onChange={setDeliveryDate}
            />

            <FormInput
              label="Route"
              value={routeVal}
              onChangeText={setRouteVal}
              placeholder="Origin → Destination"
            />

            <FormInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional instructions"
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, updateMutation.isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={updateMutation.isPending}
            activeOpacity={0.8}
          >
            {updateMutation.isPending
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.submitBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.bg },
  flex:  { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.base, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  multiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },

  submitBtn: {
    height: Layout.buttonHeight, backgroundColor: Colors.navy,
    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
