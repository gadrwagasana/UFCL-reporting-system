import React, { useState } from 'react';
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
import { DeletionReasonModal } from '../../components/DeletionReasonModal';
import { useCompartmentList, useCompartmentDelete } from '../../hooks/useCompartments';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuthStore }    from '../../stores/authStore';
import { hasPermission }   from '../../utils/permissions';
import type { Compartment, CompartmentMetrics } from '../../types/api';
import { CompartmentsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CompartmentsStackParamList, 'CompartmentsList'>;

function MetricsBanner({ m }: { m: CompartmentMetrics }) {
  return (
    <View style={styles.banner}>
      {[
        { label: 'Total',     value: String(m.total) },
        { label: 'Active',    value: String(m.active) },
        { label: 'Area (ha)', value: m.totalAreaHa.toFixed(1) },
        { label: 'Volume m³', value: m.totalVolumeM3.toFixed(0) },
        { label: 'Harv. m³', value: m.totalHarvestedM3.toFixed(1) },
      ].map(({ label, value }) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%` as any }]} />
    </View>
  );
}

function CompartmentRow({
  item,
  canManage,
  isSupervisor,
  onEdit,
  onDelete,
}: {
  item:         Compartment;
  canManage:    boolean;
  isSupervisor: boolean;
  onEdit:       (c: Compartment) => void;
  onDelete:     (c: Compartment) => void;
}) {
  const pct = item.volume_m3 > 0
    ? Math.min(100, Math.round((item.volume_harvested_m3 / item.volume_m3) * 100))
    : 0;
  const isActive = item.status === 'Active';

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowTitle}>
          <Text style={styles.comptName}>{item.compt_name}</Text>
          {item.sub_name ? <Text style={styles.subName}>{item.sub_name}</Text> : null}
          {item.pending_deletion && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending Deletion</Text>
            </View>
          )}
        </View>
        <View style={styles.rowActions}>
          {(canManage || isSupervisor) && (
            <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={17} color={Colors.navy} />
            </TouchableOpacity>
          )}
          {(canManage || isSupervisor) && (
            <TouchableOpacity onPress={() => onDelete(item)} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={17} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.rowMeta}>
        <View style={styles.speciesBadge}>
          <Text style={styles.speciesText}>{item.species}</Text>
        </View>
        <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.completedBadge]}>
          <Text style={[styles.statusText, isActive ? styles.activeText : styles.completedText]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.metaText}>{Number(item.area_ha).toFixed(2)} ha</Text>
      </View>

      <View style={styles.volumeRow}>
        <Text style={styles.volumeText}>
          {Number(item.volume_harvested_m3).toFixed(1)} / {Number(item.volume_m3).toFixed(1)} m³
        </Text>
        <Text style={styles.pctText}>{pct}%</Text>
      </View>
      <ProgressBar pct={pct} />

      <Text style={styles.dateText}>{item.entry_date}</Text>
    </View>
  );
}

export function CompartmentsListScreen() {
  const navigation  = useNavigation<NavProp>();
  const { isOnline } = useOfflineStore();
  const role        = useAuthStore(s => s.user?.role ?? '');
  const canCreate   = hasPermission(role as any, 'compartment.create');
  const canManage   = hasPermission(role as any, 'compartment.manage');
  const isSupervisor = role === 'supervisor';

  const { data, isLoading, isError, refetch, isRefetching } = useCompartmentList();
  const { deleteCompartment } = useCompartmentDelete();

  const rows    = data?.rows    ?? [];
  const metrics = data?.metrics ?? { total: 0, active: 0, totalAreaHa: 0, totalVolumeM3: 0, totalHarvestedM3: 0 };

  // DeletionReasonModal state
  const [modalTarget, setModalTarget]   = useState<Compartment | null>(null);
  const [modalDeleting, setModalDeleting] = useState(false);
  // For direct delete (admin/ceo/operations) we also collect a reason via the modal
  const [modalMode, setModalMode]       = useState<'manage' | 'supervisor'>('supervisor');

  function openDeleteModal(item: Compartment, mode: 'manage' | 'supervisor') {
    if (!isOnline) { Alert.alert('Online Required', 'Deleting requires an active connection.'); return; }
    setModalMode(mode);
    setModalTarget(item);
  }

  async function handleDeleteConfirm(reason: string) {
    if (!modalTarget) return;
    setModalDeleting(true);
    try {
      const result = await deleteCompartment({
        id:        modalTarget.id,
        reason,
        entityRef: modalTarget.compt_name,
      }) as any;
      if (result?.pendingApproval) {
        Alert.alert('Submitted', result.message ?? 'Deletion request submitted for approval.');
      }
      setModalTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not process deletion.');
    } finally {
      setModalDeleting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading compartments…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load compartments" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Compartments"
        dark
        actions={canCreate ? [{ icon: 'add-outline', onPress: () => navigation.navigate('CompartmentForm', {}) }] : []}
      />

      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={<MetricsBanner m={metrics} />}
        ListEmptyComponent={
          <EmptyState icon="location-outline" title="No compartments" subtitle="No forest compartments have been registered." />
        }
        renderItem={({ item }) => (
          <CompartmentRow
            item={item}
            canManage={canManage}
            isSupervisor={isSupervisor}
            onEdit={c => navigation.navigate('CompartmentForm', { compartment: c })}
            onDelete={c => openDeleteModal(c, isSupervisor ? 'supervisor' : 'manage')}
          />
        )}
      />

      <DeletionReasonModal
        visible={modalTarget !== null}
        title={modalMode === 'supervisor' ? 'Reason Required' : 'Delete Compartment'}
        message={
          modalMode === 'supervisor'
            ? 'Please provide a reason for this deletion request. A manager must approve before the compartment is removed.'
            : 'This will soft-delete the compartment. Provide a reason for the audit log.'
        }
        confirmLabel={modalMode === 'supervisor' ? 'Submit Request' : 'Delete'}
        loading={modalDeleting}
        onCancel={() => setModalTarget(null)}
        onConfirm={handleDeleteConfirm}
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
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  row: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  rowTop:    { flexDirection: 'row', alignItems: 'flex-start' },
  rowTitle:  { flex: 1, gap: 2 },
  comptName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  subName:   { fontSize: Typography.xs, color: Colors.textMuted },

  pendingBadge:     { alignSelf: 'flex-start', backgroundColor: Colors.error + '20', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  pendingBadgeText: { fontSize: 10, color: Colors.error, fontWeight: Typography.medium },

  rowActions: { flexDirection: 'row', gap: Spacing.xs },
  iconBtn:    { padding: Spacing.xs },

  rowMeta:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  speciesBadge: { backgroundColor: Colors.navy + '15', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  speciesText:  { fontSize: 11, color: Colors.navy, fontWeight: Typography.medium },
  statusBadge:  { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  activeBadge:    { borderColor: Colors.success },
  completedBadge: { borderColor: Colors.border },
  statusText:     { fontSize: 10, fontWeight: Typography.medium },
  activeText:     { color: Colors.success },
  completedText:  { color: Colors.textMuted },
  metaText:       { fontSize: Typography.xs, color: Colors.textSecondary },

  volumeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeText: { fontSize: Typography.xs, color: Colors.textSecondary },
  pctText:    { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.navy },

  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.success, borderRadius: Radius.full },

  dateText: { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },
});
