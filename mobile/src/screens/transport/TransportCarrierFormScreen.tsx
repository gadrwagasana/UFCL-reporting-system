import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FormInput } from '../../components/FormInput';
import { useTransportCompanyCreate, useTransportCompanyUpdate } from '../../hooks/useTransport';
import { TransportCarriersStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../../theme';

// Phase 1 Logistics fix — shared create/edit form for Transport Carriers,
// matching desktop's Add/Edit Carrier overlay capability.
type Props = TransportCarriersStackScreenProps<'TransportCarrierForm'>;

export function TransportCarrierFormScreen({ navigation, route }: Props) {
  const editing = route.params?.company;
  const createMutation = useTransportCompanyCreate();
  const updateMutation = useTransportCompanyUpdate();

  const [name, setName] = useState(editing?.name ?? '');
  const [contactPerson, setContactPerson] = useState(editing?.contact_person ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [ratePerKm, setRatePerKm] = useState(editing?.rate_per_km != null ? String(editing.rate_per_km) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [active, setActive] = useState(editing?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) { setError('Company name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        rate_per_km: ratePerKm ? Number(ratePerKm) : undefined,
        notes: notes.trim() || undefined,
        active,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', `Could not ${editing ? 'update' : 'create'} carrier. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={editing ? 'Edit Carrier' : 'New Carrier'} dark onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <FormInput label="Company Name" value={name} onChangeText={(v) => { setName(v); setError(''); }} required error={error} />
            <FormInput label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Optional" />
            <FormInput label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
            <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
            <FormInput label="Rate per KM" value={ratePerKm} onChangeText={setRatePerKm} placeholder="Optional" keyboardType="numeric" />
            <FormInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline numberOfLines={3} style={s.multiline} />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Active</Text>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.navy }} />
            </View>
          </View>

          <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
            {submitting ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.submitBtnText}>{editing ? 'Save Changes' : 'Add Carrier'}</Text>}
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
  multiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  submitBtn: { height: Layout.buttonHeight, backgroundColor: Colors.navy, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
