import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }        from '../../components/AppHeader';
import { FormInput }        from '../../components/FormInput';
import { FormSelect }       from '../../components/FormSelect';
import { DatePickerField }  from '../../components/DatePickerField';
import { useCasualCreate, useCasualUpdate } from '../../hooks/useCasuals';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<CasualLabourStackParamList, 'CasualForm'>;
type RoutePropT = RouteProp<CasualLabourStackParamList, 'CasualForm'>;

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

export function CasualFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const existing   = route.params?.casual;
  const isEdit     = existing != null;

  const { createCasual } = useCasualCreate();
  const { updateCasual } = useCasualUpdate();

  const [fullName,       setFullName]       = useState(existing?.full_name ?? '');
  const [nationalId,     setNationalId]     = useState(existing?.national_id ?? '');
  const [phone,          setPhone]          = useState(existing?.phone ?? '');
  const [gender,         setGender]         = useState<string | null>(existing?.gender ?? null);
  const [dob,            setDob]            = useState<string | null>(existing?.date_of_birth ?? null);
  const [address,        setAddress]        = useState(existing?.address ?? '');
  const [department,     setDepartment]     = useState(existing?.department ?? '');
  const [workLocation,   setWorkLocation]   = useState(existing?.work_location ?? '');
  const [jobRole,        setJobRole]        = useState(existing?.job_role ?? '');
  const [supervisorName, setSupervisorName] = useState(existing?.supervisor ?? '');
  const [startDate,      setStartDate]      = useState<string | null>(existing?.start_date ?? null);
  const [endDate,        setEndDate]        = useState<string | null>(existing?.end_date ?? null);
  const [emergencyName,  setEmergencyName]  = useState(existing?.emergency_name ?? '');
  const [emergencyRel,   setEmergencyRel]   = useState(existing?.emergency_relationship ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(existing?.emergency_phone ?? '');
  const [salary,         setSalary]         = useState(existing?.salary_per_action ? String(existing.salary_per_action) : '');
  const [active,         setActive]         = useState(existing?.active !== false);
  const [submitting,     setSubmitting]     = useState(false);

  async function handleSubmit() {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name is required.'); return;
    }

    const payload = {
      full_name:               fullName.trim(),
      national_id:             nationalId.trim() || undefined,
      phone:                   phone.trim() || undefined,
      gender:                  gender || undefined,
      date_of_birth:           dob || undefined,
      address:                 address.trim() || undefined,
      department:              department.trim() || undefined,
      work_location:           workLocation.trim() || undefined,
      job_role:                jobRole.trim() || undefined,
      supervisor:               supervisorName.trim() || undefined,
      start_date:               startDate || undefined,
      end_date:                 endDate || undefined,
      emergency_name:           emergencyName.trim() || undefined,
      emergency_relationship:   emergencyRel.trim() || undefined,
      emergency_phone:          emergencyPhone.trim() || undefined,
      salary_per_action:        salary.trim() || undefined,
      active,
    };

    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateCasual(existing.id, payload);
      } else {
        await createCasual(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save this record.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Casual Worker' : 'Register Casual Worker'}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <FormInput label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Full name" required />
          <FormInput label="National ID" value={nationalId} onChangeText={setNationalId} placeholder="National ID number" />
          <FormInput label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
          <FormSelect label="Gender" options={GENDER_OPTIONS} value={gender} onChange={(v) => setGender(String(v))} />
          <DatePickerField label="Date of birth" value={dob} onChange={setDob} />
          <FormInput label="Address" value={address} onChangeText={setAddress} placeholder="Residential address" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment Details</Text>
          <FormInput label="Department" value={department} onChangeText={setDepartment} placeholder="e.g. Forestry, Sawmill" />
          <FormInput label="Work Location" value={workLocation} onChangeText={setWorkLocation} placeholder="e.g. Compartment A, Mill" />
          <FormInput label="Job Role" value={jobRole} onChangeText={setJobRole} placeholder="e.g. Log loader, Planter" />
          <FormInput label="Supervisor" value={supervisorName} onChangeText={setSupervisorName} placeholder="Supervisor name" />
          <DatePickerField label="Start date" value={startDate} onChange={setStartDate} />
          <DatePickerField label="End date" value={endDate} onChange={setEndDate} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <FormInput label="Contact name" value={emergencyName} onChangeText={setEmergencyName} placeholder="Emergency contact full name" />
          <FormInput label="Relationship" value={emergencyRel} onChangeText={setEmergencyRel} placeholder="e.g. Spouse, Parent" />
          <FormInput label="Emergency phone" value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="Emergency contact phone" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salary</Text>
          <FormInput label="Salary per action" value={salary} onChangeText={setSalary} placeholder="e.g. 50.00" keyboardType="decimal-pad" />
        </View>

        {isEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Active</Text>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: Colors.border, true: Colors.navy }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Register Casual Worker'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: Typography.base, color: Colors.textPrimary },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
