import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, Alert, TouchableOpacity,
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
import { useWorkshopList, useWorkshopDelete } from '../../hooks/useWorkshops';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuthStore }    from '../../stores/authStore';
import { hasPermission }   from '../../utils/permissions';
import type { Workshop, WorkshopMetrics } from '../../types/api';
import { WorkshopManagementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<WorkshopManagementStackParamList, 'WorkshopsList'>;

function MetricsBanner({ metrics }: { metrics: WorkshopMetrics }) {
  return (
    <View style={styles.banner}>
      {[
        { label: 'Total',    value: metrics.total },
        { label: 'Active',   value: metrics.active },
        { label: 'Inactive', value: metrics.inactive },
        { label: 'Capacity', value: metrics.capacity > 0 ? metrics.capacity.toLocaleString() : '—' },
      ].map(({ label, value }) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function WorkshopRow({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item:      Workshop;
  canManage: boolean;
  onEdit:    (w: Workshop) => void;
  onDelete:  (w: Workshop) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowName}>{item.name}</Text>
          <View style={[styles.statusBadge, item.active ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, item.active ? styles.activeText : styles.inactiveText]}>
              {item.active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        {item.workshop_type ? <Text style={styles.rowType}>{item.workshop_type}</Text> : null}
        {item.location      ? <Text style={styles.rowMeta}>{item.location}</Text>       : null}
        {item.capacity      ? <Text style={styles.rowMeta}>Capacity: {item.capacity.toLocaleString()}</Text> : null}
      </View>
      {canManage && (
        <View style={styles.rowActions}>
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={18} color={Colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function WorkshopsListScreen() {
  const navigation = useNavigation<NavProp>();
  const { isOnline } = useOfflineStore();
  const role     = useAuthStore(s => s.user?.role ?? 'storekeeper');
  const canManage = hasPermission(role as any, 'workshop.manage');

  const { data, isLoading, isError, refetch, isRefetching } = useWorkshopList();
  const { deleteWorkshop } = useWorkshopDelete();

  const workshops = data?.workshops ?? [];
  const metrics   = data?.metrics   ?? { total: 0, active: 0, inactive: 0, capacity: 0 };

  function confirmDelete(item: Workshop) {
    if (!isOnline) { Alert.alert('Online Required', 'Deleting requires a connection.'); return; }
    Alert.alert(
      'Delete Workshop',
      `Delete "${item.name}"? This will cascade stock levels. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkshop(item.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not delete workshop.');
            }
          },
        },
      ],
    );
  }

  if (isLoading) return <LoadingState message="Loading workshops…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load workshops" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Workshops"
        dark
        actions={canManage ? [{ icon: 'add-outline', onPress: () => navigation.navigate('WorkshopForm', {}) }] : []}
      />

      <FlatList
        data={workshops}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={<MetricsBanner metrics={metrics} />}
        ListEmptyComponent={
          <EmptyState icon="business-outline" title="No workshops" subtitle="No workshops have been registered." />
        }
        renderItem={({ item }) => (
          <WorkshopRow
            item={item}
            canManage={canManage}
            onEdit={w => navigation.navigate('WorkshopForm', { workshop: w })}
            onDelete={confirmDelete}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm, marginBottom: Spacing.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.5 },

  row: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm, ...Shadow.sm,
  },
  rowInfo:     { flex: 1, gap: 2 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName:     { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowType:     { fontSize: Typography.xs, color: Colors.textMuted },
  rowMeta:     { fontSize: Typography.xs, color: Colors.textSecondary },
  rowActions:  { flexDirection: 'column', gap: Spacing.xs },
  iconBtn:     { padding: Spacing.xs },

  statusBadge:   { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  activeBadge:   { borderColor: Colors.success },
  inactiveBadge: { borderColor: Colors.border },
  statusText:    { fontSize: 10, fontWeight: Typography.medium },
  activeText:    { color: Colors.success },
  inactiveText:  { color: Colors.textMuted },
});
