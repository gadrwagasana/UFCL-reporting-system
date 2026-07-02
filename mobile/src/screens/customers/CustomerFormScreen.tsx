import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { useCustomerCreate, useCustomerUpdate } from '../../hooks/useCustomers';
import { useOfflineStore } from '../../stores/offlineStore';
import { CustomersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp   = NativeStackNavigationProp<CustomersStackParamList, 'CustomerForm'>;
type RoutePropT = RouteProp<CustomersStackParamList, 'CustomerForm'>;

export function CustomerFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const existing   = route.params?.customer;
  const isEdit     = existing != null;

  const { createCustomer } = useCustomerCreate();
  const { updateCustomer } = useCustomerUpdate();
  const { isOnline }       = useOfflineStore();

  const [name,          setName]          = useState(existing?.name          ?? '');
  const [contactPerson, setContactPerson] = useState(existing?.contact_person ?? '');
  const [phone,         setPhone]         = useState(existing?.phone          ?? '');
  const [email,         setEmail]         = useState(existing?.email          ?? '');
  const [address,       setAddress]       = useState(existing?.address        ?? '');
  const [tin,           setTin]           = useState(existing?.tin            ?? '');
  const [notes,         setNotes]         = useState(existing?.notes          ?? '');
  const [submitting,    setSubmitting]    = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('Required', 'Company/Name is required.'); return;
    }
    if (!isOnline) {
      Alert.alert('Online Required', 'Customer management requires an active connection.');
      return;
    }

    const payload = {
      name:            name.trim(),
      ...(contactPerson.trim() && { contact_person: contactPerson.trim() }),
      ...(phone.trim()         && { phone:          phone.trim() }),
      ...(email.trim()         && { email:          email.trim() }),
      ...(address.trim()       && { address:        address.trim() }),
      ...(tin.trim()           && { tin:            tin.trim() }),
      ...(notes.trim()         && { notes:          notes.trim() }),
    };

    setSubmitting(true);
    try {
      if (isEdit && existing) {
        const result = await updateCustomer(existing.id, payload);
        if (result?.pendingApproval) {
          Alert.alert(
            'Edit Submitted',
            result.message ?? 'Your edit has been submitted and is awaiting approval.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
          return;
        }
      } else {
        await createCustomer(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save customer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Customer' : 'Register Customer'}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {!isOnline && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
            <Text style={styles.offlineText}>Online connection required to save.</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>

          <FormInput
            label="Company / Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Kigali Timber Ltd"
            required
          />
          <FormInput
            label="Contact Person"
            value={contactPerson}
            onChangeText={setContactPerson}
            placeholder="e.g. Jean Bosco"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <FormInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. +250 788 000 000"
            keyboardType="phone-pad"
          />
          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. info@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormInput
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, City"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax & Notes</Text>

          <FormInput
            label="TIN Number"
            value={tin}
            onChangeText={setTin}
            placeholder="Tax identification number"
            keyboardType="numeric"
          />
          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes…"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Register Customer'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  offlineNotice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warningBg ?? '#FFF8E1',
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  offlineText: { fontSize: Typography.sm, color: Colors.warning, flex: 1 },

  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
