import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useProcurementSupplierActions } from '../../hooks/useProcurementSuppliers';
import { ProcurementStackParamList } from '../../navigation/types';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'SupplierForm'>;
type RouteType = RouteProp<ProcurementStackParamList, 'SupplierForm'>;

function Field({ label, value, onChangeText, ...rest }: { label: string; value: string; onChangeText: (v: string) => void; [k: string]: any }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholderTextColor={Colors.textMuted} {...rest} />
    </View>
  );
}

export function SupplierFormScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const existing = params?.supplier;
  const { create, update } = useProcurementSupplierActions();

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [taxNumber, setTaxNumber] = useState(existing?.tax_number ?? '');
  const [bankName, setBankName] = useState(existing?.bank_name ?? '');
  const [bankAccount, setBankAccount] = useState(existing?.bank_account ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [preferred, setPreferred] = useState(existing?.preferred ?? false);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!name.trim()) return Alert.alert('Supplier name is required');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), category: category.trim() || undefined, tax_number: taxNumber.trim() || undefined,
        bank_name: bankName.trim() || undefined, bank_account: bankAccount.trim() || undefined,
        phone: phone.trim() || undefined, email: email.trim() || undefined, address: address.trim() || undefined,
        notes: notes.trim() || undefined, preferred,
      };
      if (existing) await update(existing.id, payload);
      else await create(payload);
      showToast(existing ? 'Supplier updated.' : 'Supplier registered.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save supplier', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={existing ? 'Edit Supplier' : 'New Supplier'} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Field label="Name *" value={name} onChangeText={setName} placeholder="Supplier name" />
        <Field label="Category" value={category} onChangeText={setCategory} placeholder="e.g. Hardware, Fuel, Services" />
        <Field label="Tax Number" value={taxNumber} onChangeText={setTaxNumber} placeholder="TIN" />
        <Field label="Bank Name" value={bankName} onChangeText={setBankName} />
        <Field label="Bank Account" value={bankAccount} onChangeText={setBankAccount} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Address" value={address} onChangeText={setAddress} multiline />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Preferred supplier</Text>
            <Text style={styles.toggleHint}>Flags this supplier as preferred across quote comparisons and reports.</Text>
          </View>
          <Switch
            value={preferred}
            onValueChange={setPreferred}
            trackColor={{ false: Colors.border, true: Colors.navy }}
            thumbColor={Colors.white}
          />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Supplier'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  field: { marginBottom: Spacing.sm },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, marginBottom: Spacing.sm, gap: Spacing.sm },
  toggleLabel: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  toggleHint: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
