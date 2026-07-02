import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import {
  useVehicleDetail,
  useVehicleDelete,
  useFuelLogDelete,
  useMaintenanceDelete,
} from '../../hooks/useVehicles';
import { useOfflineStore } from '../../stores/offlineStore';
import { FuelLog, MaintenanceRecord, VehiclePendingApproval } from '../../types/api';
import { VehiclesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp   = NativeStackNavigationProp<VehiclesStackParamList, 'VehicleDetail'>;
type RoutePropT = RouteProp<VehiclesStackParamList, 'VehicleDetail'>;

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1_000;

function dateColor(isoDate: string | null | undefined): string {
  if (!isoDate) return Colors.textMuted;
  const d = new Date(isoDate);
  const now = new Date();
  if (d < now)                            return Colors.error;
  if (d.getTime() - now.getTime() < THIRTY_DAYS) return Colors.warning;
  return Colors.textSecondary;
}

function fmt(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-GB');
}

function Row({ label, value, color }: { label: string; value: string | number | null | undefined; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color } : null]}>{value ?? '—'}</Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={13} color={Colors.navy} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FuelLogRow({
  entry, onDelete, isOnline,
}: { entry: FuelLog; onDelete: () => void; isOnline: boolean }) {
  return (
    <View style={styles.subCard}>
      <View style={styles.subCardTop}>
        <Text style={styles.subCardMain}>{entry.liters} L</Text>
        <Text style={styles.subCardDate}>{entry.log_date}</Text>
      </View>
      {entry.total_cost != null && (
        <Text style={styles.subCardSub}>RWF {entry.total_cost.toLocaleString()}</Text>
      )}
      {entry.notes ? <Text style={styles.subCardNote}>{entry.notes}</Text> : null}
      {isOnline && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={13} color={Colors.error} />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MaintenanceRow({
  record, onDelete, isOnline,
}: { record: MaintenanceRecord; onDelete: () => void; isOnline: boolean }) {
  return (
    <View style={styles.subCard}>
      <View style={styles.subCardTop}>
        <View style={styles.maintTypeBadge}>
          <Text style={styles.maintTypeBadgeText}>{record.maintenance_type}</Text>
        </View>
        <Text style={styles.subCardDate}>{record.maintenance_date}</Text>
      </View>
      <Text style={styles.subCardMain}>{record.description}</Text>
      {record.cost != null && <Text style={styles.subCardSub}>RWF {Number(record.cost).toLocaleString()}</Text>}
      {record.performed_by ? <Text style={styles.subCardNote}>By: {record.performed_by}</Text> : null}
      {record.next_due_date ? <Text style={styles.subCardNote}>Next due: {record.next_due_date}</Text> : null}
      {isOnline && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={13} color={Colors.error} />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function VehicleDetailScreen() {
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RoutePropT>();
  const { vehicleId } = route.params;
  const { isOnline } = useOfflineStore();

  const { data, isLoading, isError, refetch } = useVehicleDetail(vehicleId);
  const { deleteVehicle }      = useVehicleDelete();
  const { deleteFuelLog }      = useFuelLogDelete();
  const { deleteMaintenance }  = useMaintenanceDelete();

  if (isLoading) return <LoadingState message="Loading vehicle…" fullScreen />;
  if (isError || !data?.vehicle) return <ErrorState message="Could not load vehicle" onRetry={refetch} fullScreen />;

  const { vehicle, fuelLogs, maintenance } = data;
  const isCompany = vehicle.ownership_type !== 'Third-Party Car';

  async function handleDeleteVehicle() {
    Alert.alert(
      'Delete Vehicle',
      `Delete ${vehicle.registration}?\n\nThis permanently removes the vehicle. All fuel logs will be deleted, maintenance records will be archived according to existing business rules, and delivery references will be cleared. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (!isOnline) {
              Alert.alert('Online Required', 'Vehicle deletion requires an active connection.');
              return;
            }
            try {
              await deleteVehicle(vehicleId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not delete vehicle.');
            }
          },
        },
      ],
    );
  }

  function handleDeleteFuelLog(entry: FuelLog) {
    if (!isOnline) {
      Alert.alert('Online Required', 'Fuel log deletion requires an active connection.');
      return;
    }
    Alert.prompt(
      'Delete Fuel Log',
      `Enter a reason for deleting this fuel log (${entry.liters} L on ${entry.log_date}):`,
      async (reason) => {
        if (!reason?.trim()) return;
        try {
          const result = await deleteFuelLog(Number(entry.id), vehicleId, reason.trim());
          if (result && (result as VehiclePendingApproval).pendingApproval) {
            Alert.alert('Submitted for Review', (result as VehiclePendingApproval).message);
          }
        } catch (err: any) {
          Alert.alert('Error', err?.message ?? 'Could not delete fuel log.');
        }
      },
      'plain-text',
    );
  }

  function handleDeleteMaintenance(record: MaintenanceRecord) {
    if (!isOnline) {
      Alert.alert('Online Required', 'Maintenance record deletion requires an active connection.');
      return;
    }
    Alert.prompt(
      'Delete Maintenance Record',
      `Enter a reason for deleting "${record.description}":`,
      async (reason) => {
        if (!reason?.trim()) return;
        try {
          const result = await deleteMaintenance(Number(record.id), vehicleId, reason.trim());
          if (result && (result as VehiclePendingApproval).pendingApproval) {
            Alert.alert('Submitted for Review', (result as VehiclePendingApproval).message);
          }
        } catch (err: any) {
          Alert.alert('Error', err?.message ?? 'Could not delete maintenance record.');
        }
      },
      'plain-text',
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title={vehicle.registration}
        dark
        onBack={() => navigation.goBack()}
        actions={[{
          icon: 'create-outline',
          onPress: () => navigation.navigate('VehicleForm', { vehicle }),
        }]}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Status + ownership */}
        <View style={styles.section}>
          <View style={styles.identityRow}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, {
                backgroundColor: vehicle.status === 'Active' ? Colors.success
                  : vehicle.status === 'In Maintenance' ? Colors.warning : Colors.textMuted,
              }]} />
              <Text style={styles.statusText}>{vehicle.status}</Text>
            </View>
            <Text style={styles.ownerType}>
              {vehicle.ownership_type ?? 'Company Car'}
            </Text>
          </View>
          <Row label="Category"     value={vehicle.vehicle_category} />
          <Row label="Vehicle Type" value={vehicle.vehicle_type} />
          <Row label="Make / Model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || null} />
          <Row label="Year"         value={vehicle.year} />
          <Row label="Fuel Type"    value={vehicle.fuel_type} />
          <Row label="Chassis/VIN"  value={vehicle.chassis_vin} />
          <Row label="Engine No."   value={vehicle.engine_number} />
          {vehicle.odometer_reading != null && (
            <Row label="Odometer"   value={`${vehicle.odometer_reading} km`} />
          )}
        </View>

        {/* Company Car — Asset info */}
        {isCompany && (
          <View style={styles.section}>
            <SectionHeader title="Asset Information" icon="document-text-outline" />
            <Row label="Asset Code"     value={vehicle.asset_code} />
            <Row label="Purchase Date"  value={fmt(vehicle.purchase_date)} />
            <Row label="Purchase Cost"  value={vehicle.purchase_cost != null ? `RWF ${Number(vehicle.purchase_cost).toLocaleString()}` : null} />
            <Row label="Department"     value={vehicle.department} />
            <Row label="Driver Assigned"value={vehicle.driver_assigned} />
          </View>
        )}

        {/* Third-Party — Owner + Contract + Driver */}
        {!isCompany && (
          <>
            <View style={styles.section}>
              <SectionHeader title="Owner Information" icon="person-outline" />
              <Row label="Owner Name"    value={vehicle.owner_name} />
              <Row label="Owner Type"    value={vehicle.owner_type} />
              <Row label="ID / Reg No."  value={vehicle.owner_id_number} />
              <Row label="Phone"         value={vehicle.owner_phone} />
              <Row label="Email"         value={vehicle.owner_email} />
              <Row label="Address"       value={vehicle.owner_address} />
            </View>
            <View style={styles.section}>
              <SectionHeader title="Contract" icon="document-outline" />
              <Row label="Contract No."     value={vehicle.contract_number} />
              <Row label="Start Date"       value={fmt(vehicle.contract_start_date)} />
              <Row label="End Date"         value={fmt(vehicle.contract_end_date)} />
              <Row label="Payment Rate"     value={vehicle.payment_rate != null ? `RWF ${Number(vehicle.payment_rate).toLocaleString()}` : null} />
              <Row label="Payment Method"   value={vehicle.payment_method} />
              <Row label="Assigned Project" value={vehicle.assigned_project} />
            </View>
            <View style={styles.section}>
              <SectionHeader title="Driver Information" icon="person-circle-outline" />
              <Row label="Driver Name"      value={vehicle.driver_name} />
              <Row label="Phone"            value={vehicle.driver_phone} />
              <Row label="License No."      value={vehicle.driver_license_number} />
              <Row label="License Expiry"   value={fmt(vehicle.driver_license_expiry)} color={dateColor(vehicle.driver_license_expiry)} />
            </View>
          </>
        )}

        {/* Compliance */}
        <View style={styles.section}>
          <SectionHeader title="Compliance" icon="shield-checkmark-outline" />
          <Row label="Insurance Expiry"   value={fmt(vehicle.insurance_expiry)}    color={dateColor(vehicle.insurance_expiry)} />
          <Row label="Road Lic. Expiry"   value={fmt(vehicle.road_license_expiry)} color={dateColor(vehicle.road_license_expiry)} />
          <Row label="Inspection Expiry"  value={fmt(vehicle.inspection_expiry)}   color={dateColor(vehicle.inspection_expiry)} />
        </View>

        {/* Documents note */}
        <View style={styles.docNote}>
          <Ionicons name="attach-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.docNoteText}>
            Document files (insurance certificate, registration card, photos) are managed from the desktop.
          </Text>
        </View>

        {vehicle.notes ? (
          <View style={styles.section}>
            <SectionHeader title="Notes" icon="chatbubble-outline" />
            <Text style={styles.notesText}>{vehicle.notes}</Text>
          </View>
        ) : null}

        {/* Fuel logs */}
        <View style={styles.section}>
          <View style={styles.subHeader}>
            <SectionHeader title={`Fuel Logs (${fuelLogs.length})`} icon="flame-outline" />
            {isOnline && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('VehicleFuelLogCreate', {
                  vehicleId, registration: vehicle.registration,
                })}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={Colors.white} />
                <Text style={styles.addBtnText}>Log Fuel</Text>
              </TouchableOpacity>
            )}
          </View>
          {fuelLogs.length === 0 ? (
            <Text style={styles.emptySubText}>No fuel logs recorded.</Text>
          ) : (
            fuelLogs.map((entry) => (
              <FuelLogRow
                key={String(entry.id)}
                entry={entry}
                isOnline={isOnline}
                onDelete={() => handleDeleteFuelLog(entry)}
              />
            ))
          )}
        </View>

        {/* Maintenance records */}
        <View style={styles.section}>
          <View style={styles.subHeader}>
            <SectionHeader title={`Maintenance (${maintenance.length})`} icon="build-outline" />
            {isOnline && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('VehicleMaintenanceCreate', {
                  vehicleId, registration: vehicle.registration,
                })}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={Colors.white} />
                <Text style={styles.addBtnText}>Add Record</Text>
              </TouchableOpacity>
            )}
          </View>
          {maintenance.length === 0 ? (
            <Text style={styles.emptySubText}>No maintenance records.</Text>
          ) : (
            maintenance.map((record) => (
              <MaintenanceRow
                key={String(record.id)}
                record={record}
                isOnline={isOnline}
                onDelete={() => handleDeleteMaintenance(record)}
              />
            ))
          )}
        </View>

        {/* Delete vehicle */}
        {isOnline && (
          <TouchableOpacity style={styles.deleteVehicleBtn} onPress={handleDeleteVehicle} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={styles.deleteVehicleBtnText}>Delete Vehicle</Text>
          </TouchableOpacity>
        )}

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
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  sectionTitle:  {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.navy, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  identityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  statusText:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  ownerType:   { fontSize: Typography.xs, color: Colors.textMuted },

  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 2 },
  rowLabel:  { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:  { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1.5, textAlign: 'right', fontWeight: '500' },

  docNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm, backgroundColor: Colors.bg,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  docNoteText: { flex: 1, fontSize: Typography.xs, color: Colors.textMuted, lineHeight: 16 },

  notesText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },

  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  addBtnText: { fontSize: Typography.xs, color: Colors.white, fontWeight: Typography.semibold },

  emptySubText: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },

  subCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.md,
    padding: Spacing.sm, gap: 3, borderWidth: 1, borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  subCardTop:      { flexDirection: 'row', justifyContent: 'space-between' },
  subCardMain:     { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  subCardDate:     { fontSize: Typography.xs, color: Colors.textMuted },
  subCardSub:      { fontSize: Typography.xs, color: Colors.textSecondary },
  subCardNote:     { fontSize: Typography.xs, color: Colors.textMuted },

  maintTypeBadge: {
    backgroundColor: Colors.infoBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.xs, paddingVertical: 2,
  },
  maintTypeBadgeText: { fontSize: 10, color: Colors.info, fontWeight: Typography.semibold },

  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  deleteBtnText: { fontSize: Typography.xs, color: Colors.error },

  deleteVehicleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: Colors.errorBg, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, borderWidth: 1, borderColor: Colors.error,
  },
  deleteVehicleBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.error },
});
