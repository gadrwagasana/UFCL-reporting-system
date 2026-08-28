import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormInput } from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { DatePickerField } from '../../components/DatePickerField';
import {
  useTransportJobsList, useTransportJobCreate, useTransportJobUpdate, useTransportJobStatusUpdate,
} from '../../hooks/useTransport';
import { TransportJobsStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../../theme';

// Phase 1 Logistics fix — shared create/edit form for Transport Jobs, matching
// desktop's Log Job / Edit Job overlay (carrier-type toggle, company/vehicle,
// linked sales order, quantity/cost, and — when editing — a status control).
type Props = TransportJobsStackScreenProps<'TransportJobForm'>;

const STATUS_OPTIONS = ['Scheduled', 'In Transit', 'Completed', 'Cancelled'].map((v) => ({ label: v, value: v }));

export function TransportJobFormScreen({ navigation, route }: Props) {
  const editing = route.params?.job;
  const { data } = useTransportJobsList();
  const companies = data?.companies ?? [];
  const vehicles = data?.vehicles ?? [];
  const salesOrders = data?.salesOrders ?? [];

  const createMutation = useTransportJobCreate();
  const updateMutation = useTransportJobUpdate();
  const statusMutation = useTransportJobStatusUpdate();

  const [carrierType, setCarrierType] = useState<'Third-party' | 'Own Vehicle'>(editing?.carrier_type ?? 'Third-party');
  const [companyId, setCompanyId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [salesOrderId, setSalesOrderId] = useState('');
  const [jobType, setJobType] = useState(editing?.job_type ?? 'Delivery');
  const [origin, setOrigin] = useState(editing?.origin ?? '');
  const [destination, setDestination] = useState(editing?.destination ?? '');
  const [jobDate, setJobDate] = useState<string | null>(editing?.job_date ?? null);
  const [quantity, setQuantity] = useState(editing?.quantity != null ? String(editing.quantity) : '');
  const [uom, setUom] = useState(editing?.uom ?? '');
  const [cost, setCost] = useState(editing?.cost != null ? String(editing.cost) : '');
  const [waybillRef, setWaybillRef] = useState(editing?.waybill_ref ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [status, setStatus] = useState(editing?.status ?? 'Scheduled');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const companyOptions = useMemo(() => [{ label: '— Select —', value: '' }, ...companies.map((c) => ({ label: c.name, value: String(c.id) }))], [companies]);
  const vehicleOptions = useMemo(() => [{ label: '— Select —', value: '' }, ...vehicles.map((v) => ({ label: `${v.registration}${v.make ? ` (${v.make})` : ''}`, value: String(v.id) }))], [vehicles]);
  const soOptions = useMemo(() => [{ label: '— None —', value: '' }, ...salesOrders.map((so) => ({ label: `${so.order_number} — ${so.customer_name}`, value: String(so.id) }))], [salesOrders]);

  async function handleSubmit() {
    if (!jobDate) { setError('Job date is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        carrier_type: carrierType,
        transport_company_id: carrierType === 'Third-party' && companyId ? Number(companyId) : undefined,
        vehicle_id: carrierType === 'Own Vehicle' && vehicleId ? Number(vehicleId) : undefined,
        sales_order_id: salesOrderId ? Number(salesOrderId) : undefined,
        job_type: jobType.trim() || 'Delivery',
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        job_date: jobDate,
        quantity: quantity ? Number(quantity) : undefined,
        uom: uom.trim() || undefined,
        cost: cost ? Number(cost) : undefined,
        waybill_ref: waybillRef.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (editing) {
        const res = await updateMutation.mutateAsync({ id: editing.id, ...payload });
        if ((res as any).pendingApproval) {
          Alert.alert('Submitted for approval', (res as any).message ?? 'This action requires manager approval.');
          navigation.goBack();
          return;
        }
        if (editing.status !== status) {
          await statusMutation.mutateAsync({ id: editing.id, status });
        }
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', `Could not ${editing ? 'update' : 'create'} transport job. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={editing ? 'Edit Transport Job' : 'Log Transport Job'} dark onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <Text style={s.sectionTitle}>Carrier</Text>
            <View style={s.toggleRow}>
              <TouchableOpacity
                style={[s.toggleBtn, carrierType === 'Third-party' && s.toggleBtnActive]}
                onPress={() => setCarrierType('Third-party')}
              >
                <Text style={[s.toggleText, carrierType === 'Third-party' && s.toggleTextActive]}>Third-party</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, carrierType === 'Own Vehicle' && s.toggleBtnActive]}
                onPress={() => setCarrierType('Own Vehicle')}
              >
                <Text style={[s.toggleText, carrierType === 'Own Vehicle' && s.toggleTextActive]}>Own Vehicle</Text>
              </TouchableOpacity>
            </View>
            {carrierType === 'Third-party' ? (
              <FormSelect label="Transport Company" value={companyId} options={companyOptions} onChange={(v) => setCompanyId(String(v))} placeholder="Select company" />
            ) : (
              <FormSelect label="Vehicle" value={vehicleId} options={vehicleOptions} onChange={(v) => setVehicleId(String(v))} placeholder="Select vehicle" />
            )}
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Job Details</Text>
            <FormSelect label="Linked Sales Order (optional)" value={salesOrderId} options={soOptions} onChange={(v) => setSalesOrderId(String(v))} placeholder="Select sales order" />
            <FormInput label="Job Type" value={jobType} onChangeText={setJobType} placeholder="e.g. Delivery" />
            <FormInput label="Origin" value={origin} onChangeText={setOrigin} placeholder="Optional" />
            <FormInput label="Destination" value={destination} onChangeText={setDestination} placeholder="Optional" />
            <DatePickerField label="Job Date" value={jobDate} onChange={(v) => { setJobDate(v); setError(''); }} />
            {error ? <Text style={s.errorText}>{error}</Text> : null}
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Quantity & Cost</Text>
            <FormInput label="Quantity" value={quantity} onChangeText={setQuantity} placeholder="Optional" keyboardType="numeric" />
            <FormInput label="Unit" value={uom} onChangeText={setUom} placeholder="e.g. m³, pcs" />
            <FormInput label="Cost" value={cost} onChangeText={setCost} placeholder="Optional" keyboardType="numeric" />
            <FormInput label="Waybill Reference" value={waybillRef} onChangeText={setWaybillRef} placeholder="Optional" />
            <FormInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline numberOfLines={3} style={s.multiline} />
          </View>

          {editing ? (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Status</Text>
              <FormSelect label="Job Status" value={status} options={STATUS_OPTIONS} onChange={(v) => setStatus(String(v) as typeof status)} />
            </View>
          ) : null}

          <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
            {submitting ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.submitBtnText}>{editing ? 'Save Changes' : 'Log Job'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.base, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  multiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  errorText: { fontSize: Typography.xs, color: Colors.error },

  toggleRow: { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  toggleBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  toggleText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textMuted },
  toggleTextActive: { color: Colors.white },

  submitBtn: { height: Layout.buttonHeight, backgroundColor: Colors.navy, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
