import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { AppHeader }       from '../../components/AppHeader';
import { LoadingState }    from '../../components/LoadingState';
import { ErrorState }      from '../../components/ErrorState';
import { EmptyState }      from '../../components/EmptyState';
import { DatePickerField } from '../../components/DatePickerField';
import { FormSelect }      from '../../components/FormSelect';
import { useAuth } from '../../hooks/useAuth';
import { useAttendanceList, useAttendanceReportFetch } from '../../hooks/useAttendance';
import { AttendanceRecord, AttendanceStatus } from '../../types/api';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'AttendanceHistory'>;

const STATUS_OPTIONS = ['Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Off Day'].map(s => ({ label: s, value: s }));
const TYPE_OPTIONS = [{ label: 'Employee', value: 'user' }, { label: 'Casual Worker', value: 'casual' }];

const STATUS_COLOR: Record<string, string> = {
  Present: Colors.success, Absent: Colors.error, Late: Colors.warning,
  'Half Day': Colors.warning, Leave: Colors.info, 'Off Day': Colors.textMuted,
};

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function RecordCard({ item, onPress }: { item: AttendanceRecord; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.cardName} numberOfLines={1}>{item.person_name}</Text>
        <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[item.status] ?? Colors.textMuted) + '22' }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[item.status] ?? Colors.textMuted }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={s.cardMeta}>{item.attendance_date} · {item.person_type === 'user' ? 'Employee' : 'Casual Worker'} · {item.workshop_name ?? '—'}</Text>
      <Text style={s.cardMeta}>
        {item.check_in ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        {' → '}
        {item.check_out ? new Date(item.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        {item.hours != null ? `  (${item.hours}h)` : ''}
      </Text>
      {item.notes ? <Text style={s.cardNotes} numberOfLines={1}>{item.notes}</Text> : null}
    </TouchableOpacity>
  );
}

export function AttendanceHistoryScreen() {
  const navigation = useNavigation<NavProp>();
  const { workshopId: myWorkshopId } = useAuth();
  const restricted = myWorkshopId != null;

  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [personType, setPersonType] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { fetchReport } = useAttendanceReportFetch();

  const filters = {
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(status ? { status: status as AttendanceStatus } : {}),
    ...(personType ? { person_type: personType as 'user' | 'casual' } : {}),
  };
  const { data, isLoading, isError, refetch, isRefetching } = useAttendanceList(filters);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetchReport(filters);
      if (!res.ok) { Alert.alert('Export failed', 'Could not generate the report.'); return; }
      const header = 'Date,Workshop,Person,Type,Status,Check-in,Check-out,Hours,Notes,Recorded By';
      const lines = [header, ...res.rows.map(r => [
        r.attendance_date, csvEscape(r.workshop_name), csvEscape(r.person_name),
        r.person_type === 'user' ? 'Employee' : 'Casual Worker', r.status,
        r.check_in ? new Date(r.check_in).toLocaleTimeString() : '',
        r.check_out ? new Date(r.check_out).toLocaleTimeString() : '',
        r.hours ?? '', csvEscape(r.notes), csvEscape(r.created_by_name),
      ].join(','))];
      lines.push('', `Total records,${res.summary.totalRecords}`, `Total hours,${res.summary.totalHours}`);
      await Share.share({ message: lines.join('\n'), title: `attendance_report_${format(new Date(), 'yyyy-MM-dd')}.csv` });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Export failed', err?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading attendance history…" fullScreen />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Attendance History"
        dark
        onBack={() => navigation.goBack()}
        actions={[{ icon: exporting ? 'hourglass-outline' as const : 'share-outline' as const, label: 'Export CSV', onPress: handleExport }]}
      />

      {isError ? (
        <ErrorState message="Could not load attendance history" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows?.length ?? 0) === 0 ? s.emptyContainer : s.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <View style={s.filters}>
              <View style={s.filterRow}>
                <View style={{ flex: 1 }}><DatePickerField label="From" value={dateFrom} onChange={setDateFrom} /></View>
                <View style={{ flex: 1 }}><DatePickerField label="To" value={dateTo} onChange={setDateTo} /></View>
              </View>
              <View style={s.filterRow}>
                <View style={{ flex: 1 }}><FormSelect label="Status" options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(String(v))} /></View>
                <View style={{ flex: 1 }}><FormSelect label="Type" options={TYPE_OPTIONS} value={personType} onChange={(v) => setPersonType(String(v))} /></View>
              </View>
              <Text style={s.count}>{(data?.rows?.length ?? 0)} record(s)</Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No attendance records" subtitle="No records match these filters." />}
          renderItem={({ item }) => (
            <RecordCard item={item} onPress={() => navigation.navigate('AttendanceEdit', { record: item })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  filters: { gap: Spacing.sm, marginBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  count: { fontSize: Typography.xs, color: Colors.textMuted },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: Typography.semibold },
  cardMeta: { fontSize: Typography.xs, color: Colors.textSecondary },
  cardNotes: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
