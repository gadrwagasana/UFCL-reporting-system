import React from 'react';
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
import { useMachineList } from '../../hooks/useMachines';
import { Machine, MachineMetrics } from '../../types/api';
import { MachinesStackParamList }   from '../../navigation/types';
import { hasPermission } from '../../utils/permissions';
import { useAuthStore }  from '../../stores/authStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MachinesStackParamList, 'MachinesList'>;

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

function MetricsBanner({ m }: { m: MachineMetrics }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{m.total}</Text>
        <Text style={styles.bannerLabel}>Total</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: Colors.success }]}>{m.available}</Text>
        <Text style={styles.bannerLabel}>Available</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: Colors.navy }]}>{m.running}</Text>
        <Text style={styles.bannerLabel}>Running</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, m.offline > 0 && { color: Colors.error }]}>{m.offline}</Text>
        <Text style={styles.bannerLabel}>Offline</Text>
      </View>
    </View>
  );
}

function MachineCard({ item, onPress }: { item: Machine; onPress: () => void }) {
  const statusColor = STATUS_COLOR[item.status] ?? Colors.textSecondary;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.code}>{item.machine_code}</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.machineName}>{item.name}</Text>
      <View style={styles.metaRow}>
        <View style={styles.catBadge}>
          <Text style={styles.catText}>{item.category_name}</Text>
        </View>
        {item.workshop_name
          ? <Text style={styles.workshop}>{item.workshop_name}</Text>
          : <Text style={styles.unassigned}>Unassigned</Text>}
      </View>
      {item.next_maintenance ? (
        <View style={styles.maintRow}>
          <Ionicons name="calendar-outline" size={12} color={dateColor(item.next_maintenance)} />
          <Text style={[styles.maintText, { color: dateColor(item.next_maintenance) }]}>
            Next maintenance: {item.next_maintenance.slice(0, 10)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function MachinesListScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);

  const { data, isLoading, isError, refetch, isRefetching } = useMachineList();
  const machines   = data?.machines   ?? [];
  const metrics    = data?.metrics    ?? { total: 0, available: 0, running: 0, offline: 0 };

  const headerActions = [];
  if (can('machine.cats')) {
    headerActions.push({ icon: 'pricetag-outline' as const, onPress: () => navigation.navigate('MachineCategories') });
  }
  if (can('machine.register')) {
    headerActions.push({ icon: 'add' as const, onPress: () => navigation.navigate('MachineForm', {}) });
  }

  if (isLoading) return <LoadingState message="Loading machine registry…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Machine Registry" dark actions={headerActions} />

      {isError ? (
        <ErrorState message="Could not load machines" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={machines}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={machines.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={<MetricsBanner m={metrics} />}
          ListEmptyComponent={
            <EmptyState icon="settings-outline" title="No machines" subtitle="No machines registered yet." />
          }
          renderItem={({ item }) => (
            <MachineCard item={item} onPress={() => navigation.navigate('MachineDetail', { machineId: item.id })} />
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

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginHorizontal: Spacing.base, marginTop: Spacing.base, ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: Colors.border },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  bannerLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code:        { fontFamily: 'monospace', fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  statusBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText:  { fontSize: Typography.xs, fontWeight: Typography.medium },
  machineName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catBadge:    { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  catText:     { fontSize: Typography.xs, color: Colors.textSecondary },
  workshop:    { fontSize: Typography.xs, color: Colors.textMuted },
  unassigned:  { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  maintRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  maintText:   { fontSize: Typography.xs },
});
