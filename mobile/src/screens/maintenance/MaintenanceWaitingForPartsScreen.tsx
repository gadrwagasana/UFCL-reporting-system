import React from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { useMaintenanceWaitingForParts, MAINT_JOB_STATUS_LABEL } from '../../hooks/useMaintenanceJobs';
import { MaintenanceWaitingForPartsRow } from '../../types/api';
import { MaintenanceJobsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MaintenanceJobsStackParamList, 'MaintenanceWaitingForParts'>;

// Stabilization Phase 5 (F-28) — useMaintenanceWaitingForParts had a working
// hook and REST route with no screen calling it; desktop's equivalent view
// (renderWaitingView in renderer/app.js) is the field-set this mirrors.

function WaitingCard({ item, onPress }: { item: MaintenanceWaitingForPartsRow; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.card} onPress={onPress} activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, waiting for parts, ${item.machine_code} ${item.machine_name}${item.delay_reason ? `. Reason: ${item.delay_reason}` : ''}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <StatusBadge status="waiting_parts" label={MAINT_JOB_STATUS_LABEL.waiting_parts} size="sm" />
      </View>
      <Text style={styles.machine} numberOfLines={1}>
        {item.machine_code} — {item.machine_name}{item.assigned_to_name ? ` · ${item.assigned_to_name}` : ''}
      </Text>
      {item.delay_reason ? (
        <Text style={styles.reason} numberOfLines={2}><Text style={styles.reasonLabel}>Reason: </Text>{item.delay_reason}</Text>
      ) : null}
      {item.item_name ? (
        <Text style={styles.partLine} numberOfLines={2}>
          <Text style={styles.partLabel}>Part: </Text>{item.item_name} · Requested {item.requested_qty}
          {item.approved_qty != null ? ` · Approved ${item.approved_qty}` : ''}
          {item.request_status ? ` · Request: ${item.request_status}` : ''}
          {item.transfer_status ? ` · Transfer: ${item.transfer_status}` : ''}
        </Text>
      ) : (
        <Text style={styles.noPart}>No material request linked yet.</Text>
      )}
    </TouchableOpacity>
  );
}

export function MaintenanceWaitingForPartsScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useMaintenanceWaitingForParts();
  const rows = data?.rows ?? [];

  if (isLoading) return <LoadingState message="Loading blocked jobs…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Waiting for Parts" dark onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load blocked jobs" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="hourglass-outline" title="No jobs waiting for parts" subtitle="Blocked maintenance jobs will appear here." />
          }
          renderItem={({ item }) => (
            <WaitingCard item={item} onPress={() => navigation.navigate('MaintenanceJobDetail', { jobId: item.id })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  machine: { fontSize: Typography.sm, color: Colors.textSecondary },
  reason: { fontSize: Typography.xs, color: Colors.warning },
  reasonLabel: { fontWeight: Typography.semibold },
  partLine: { fontSize: Typography.xs, color: Colors.textSecondary },
  partLabel: { fontWeight: Typography.semibold, color: Colors.textPrimary },
  noPart: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
