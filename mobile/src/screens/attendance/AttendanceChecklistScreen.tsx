import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, parseISO, isValid } from 'date-fns';
import { AppHeader }        from '../../components/AppHeader';
import { LoadingState }     from '../../components/LoadingState';
import { ErrorState }       from '../../components/ErrorState';
import { DatePickerField }  from '../../components/DatePickerField';
import { FormSelect }       from '../../components/FormSelect';
import { useAuth }          from '../../hooks/useAuth';
import { useWorkshopList }  from '../../hooks/useWorkshops';
import { useAttendanceRoster, useAttendanceMark, useAttendanceDashboard } from '../../hooks/useAttendance';
import { AttendanceRosterRow, AttendanceStatus, AttendancePersonType } from '../../types/api';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'AttendanceChecklist'>;

const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Off Day'];
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  Present: Colors.success, Absent: Colors.error, Late: Colors.warning,
  'Half Day': Colors.warning, Leave: Colors.info, 'Off Day': Colors.textMuted,
};

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const dt = value ? parseISO(`2000-01-01T${value}:00`) : new Date(2000, 0, 1, 8, 0);
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.timeLabel}>{label}</Text>
      <TouchableOpacity style={s.timeTrigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
        <Text style={s.timeText}>{value || '--:--'}</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={open}
        mode="time"
        date={isValid(dt) ? dt : new Date()}
        onConfirm={(d) => { setOpen(false); onChange(format(d, 'HH:mm')); }}
        onCancel={() => setOpen(false)}
      />
    </View>
  );
}

function RosterRow({
  row, personType, date, workshopId, onSaved,
}: {
  row: AttendanceRosterRow; personType: AttendancePersonType; date: string; workshopId: number | null;
  onSaved: () => void;
}) {
  const [status, setStatus]   = useState<AttendanceStatus>(row.status ?? 'Present');
  const [checkIn, setCheckIn] = useState(row.check_in ? format(parseISO(row.check_in), 'HH:mm') : '');
  const [checkOut, setCheckOut] = useState(row.check_out ? format(parseISO(row.check_out), 'HH:mm') : '');
  const [notes, setNotes]     = useState(row.notes ?? '');
  const [saving, setSaving]   = useState(false);
  const { markAttendance } = useAttendanceMark();

  async function save(newStatus?: AttendanceStatus) {
    setSaving(true);
    try {
      await markAttendance({
        person_type: personType, person_id: row.person_id, attendance_date: date, workshop_id: workshopId,
        status: newStatus ?? status,
        check_in: checkIn ? `${date}T${checkIn}:00` : null,
        check_out: checkOut ? `${date}T${checkOut}:00` : null,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.row}>
      <View style={s.rowHeader}>
        <Text style={s.rowName} numberOfLines={1}>{row.name}</Text>
        {row.sub_label ? <Text style={s.rowSub} numberOfLines={1}>{row.sub_label}</Text> : null}
      </View>
      <View style={s.statusPills}>
        {STATUSES.map((st) => (
          <TouchableOpacity
            key={st}
            style={[s.pill, status === st && { backgroundColor: STATUS_COLOR[st] }]}
            onPress={() => { setStatus(st); save(st); }}
            disabled={saving}
            activeOpacity={0.75}
          >
            <Text style={[s.pillText, status === st && s.pillTextActive]}>{st}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.timesRow}>
        <TimeField label="Check-in" value={checkIn} onChange={setCheckIn} />
        <TimeField label="Check-out" value={checkOut} onChange={setCheckOut} />
      </View>
      <TextInput
        style={s.notesInput}
        placeholder="Notes (optional)"
        placeholderTextColor={Colors.textMuted}
        value={notes}
        onChangeText={setNotes}
      />
      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={() => save()} disabled={saving} activeOpacity={0.8}>
        <Ionicons name="save-outline" size={14} color={Colors.white} />
        <Text style={s.saveBtnText}>{row.attendance_id ? 'Update' : 'Save'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function AttendanceChecklistScreen() {
  const navigation = useNavigation<NavProp>();
  const { workshopId: myWorkshopId } = useAuth();
  const restricted = myWorkshopId != null;

  const [workshopId, setWorkshopId] = useState<number | null>(myWorkshopId);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: wsData } = useWorkshopList();
  const workshops = (wsData?.allWarehouses ?? []).map(w => ({ label: w.name, value: w.id }));

  const { data, isLoading, isError, refetch } = useAttendanceRoster(workshopId, date);
  const { data: dash } = useAttendanceDashboard(workshopId);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Attendance Checklist"
        dark
        onBack={() => navigation.goBack()}
        actions={[{ icon: 'list-outline' as const, label: 'History & Reports', onPress: () => navigation.navigate('AttendanceHistory') }]}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {dash?.ok && (
          <View style={s.kpiRow}>
            <View style={s.kpi}><Text style={s.kpiVal}>{dash.present}</Text><Text style={s.kpiLbl}>Present</Text></View>
            <View style={s.kpi}><Text style={s.kpiVal}>{dash.absent}</Text><Text style={s.kpiLbl}>Absent</Text></View>
            <View style={s.kpi}><Text style={s.kpiVal}>{dash.late}</Text><Text style={s.kpiLbl}>Late</Text></View>
            <View style={s.kpi}><Text style={s.kpiVal}>{dash.unmarked}</Text><Text style={s.kpiLbl}>Unmarked</Text></View>
          </View>
        )}

        <View style={s.filterRow}>
          {!restricted && (
            <View style={{ flex: 1 }}>
              <FormSelect label="Workshop" options={workshops} value={workshopId} onChange={(v) => setWorkshopId(Number(v))} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <DatePickerField label="Date" value={date} onChange={setDate} maxDate={new Date()} />
          </View>
        </View>

        {!workshopId ? (
          <Text style={s.emptyText}>Select a workshop to load its attendance roster.</Text>
        ) : isLoading ? (
          <LoadingState message="Loading roster…" />
        ) : isError || !data?.ok ? (
          <ErrorState message="Could not load roster" onRetry={refetch} />
        ) : (
          <>
            {data.employees.length > 0 && <Text style={s.sectionTitle}>Employees</Text>}
            {data.employees.map((r) => (
              <RosterRow key={`u-${r.person_id}`} row={r} personType="user" date={date} workshopId={workshopId} onSaved={refetch} />
            ))}
            {data.casuals.length > 0 && <Text style={s.sectionTitle}>Casual Workers</Text>}
            {data.casuals.map((r) => (
              <RosterRow key={`c-${r.person_id}`} row={r} personType="casual" date={date} workshopId={workshopId} onSaved={refetch} />
            ))}
            {data.employees.length === 0 && data.casuals.length === 0 && (
              <Text style={s.emptyText}>No active employees or casual workers registered at this workshop.</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  kpiRow: { flexDirection: 'row', backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm, marginBottom: Spacing.xs },
  kpi: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.white },
  kpiLbl: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: Spacing.sm },

  sectionTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.sm },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },

  row: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  rowSub: { fontSize: Typography.xs, color: Colors.textMuted },

  statusPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  pillText: { fontSize: 11, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white, fontWeight: Typography.semibold },

  timesRow: { flexDirection: 'row', gap: Spacing.base },
  timeLabel: { fontSize: 11, color: Colors.textMuted },
  timeTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  timeText: { fontSize: Typography.sm, color: Colors.textPrimary },

  notesInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: Typography.sm, color: Colors.textPrimary },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, alignSelf: 'flex-start', paddingHorizontal: Spacing.base },
  saveBtnText: { color: Colors.white, fontSize: Typography.sm, fontWeight: Typography.semibold },
});
