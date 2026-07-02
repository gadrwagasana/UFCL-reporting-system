import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { useNavigation }  from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { AppHeader }      from '../../components/AppHeader';
import { useCustomerCreate } from '../../hooks/useCustomers';
import { Colors, Spacing, Typography, Radius } from '../../theme';

export function SalesCustomerCreateScreen() {
  const navigation = useNavigation<any>();
  const qc         = useQueryClient();
  const { createCustomer } = useCustomerCreate();

  const [name,          setName]          = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone,         setPhone]         = useState('');
  const [email,         setEmail]         = useState('');
  const [address,       setAddress]       = useState('');
  const [tin,           setTin]           = useState('');
  const [notes,         setNotes]         = useState('');
  const [loading,       setLoading]       = useState(false);

  const canSubmit = name.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await createCustomer({
        name:           name.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone:          phone.trim()         || undefined,
        email:          email.trim()         || undefined,
        address:        address.trim()       || undefined,
        tin:            tin.trim()           || undefined,
        notes:          notes.trim()         || undefined,
      });
      // Refresh the sales order dropdowns so the new customer appears
      await qc.invalidateQueries({ queryKey: ['sales-orders'] });
      Alert.alert('Success', `Customer "${name.trim()}" added.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to create customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="New Customer"
        subtitle="Quick registration"
        onBack={() => navigation.goBack()}
        dark
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          <View style={s.field}>
            <Text style={s.label}>Company / Customer Name <Text style={s.req}>*</Text></Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. ABC Trading Ltd"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoFocus
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Contact Person <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="e.g. Jean Claude"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Phone <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+250 7XX XXX XXX"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Email <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="contact@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Address <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={address}
              onChangeText={setAddress}
              placeholder="City, district…"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>TIN / VAT Number <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={s.input}
              value={tin}
              onChangeText={setTin}
              placeholder="Tax identification number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Notes <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes…"
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
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitText}>Add Customer</Text>}
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
