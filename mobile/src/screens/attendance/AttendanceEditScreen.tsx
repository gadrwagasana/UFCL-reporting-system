import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, parseISO, isValid } from 'date-fns';
import { AppHeader } from '../../components/AppHeader';
import { ReasonModal } from '../../components/ReasonModal';
import { useAttendanceUpdate, useAttendanceDelete } from '../../hooks/useAttendance';
import { AttendanceStatus } from '../../types/api';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'AttendanceEdit'>;
type RoutePropT = RouteProp<CasualLabourStackParamList, 'AttendanceEdit'>;

const STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Off Day'];

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const dt = value ? parseISO(`2000-01-01T${value}:00`) : new Date(2000, 0, 1, 8, 0);
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={s.timeTrigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
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

export function AttendanceEditScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropT>();
  const { record } = route.params;
  const { updateAttendance } = useAttendanceUpdate();
  const { deleteAttendance } = useAttendanceDelete();

  const dateOnly = record.attendance_date.split('T')[0];
  const [status, setStatus] = useState<AttendanceStatus>(record.status);
  const [checkIn, setCheckIn] = useState(record.check_in ? format(parseISO(record.check_in), 'HH:mm') : '');
  const [checkOut, setCheckOut] = useState(record.check_out ? format(parseISO(record.check_out), 'HH:mm') : '');
  const [notes, setNotes] = useState(record.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const res = await updateAttendance(record.id, {
        status,
        check_in: checkIn ? `${dateOnly}T${checkIn}:00` : null,
        check_out: checkOut ? `${dateOnly}T${checkOut}:00` : null,
        notes: notes.trim() || null,
      });
      if (!res.ok) { Alert.alert('Error', res.error ?? 'Could not save.'); return; }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not correct this record.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(reason: string) {
    setDeleting(true);
    try {
      const res = await deleteAttendance(record.id, reason || undefined);
      if (!res.ok) { Alert.alert('Error', res.error ?? 'Could not void this record.'); return; }
      setShowDelete(false);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not void this record.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Correct Attendance"
        dark
        onBack={() => navigation.goBack()}
        actions={[{ icon: 'trash-outline' as const, label: 'Void record', onPress: () => setShowDelete(true) }]}
      />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.section}>
          <Text style={s.personName}>{record.person_name}</Text>
          <Text style={s.meta}>{record.attendance_date} · {record.person_type === 'user' ? 'Employee' : 'Casual Worker'} · {record.workshop_name ?? '—'}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Status</Text>
          <View style={s.statusRow}>
            {STATUSES.map((st) => (
              <TouchableOpacity
                key={st}
                style={[s.pill, status === st && s.pillActive]}
                onPress={() => setStatus(st)}
                activeOpacity={0.75}
              >
                <Text style={[s.pillText, status === st && s.pillTextActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[s.section, { flexDirection: 'row', gap: Spacing.base }]}>
          <TimeField label="Check-in" value={checkIn} onChange={setCheckIn} />
          <TimeField label="Check-out" value={checkOut} onChange={setCheckOut} />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Notes</Text>
          <TextInput style={s.notesInput} value={notes} onChangeText={setNotes} placeholder="Notes" multiline numberOfLines={3} />
        </View>

        <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSave} disabled={submitting} activeOpacity={0.8}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitText}>Save Correction</Text>}
        </TouchableOpacity>
      </ScrollView>

      <ReasonModal
        visible={showDelete}
        title="Void Attendance Record"
        message={`This permanently voids the attendance record for ${record.person_name} on ${dateOnly}. Provide a reason for the audit trail:`}
        confirmLabel="Void"
        loading={deleting}
        onCancel={() => setShowDelete(false)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  personName: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  meta: { fontSize: Typography.xs, color: Colors.textMuted },

  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillText: { fontSize: 12, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white, fontWeight: Typography.semibold },

  timeTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  timeText: { fontSize: Typography.base, color: Colors.textPrimary },

  notesInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary, minHeight: 70, textAlignVertical: 'top' },

  submitBtn: { backgroundColor: Colors.navy, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
