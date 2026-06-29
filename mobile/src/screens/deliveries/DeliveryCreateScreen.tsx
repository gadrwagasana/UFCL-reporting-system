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
import { useDeliveryCreate, useDeliveryList } from '../../hooks/useDeliveries';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../../theme';

type Props = DeliveryStackScreenProps<'DeliveryCreate'>;

export function DeliveryCreateScreen({ navigation }: Props) {
  const { createDelivery }          = useDeliveryCreate();
  const { data: deliveryData }      = useDeliveryList();

  const vehicles    = deliveryData?.vehicles    ?? [];
  const salesOrders = deliveryData?.salesOrders ?? [];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [driverName,     setDriverName]     = useState('');
  const [vehicleId,      setVehicleId]      = useState('');
  const [salesOrderId,   setSalesOrderId]   = useState('');
  const [qtyDispatched,  setQtyDispatched]  = useState('');
  const [deliveryDate,   setDeliveryDate]   = useState<string | null>(null);
  const [route,          setRoute]          = useState('');
  const [notes,          setNotes]          = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  // ── Dropdown options ─────────────────────────────────────────────────────────
  const vehicleOptions = useMemo(() => [
    { label: '— None —', value: '' },
    ...vehicles.map((v) => ({
      label: v.registration + (v.make ? ` (${v.make}${v.model ? ' ' + v.model : ''})` : ''),
      value: String(v.id),
    })),
  ], [vehicles]);

  const soOptions = useMemo(() => [
    { label: '— None —', value: '' },
    ...salesOrders.map((so) => ({
      label: `${so.order_number} — ${so.customer_name} (${so.qty_remaining} remaining)`,
      value: String(so.id),
    })),
  ], [salesOrders]);

  // ── Selected SO metadata (for qty hint) ──────────────────────────────────────
  const selectedSO = useMemo(
    () => salesOrders.find((so) => String(so.id) === salesOrderId) ?? null,
    [salesOrders, salesOrderId],
  );

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!driverName.trim()) {
      e.driverName = 'Driver name is required';
    }
    if (qtyDispatched && (isNaN(Number(qtyDispatched)) || Number(qtyDispatched) <= 0)) {
      e.qtyDispatched = 'Quantity must be a positive number';
    }
    if (selectedSO && qtyDispatched && Number(qtyDispatched) > selectedSO.qty_remaining) {
      e.qtyDispatched = `Cannot dispatch more than the remaining qty (${selectedSO.qty_remaining})`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createDelivery({
        driver_name:     driverName.trim(),
        vehicle_id:      vehicleId    ? Number(vehicleId)    : undefined,
        sales_order_id:  salesOrderId ? Number(salesOrderId) : undefined,
        qty_dispatched:  qtyDispatched ? Number(qtyDispatched) : undefined,
        delivery_date:   deliveryDate  || undefined,
        route:           route.trim()  || undefined,
        notes:           notes.trim()  || undefined,
      });
      navigation.goBack();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Could not create delivery order. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="New Delivery Order" dark onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Driver & Vehicle ──────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Driver & Vehicle</Text>

            <FormInput
              label="Driver Name"
              value={driverName}
              onChangeText={(v) => { setDriverName(v); setErrors((e) => ({ ...e, driverName: '' })); }}
              placeholder="Full name of the driver"
              required
              error={errors.driverName}
            />

            <FormSelect
              label="Vehicle (optional)"
              value={vehicleId}
              options={vehicleOptions}
              onChange={(v) => setVehicleId(String(v))}
              placeholder="Select vehicle"
            />
          </View>

          {/* ── Sales Order Link ──────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sales Order (optional)</Text>

            <FormSelect
              label="Linked Sales Order"
              value={salesOrderId}
              options={soOptions}
              onChange={(v) => {
                setSalesOrderId(String(v));
                setQtyDispatched('');
                setErrors((e) => ({ ...e, qtyDispatched: '' }));
              }}
              placeholder="Select sales order"
            />

            {selectedSO && (
              <View style={styles.soInfoCard}>
                <View style={styles.soRow}>
                  <Text style={styles.soLabel}>Customer</Text>
                  <Text style={styles.soValue}>{selectedSO.customer_name}</Text>
                </View>
                <View style={styles.soRow}>
                  <Text style={styles.soLabel}>Total Qty</Text>
                  <Text style={styles.soValue}>{selectedSO.quantity}</Text>
                </View>
                <View style={styles.soRow}>
                  <Text style={styles.soLabel}>Remaining</Text>
                  <Text style={[styles.soValue, styles.soRemaining]}>{selectedSO.qty_remaining}</Text>
                </View>
              </View>
            )}

            <FormInput
              label="Qty Dispatched (this trip)"
              value={qtyDispatched}
              onChangeText={(v) => { setQtyDispatched(v); setErrors((e) => ({ ...e, qtyDispatched: '' })); }}
              keyboardType="numeric"
              placeholder="Optional"
              hint={selectedSO ? `Max: ${selectedSO.qty_remaining} remaining on this order` : undefined}
              error={errors.qtyDispatched}
            />
          </View>

          {/* ── Delivery Details ──────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>

            <DatePickerField
              label="Delivery Date (optional)"
              value={deliveryDate}
              onChange={setDeliveryDate}
            />

            <FormInput
              label="Route"
              value={route}
              onChangeText={setRoute}
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

          {/* ── Status note ───────────────────────────────────────────────── */}
          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
              Order number is auto-generated. Initial status is set to{' '}
              <Text style={styles.infoNoteBold}>Pending</Text>.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.submitBtnText}>Create Delivery Order</Text>
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

  soInfoCard: {
    backgroundColor: Colors.navyBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  soRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soLabel:     { fontSize: Typography.sm, color: Colors.textMuted },
  soValue:     { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  soRemaining: { color: Colors.navy, fontWeight: Typography.semibold },

  multiline: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },

  infoNote: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoNoteText: { fontSize: Typography.sm, color: Colors.info },
  infoNoteBold: { fontWeight: Typography.semibold },

  submitBtn: {
    height: Layout.buttonHeight,
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
