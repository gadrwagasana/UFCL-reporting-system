import React, { useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { useMachineDetail, useMachineDelete } from '../../hooks/useMachines';
import { MaintSchedule }    from '../../types/api';
import { MachinesStackParamList } from '../../navigation/types';
import { hasPermission }  from '../../utils/permissions';
import { useAuthStore }   from '../../stores/authStore';
import { pushRecentlyViewed } from '../../utils/storage';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<MachinesStackParamList, 'MachineDetail'>;
type RoutePropT = RouteProp<MachinesStackParamList, 'MachineDetail'>;

function dateColor(dateStr?: string): string {
  if (!dateStr) return Colors.textSecondary;
  const d = new Date(dateStr);
  const now = new Date();
  if (d <= now) return Colors.error;
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  return days <= 30 ? Colors.warning : Colors.textSecondary;
}

const STATUS_COLOR: Record<string, string> = {
  Available:   Colors.success,
  Running:     Colors.navy,
  Maintenance: Colors.warning,
  Breakdown:   Colors.error,
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  );
}

function ScheduleCard({ s }: { s: MaintSchedule }) {
  const overdue = s.next_due && new Date(s.next_due) <= new Date();
  return (
    <View style={styles.schedCard}>
      <View style={styles.schedTop}>
        <Text style={styles.schedType}>{s.maintenance_type}</Text>
        <Text style={styles.schedFreq}>Every {s.frequency_days}d</Text>
      </View>
      <View style={styles.schedRow}>
        {s.last_performed ? (
          <View style={styles.schedMeta}>
            <Ionicons name="checkmark-circle-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.schedMetaText}>Last: {s.last_performed.slice(0, 10)}</Text>
          </View>
        ) : null}
        {s.next_due ? (
          <View style={styles.schedMeta}>
            <Ionicons name="calendar-outline" size={12} color={dateColor(s.next_due)} />
            <Text style={[styles.schedMetaText, { color: dateColor(s.next_due) }]}>
              {overdue ? 'Overdue: ' : 'Next: '}{s.next_due.slice(0, 10)}
            </Text>
          </View>
        ) : null}
        <View style={styles.schedMeta}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.schedMetaText}>{s.estimated_hours}h est.</Text>
        </View>
      </View>
      {s.notes ? <Text style={styles.schedNotes}>{s.notes}</Text> : null}
    </View>
  );
}

export function MachineDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { machineId } = route.params;

  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);

  const { data, isLoading, isError, refetch } = useMachineDetail(machineId);
  const { deleteMachine } = useMachineDelete();
  const machine   = data?.machine;
  const schedules = data?.schedules ?? [];

  // Stabilization Phase 6 — Recently Viewed, mirroring the Phase 3 reference
  // implementation on StockTransferDetailScreen exactly (same helper, same
  // "before the early returns" placement per Rules of Hooks).
  useEffect(() => {
    if (!machine) return;
    pushRecentlyViewed('machine', String(machine.id), `${machine.machine_code} — ${machine.name}`);
  }, [machine?.id]);

  if (isLoading) return <LoadingState message="Loading machine…" fullScreen />;
  if (isError || !machine) return <ErrorState message="Could not load machine" onRetry={refetch} fullScreen />;

  const statusColor = STATUS_COLOR[machine.status] ?? Colors.textSecondary;

  // Stabilization Phase 5 (F-19) — machinesDelete (soft-deactivate) had no
  // mobile UI trigger at all; mirrors desktop's new Archive action, same
  // permission gate as Edit.
  function confirmArchive() {
    Alert.alert(
      'Archive Machine',
      `Archive "${machine!.name}"? It will be removed from the active machine registry and its logs/history are preserved, but there is currently no way to reactivate it from this screen — this cannot be undone without direct database access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: async () => {
            const result = await deleteMachine(machine!.id);
            if (result && 'pendingApproval' in result && result.pendingApproval) {
              Alert.alert('Submitted for Review', result.message || 'This action requires manager approval.');
              return;
            }
            navigation.goBack();
          },
        },
      ],
    );
  }

  const editAction = can('machine.register')
    ? [
        { icon: 'create-outline' as const, label: 'Edit machine', onPress: () => navigation.navigate('MachineForm', { machine }) },
        { icon: 'archive-outline' as const, label: 'Archive machine', onPress: confirmArchive },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={machine.machine_code}
        subtitle={machine.name}
        dark
        onBack={() => navigation.goBack()}
        actions={editAction}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>Machine Code</Text>
            <Text style={styles.codeValue}>{machine.machine_code}</Text>
          </View>
          <Field label="Name"     value={machine.name} />
          <Field label="Category" value={machine.category_name} />
          <Field label="Workshop" value={machine.workshop_name ?? 'Unassigned'} />
          <View style={styles.statusRow}>
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{machine.status}</Text>
            </View>
          </View>
          <Field label="Plate / Fleet No." value={machine.plate_number} />
        </View>

        {/* Specifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          {(machine.production_capacity > 0) ? (
            <Field
              label="Production Capacity"
              value={`${Number(machine.production_capacity).toLocaleString()} ${machine.capacity_unit}/day`}
            />
          ) : null}
          {(Number(machine.fuel_consumption_rate) > 0) ? (
            <Field label="Fuel Consumption" value={`${machine.fuel_consumption_rate} L/hr`} />
          ) : null}
          <Field label="Fuel Type"    value={machine.fuel_type} />
        </View>

        {/* Asset Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asset Info</Text>
          <Field label="Manufacturer"     value={machine.manufacturer} />
          <Field label="Model"            value={machine.model_number} />
          <Field label="Serial Number"    value={machine.serial_number} />
          <Field label="Year Manufactured" value={machine.year_manufactured} />
          <Field label="Date Acquired"    value={machine.date_acquired?.slice(0, 10)} />
        </View>

        {/* Notes */}
        {machine.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{machine.notes}</Text>
          </View>
        ) : null}

        {/* Maintenance Schedules */}
        <View style={styles.section}>
          <View style={styles.schedHeader}>
            <Text style={styles.sectionTitle}>Maintenance Schedules</Text>
            {can('machine.register') ? (
              <TouchableOpacity
                style={styles.addSchedBtn}
                onPress={() => navigation.navigate('MachineMaintScheduleCreate', {
                  machineId: machine.id,
                  machineName: `${machine.machine_code} — ${machine.name}`,
                })}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={16} color={Colors.navy} />
                <Text style={styles.addSchedText}>Add</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {schedules.length > 0
            ? schedules.map((s) => <ScheduleCard key={s.id} s={s} />)
            : <Text style={styles.emptySchedules}>No maintenance schedules defined yet.</Text>}
        </View>

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
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  codeRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  codeValue: { fontFamily: 'monospace', fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },

  field:       { gap: 2 },
  fieldLabel:  { fontSize: Typography.xs, color: Colors.textMuted },
  fieldValue:  { fontSize: Typography.sm, color: Colors.textPrimary },

  statusRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText:  { fontSize: Typography.xs, fontWeight: Typography.medium },

  notesText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },

  schedHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addSchedBtn:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addSchedText: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.medium },
  emptySchedules: { fontSize: Typography.sm, color: Colors.textMuted, fontStyle: 'italic' },

  schedCard:  { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  schedTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  schedType:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  schedFreq:  { fontSize: Typography.xs, color: Colors.textMuted },
  schedRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  schedMeta:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  schedMetaText: { fontSize: Typography.xs, color: Colors.textMuted },
  schedNotes: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
