import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { FormSelect }   from '../../components/FormSelect';
import { useMachineLogList } from '../../hooks/useMachineLog';
import { MachineLog }        from '../../types/api';
import { MachineLogStackParamList } from '../../navigation/types';
import { hasPermission } from '../../utils/permissions';
import { useAuthStore }   from '../../stores/authStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MachineLogStackParamList, 'MachineLogList'>;

const TODAY = new Date().toISOString().split('T')[0];

function LogCard({ entry, onPress }: { entry: MachineLog; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.machineName}>{entry.machine_name ?? entry.machine_code ?? '—'}</Text>
        <Text style={styles.date}>{entry.log_date}</Text>
      </View>
      {entry.shift && (
        <View style={styles.shiftBadge}>
          <Text style={styles.shiftText}>{entry.shift}</Text>
        </View>
      )}
      <View style={styles.metricsRow}>
        {entry.hours_worked != null && (
          <View style={styles.metric}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metricText}>{entry.hours_worked}h worked</Text>
          </View>
        )}
        {entry.fuel_consumed != null && (
          <View style={styles.metric}>
            <Ionicons name="water-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metricText}>{entry.fuel_consumed}L fuel</Text>
          </View>
        )}
        {entry.loading_trips != null && (
          <View style={styles.metric}>
            <Ionicons name="repeat-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metricText}>{entry.loading_trips} trips</Text>
          </View>
        )}
      </View>
      {entry.downtime_hours != null && entry.downtime_hours > 0 && (
        <View style={styles.downtimeBadge}>
          <Ionicons name="warning-outline" size={12} color={Colors.warning} />
          <Text style={styles.downtimeText}>{entry.downtime_hours}h downtime</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function MachineLogListScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);
  const [machineFilter, setMachineFilter] = useState<number | undefined>(undefined);

  const { data, isLoading, isError, refetch, isRefetching } = useMachineLogList(machineFilter);
  const logs     = data?.rows ?? [];
  const machines = data?.machines ?? [];

  const machineOptions = machines.map((m) => ({
    label: m.name + (m.machine_code ? ` (${m.machine_code})` : ''),
    value: String(m.id),
  }));

  // Dashboard stats for today
  const todayLogs     = useMemo(() => logs.filter((l) => l.log_date === TODAY), [logs]);
  const todayFuel     = useMemo(() => todayLogs.reduce((sum, l) => sum + (l.fuel_consumed ?? 0), 0), [todayLogs]);
  const todayDowntime = useMemo(() => todayLogs.reduce((sum, l) => sum + (l.downtime_hours ?? 0), 0), [todayLogs]);

  if (isLoading) return <LoadingState message="Loading machine logs…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Machine Logs"
        dark
        actions={can('machine.log') ? [{ icon: 'add', onPress: () => navigation.navigate('MachineLogCreate') }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load machine logs" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={logs.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {/* Today stats */}
              <View style={styles.banner}>
                <View style={styles.bannerStat}>
                  <Text style={styles.bannerValue}>{todayLogs.length}</Text>
                  <Text style={styles.bannerLabel}>Today's Logs</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerStat}>
                  <Text style={styles.bannerValue}>{todayFuel}L</Text>
                  <Text style={styles.bannerLabel}>Fuel Today</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerStat}>
                  <Text style={[styles.bannerValue, todayDowntime > 0 && { color: Colors.warning }]}>{todayDowntime}h</Text>
                  <Text style={styles.bannerLabel}>Downtime</Text>
                </View>
              </View>

              {/* Machine filter */}
              {machines.length > 0 && (
                <View style={styles.filterPicker}>
                  <FormSelect
                    label="Filter by Machine"
                    value={machineFilter !== undefined ? String(machineFilter) : ''}
                    options={[{ label: 'All Machines', value: '' }, ...machineOptions]}
                    onChange={(v) => setMachineFilter(v ? Number(v) : undefined)}
                  />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="cog-outline" title="No logs" subtitle="No machine daily logs found." />
          }
          renderItem={({ item }) => (
            <LogCard entry={item} onPress={() => navigation.navigate('MachineLogDetail', { entry: item })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: Spacing.base },
  header:         { gap: Spacing.sm },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: 0, ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: Colors.border },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  bannerLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  filterPicker: { paddingHorizontal: 0 },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  machineName:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  date:         { fontSize: Typography.xs, color: Colors.textMuted },
  shiftBadge:   { alignSelf: 'flex-start', backgroundColor: Colors.navy + '1A', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  shiftText:    { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  metricsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metric:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricText:   { fontSize: Typography.xs, color: Colors.textMuted },
  downtimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  downtimeText:  { fontSize: Typography.xs, color: Colors.warning },
});
