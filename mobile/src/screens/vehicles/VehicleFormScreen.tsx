import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TextInput,
  TouchableOpacity, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { FormInput }    from '../../components/FormInput';
import { FormSelect }   from '../../components/FormSelect';
import { useVehicleCreate, useVehicleUpdate, useTransportDropdown } from '../../hooks/useVehicles';
import { useOfflineStore } from '../../stores/offlineStore';
import {
  VehicleOwnership, VehicleStatus, VehicleCategory,
  VehicleFuelType, VehicleOwnerType, VehiclePayMethod,
} from '../../types/api';
import { VehiclesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<VehiclesStackParamList, 'VehicleForm'>;
type RoutePropT = RouteProp<VehiclesStackParamList, 'VehicleForm'>;

const CATEGORY_OPTIONS: { label: string; value: VehicleCategory }[] = [
  { label: 'Pickup',      value: 'Pickup' },
  { label: 'Truck',       value: 'Truck' },
  { label: 'Van',         value: 'Van' },
  { label: 'Bus',         value: 'Bus' },
  { label: 'Lorry',       value: 'Lorry' },
  { label: 'Motorcycle',  value: 'Motorcycle' },
  { label: 'Excavator',   value: 'Excavator' },
  { label: 'Tractor',     value: 'Tractor' },
  { label: 'Other',       value: 'Other' },
];

const STATUS_OPTIONS: { label: string; value: VehicleStatus }[] = [
  { label: 'Active',         value: 'Active' },
  { label: 'In Maintenance', value: 'In Maintenance' },
  { label: 'Inactive',       value: 'Inactive' },
];

const FUEL_OPTIONS: { label: string; value: VehicleFuelType }[] = [
  { label: 'Diesel',   value: 'Diesel' },
  { label: 'Petrol',   value: 'Petrol' },
  { label: 'Electric', value: 'Electric' },
  { label: 'Hybrid',   value: 'Hybrid' },
];

const OWNER_TYPE_OPTIONS: { label: string; value: VehicleOwnerType }[] = [
  { label: 'Individual', value: 'Individual' },
  { label: 'Company',    value: 'Company' },
];

const PAY_METHOD_OPTIONS: { label: string; value: VehiclePayMethod }[] = [
  { label: 'Monthly',        value: 'Monthly' },
  { label: 'Weekly',         value: 'Weekly' },
  { label: 'Per Trip',       value: 'Per Trip' },
  { label: 'Per Day',        value: 'Per Day' },
  { label: 'Fixed Contract', value: 'Fixed Contract' },
];

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={13} color={Colors.navy} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// Searchable modal picker for transport company owner name
function TransportPicker({
  visible, companies, selectedName, onSelect, onClose,
}: {
  visible:      boolean;
  companies:    { id: number; name: string }[];
  selectedName: string;
  onSelect:     (name: string) => void;
  onClose:      () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? companies.filter(c => c.name.toLowerCase().includes(q))
      : companies;
  }, [query, companies]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Owner</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearch}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search companies…"
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              <TouchableOpacity
                style={[styles.modalOption, !selectedName && styles.modalOptionSelected]}
                onPress={() => { onSelect('__other__'); onClose(); }}
              >
                <Text style={styles.modalOptionText}>Other / enter manually</Text>
              </TouchableOpacity>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalOption, selectedName === item.name && styles.modalOptionSelected]}
                onPress={() => { onSelect(item.name); onClose(); }}
              >
                <Text style={styles.modalOptionText}>{item.name}</Text>
                {selectedName === item.name && (
                  <Ionicons name="checkmark" size={16} color={Colors.navy} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>No companies match "{query}"</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

export function VehicleFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const existing   = route.params?.vehicle;
  const isEdit     = existing != null;

  const { createVehicle } = useVehicleCreate();
  const { updateVehicle } = useVehicleUpdate();
  const { isOnline }      = useOfflineStore();
  const { data: tpData }  = useTransportDropdown();
  const companies         = tpData?.rows ?? [];

  const [ownership,  setOwnership]  = useState<VehicleOwnership>(existing?.ownership_type ?? 'Company Car');
  const [category,   setCategory]   = useState(existing?.vehicle_category ?? '');
  const [status,     setStatus]     = useState<VehicleStatus>(existing?.status ?? 'Active');

  // Company Car fields
  const [reg,       setReg]       = useState(existing?.registration    ?? '');
  const [vtype,     setVtype]     = useState(existing?.vehicle_type    ?? '');
  const [make,      setMake]      = useState(existing?.make            ?? '');
  const [model,     setModel]     = useState(existing?.model           ?? '');
  const [year,      setYear]      = useState(existing?.year != null ? String(existing.year) : '');
  const [fuel,      setFuel]      = useState(existing?.fuel_type       ?? '');
  const [chassis,   setChassis]   = useState(existing?.chassis_vin     ?? '');
  const [engine,    setEngine]    = useState(existing?.engine_number   ?? '');
  const [odo,       setOdo]       = useState(existing?.odometer_reading != null ? String(existing.odometer_reading) : '');
  const [assetCode, setAssetCode] = useState(existing?.asset_code      ?? '');
  const [purDate,   setPurDate]   = useState(existing?.purchase_date   ?? '');
  const [purCost,   setPurCost]   = useState(existing?.purchase_cost != null ? String(existing.purchase_cost) : '');
  const [dept,      setDept]      = useState(existing?.department      ?? '');
  const [driverAss, setDriverAss] = useState(existing?.driver_assigned ?? '');
  const [insExpiry, setInsExpiry] = useState(existing?.insurance_expiry     ?? '');
  const [roadExpiry,setRoadExpiry]= useState(existing?.road_license_expiry  ?? '');
  const [inspExpiry,setInspExpiry]= useState(existing?.inspection_expiry    ?? '');
  const [notes,     setNotes]     = useState(existing?.notes ?? '');

  // Third-Party fields
  const [ownerName,     setOwnerName]     = useState(existing?.owner_name ?? '');
  const [ownerNameOther,setOwnerNameOther]= useState('');
  const [ownerType,     setOwnerType]     = useState(existing?.owner_type ?? '');
  const [ownerIdNum,    setOwnerIdNum]    = useState(existing?.owner_id_number  ?? '');
  const [ownerPhone,    setOwnerPhone]    = useState(existing?.owner_phone      ?? '');
  const [ownerEmail,    setOwnerEmail]    = useState(existing?.owner_email      ?? '');
  const [ownerAddress,  setOwnerAddress]  = useState(existing?.owner_address    ?? '');
  const [contractNum,   setContractNum]   = useState(existing?.contract_number  ?? '');
  const [contractStart, setContractStart] = useState(existing?.contract_start_date ?? '');
  const [contractEnd,   setContractEnd]   = useState(existing?.contract_end_date   ?? '');
  const [payRate,       setPayRate]       = useState(existing?.payment_rate != null ? String(existing.payment_rate) : '');
  const [payMethod,     setPayMethod]     = useState(existing?.payment_method ?? '');
  const [project,       setProject]       = useState(existing?.assigned_project ?? '');
  const [driverName,    setDriverName]    = useState(existing?.driver_name           ?? '');
  const [driverPhone,   setDriverPhone]   = useState(existing?.driver_phone          ?? '');
  const [driverLic,     setDriverLic]     = useState(existing?.driver_license_number ?? '');
  const [driverLicExp,  setDriverLicExp]  = useState(existing?.driver_license_expiry ?? '');

  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  const isCompany = ownership === 'Company Car';

  const resolvedOwnerName = ownerName === '__other__' ? ownerNameOther : ownerName;
  const regField = isCompany ? reg : reg; // same field, both sections use same state

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Vehicle management requires an active connection.');
      return;
    }
    if (!reg.trim()) {
      Alert.alert('Required', 'Plate number is required.'); return;
    }
    if (!category) {
      Alert.alert('Required', 'Vehicle category is required.'); return;
    }
    if (!isCompany && !resolvedOwnerName.trim()) {
      Alert.alert('Required', 'Owner name is required for Third-Party vehicles.'); return;
    }

    const base = {
      registration:         reg.trim(),
      ownership_type:       ownership,
      vehicle_category:     category || undefined,
      status,
      vehicle_type:         vtype.trim()   || undefined,
      make:                 make.trim()    || undefined,
      model:                model.trim()   || undefined,
      year:                 year           ? Number(year)    : null,
      fuel_type:            fuel           || null,
      chassis_vin:          chassis.trim() || undefined,
      engine_number:        engine.trim()  || undefined,
      odometer_reading:     odo            ? Number(odo)     : null,
      insurance_expiry:     insExpiry      || null,
      road_license_expiry:  roadExpiry     || null,
      inspection_expiry:    inspExpiry     || null,
      notes:                notes.trim()   || undefined,
    };

    const payload = isCompany
      ? {
          ...base,
          asset_code:     assetCode.trim() || undefined,
          purchase_date:  purDate          || null,
          purchase_cost:  purCost          ? Number(purCost) : null,
          department:     dept.trim()      || undefined,
          driver_assigned:driverAss.trim() || undefined,
        }
      : {
          ...base,
          owner_name:            resolvedOwnerName.trim() || null,
          owner_type:            ownerType                || null,
          owner_id_number:       ownerIdNum.trim()        || undefined,
          owner_phone:           ownerPhone.trim()        || undefined,
          owner_email:           ownerEmail.trim()        || undefined,
          owner_address:         ownerAddress.trim()      || undefined,
          contract_number:       contractNum.trim()       || undefined,
          contract_start_date:   contractStart            || null,
          contract_end_date:     contractEnd              || null,
          payment_rate:          payRate                  ? Number(payRate) : null,
          payment_method:        payMethod                || null,
          assigned_project:      project.trim()           || undefined,
          driver_name:           driverName.trim()        || undefined,
          driver_phone:          driverPhone.trim()       || undefined,
          driver_license_number: driverLic.trim()         || undefined,
          driver_license_expiry: driverLicExp             || null,
        };

    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateVehicle(Number(existing.id), payload as any);
      } else {
        await createVehicle(payload as any);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save vehicle.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Vehicle' : 'Register Vehicle'}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Ownership toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ownership Type *</Text>
          <View style={styles.ownerToggle}>
            {(['Company Car', 'Third-Party Car'] as VehicleOwnership[]).map((o) => (
              <TouchableOpacity
                key={o}
                style={[styles.ownerBtn, ownership === o && styles.ownerBtnActive]}
                onPress={() => setOwnership(o)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={o === 'Company Car' ? 'business-outline' : 'person-outline'}
                  size={14}
                  color={ownership === o ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.ownerBtnText, ownership === o && styles.ownerBtnTextActive]}>
                  {o}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category + Status (shared) */}
        <View style={styles.section}>
          <FormSelect
            label="Vehicle Category *"
            value={category}
            onChange={(v) => setCategory(v as VehicleCategory)}
            options={[{ label: '— Select —', value: '' }, ...CATEGORY_OPTIONS]}
          />
          <FormSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as VehicleStatus)}
            options={STATUS_OPTIONS}
          />
        </View>

        {/* Company Car — Vehicle Info */}
        {isCompany && (
          <>
            <View style={styles.section}>
              <SectionHeader title="Vehicle Information" icon="car-outline" />
              <FormInput label="Plate Number *" value={reg}     onChangeText={setReg}     placeholder="RAB 123A" />
              <FormInput label="Vehicle Type"   value={vtype}   onChangeText={setVtype}   placeholder="Truck, Van…" />
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Make"  value={make}  onChangeText={setMake}  placeholder="Toyota" /></View>
                <View style={styles.col}><FormInput label="Model" value={model} onChangeText={setModel} placeholder="Hilux" /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Year" value={year} onChangeText={setYear} placeholder="2022" keyboardType="numeric" /></View>
                <View style={styles.col}>
                  <FormSelect label="Fuel Type" value={fuel} onChange={(v) => setFuel(v as string)} options={[{ label: '—', value: '' }, ...FUEL_OPTIONS]} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Chassis / VIN"  value={chassis} onChangeText={setChassis} /></View>
                <View style={styles.col}><FormInput label="Engine Number"  value={engine}  onChangeText={setEngine} /></View>
              </View>
              <FormInput label="Odometer (km)" value={odo} onChangeText={setOdo} placeholder="0" keyboardType="numeric" />
            </View>

            <View style={styles.section}>
              <SectionHeader title="Asset Information" icon="document-text-outline" />
              <FormInput label="Asset Code"         value={assetCode} onChangeText={setAssetCode} />
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Purchase Date (YYYY-MM-DD)" value={purDate} onChangeText={setPurDate} placeholder="2024-01-15" /></View>
                <View style={styles.col}><FormInput label="Purchase Cost (RWF)" value={purCost} onChangeText={setPurCost} keyboardType="numeric" /></View>
              </View>
              <FormInput label="Department Assigned" value={dept}      onChangeText={setDept} />
              <FormInput label="Driver Assigned"      value={driverAss} onChangeText={setDriverAss} />
            </View>
          </>
        )}

        {/* Third-Party — Owner Info */}
        {!isCompany && (
          <>
            <View style={styles.section}>
              <SectionHeader title="Owner Information" icon="person-outline" />

              {/* Searchable company picker */}
              <Text style={styles.fieldLabel}>Owner Name *</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
                <Text style={[styles.pickerValue, !resolvedOwnerName && styles.pickerPlaceholder]}>
                  {ownerName === '__other__'
                    ? (ownerNameOther || 'Other / enter manually')
                    : (ownerName || 'Select company or enter manually')}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
              {ownerName === '__other__' && (
                <FormInput
                  label="Enter owner name"
                  value={ownerNameOther}
                  onChangeText={setOwnerNameOther}
                  placeholder="Full name or company name"
                />
              )}

              <TransportPicker
                visible={pickerVisible}
                companies={companies}
                selectedName={resolvedOwnerName}
                onSelect={(name) => { setOwnerName(name); if (name !== '__other__') setOwnerNameOther(''); }}
                onClose={() => setPickerVisible(false)}
              />

              <FormSelect
                label="Owner Type"
                value={ownerType}
                onChange={(v) => setOwnerType(v as string)}
                options={[{ label: '—', value: '' }, ...OWNER_TYPE_OPTIONS]}
              />
              <FormInput label="National ID / Company Reg No." value={ownerIdNum}    onChangeText={setOwnerIdNum} />
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Phone"   value={ownerPhone}   onChangeText={setOwnerPhone}   keyboardType="phone-pad" /></View>
                <View style={styles.col}><FormInput label="Email"   value={ownerEmail}   onChangeText={setOwnerEmail}   keyboardType="email-address" /></View>
              </View>
              <FormInput label="Physical Address" value={ownerAddress} onChangeText={setOwnerAddress} />
            </View>

            <View style={styles.section}>
              <SectionHeader title="Vehicle Information" icon="car-outline" />
              <FormInput label="Plate Number *" value={reg}     onChangeText={setReg}     placeholder="RAB 123A" />
              <FormInput label="Vehicle Type"   value={vtype}   onChangeText={setVtype}   placeholder="Truck, Van…" />
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Make"  value={make}  onChangeText={setMake}  placeholder="Toyota" /></View>
                <View style={styles.col}><FormInput label="Model" value={model} onChangeText={setModel} placeholder="Hilux" /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Year"        value={year}    onChangeText={setYear}    placeholder="2022" keyboardType="numeric" /></View>
                <View style={styles.col}><FormInput label="Chassis/VIN" value={chassis} onChangeText={setChassis} /></View>
              </View>
              <FormSelect label="Fuel Type" value={fuel} onChange={(v) => setFuel(v as string)} options={[{ label: '—', value: '' }, ...FUEL_OPTIONS]} />
            </View>

            <View style={styles.section}>
              <SectionHeader title="Contract Information" icon="document-outline" />
              <FormInput label="Contract Number" value={contractNum}   onChangeText={setContractNum} />
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Start Date (YYYY-MM-DD)" value={contractStart} onChangeText={setContractStart} placeholder="2024-01-01" /></View>
                <View style={styles.col}><FormInput label="End Date (YYYY-MM-DD)"   value={contractEnd}   onChangeText={setContractEnd}   placeholder="2025-01-01" /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Payment Rate (RWF)" value={payRate} onChangeText={setPayRate} keyboardType="numeric" /></View>
                <View style={styles.col}>
                  <FormSelect label="Payment Method" value={payMethod} onChange={(v) => setPayMethod(v as string)} options={[{ label: '—', value: '' }, ...PAY_METHOD_OPTIONS]} />
                </View>
              </View>
              <FormInput label="Assigned Project / Site" value={project} onChangeText={setProject} />
            </View>

            <View style={styles.section}>
              <SectionHeader title="Driver Information" icon="person-circle-outline" />
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="Driver Name"  value={driverName}  onChangeText={setDriverName}  /></View>
                <View style={styles.col}><FormInput label="Driver Phone" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}><FormInput label="License No."           value={driverLic}    onChangeText={setDriverLic} /></View>
                <View style={styles.col}><FormInput label="License Expiry (YYYY-MM-DD)" value={driverLicExp} onChangeText={setDriverLicExp} placeholder="2026-12-31" /></View>
              </View>
            </View>
          </>
        )}

        {/* Compliance (shared) */}
        <View style={styles.section}>
          <SectionHeader title="Compliance" icon="shield-checkmark-outline" />
          <FormInput label="Insurance Expiry (YYYY-MM-DD)"    value={insExpiry}  onChangeText={setInsExpiry}  placeholder="2026-12-31" />
          <FormInput label="Road License Expiry (YYYY-MM-DD)" value={roadExpiry} onChangeText={setRoadExpiry} placeholder="2026-12-31" />
          <FormInput label="Inspection Expiry (YYYY-MM-DD)"   value={inspExpiry} onChangeText={setInspExpiry} placeholder="2026-12-31" />
        </View>

        <View style={styles.section}>
          <FormInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline numberOfLines={2} />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Register Vehicle'}</Text>}
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  sectionTitle:  {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.navy, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },

  ownerToggle: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ownerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, padding: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  ownerBtnActive:     { borderColor: Colors.navy, backgroundColor: Colors.navy },
  ownerBtnText:       { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },
  ownerBtnTextActive: { color: Colors.white },

  fieldLabel: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 4, fontWeight: '500' },
  pickerTrigger: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    backgroundColor: Colors.card,
  },
  pickerValue:       { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  pickerPlaceholder: { color: Colors.textMuted },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    margin: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8,
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  modalSearchInput: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  modalOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalOptionSelected: { backgroundColor: Colors.navyBg },
  modalOptionText:     { fontSize: Typography.sm, color: Colors.textPrimary },
  modalEmpty:          { padding: Spacing.base, textAlign: 'center', color: Colors.textMuted, fontSize: Typography.sm },
});
