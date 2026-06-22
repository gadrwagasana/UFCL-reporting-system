import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { usePolesList }  from '../../hooks/usePoles';
import { useAuth }       from '../../hooks/useAuth';
import { PolesDelivery } from '../../types/api';
import { PolesQCStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<PolesQCStackParamList, 'PolesQCList'>;

function DeliveryQCCard({
  item, onPress,
}: { item: PolesDelivery; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.dateText}>{item.delivery_date}</Text>
        <View style={styles.actionHint}>
          <Text style={styles.actionText}>Tap to QC</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.navy} />
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="cube-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.statText}>{item.delivered_qty} poles delivered</Text>
        </View>
      </View>
      {item.supplier_name && <Text style={styles.meta}>{item.supplier_name}</Text>}
      {item.delivery_note_ref && <Text style={styles.meta}>Ref: {item.delivery_note_ref}</Text>}
    </TouchableOpacity>
  );
}

export function PolesQCListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = usePolesList();

  const pendingDeliveries = useMemo(
    () => (data?.deliveries ?? []).filter((d) => d.status !== 'quality_checked'),
    [data],
  );

  if (!can('poles.qc')) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <AppHeader title="Quality Check" dark />
        <EmptyState icon="lock-closed-outline" title="No access" subtitle="You do not have quality check permissions." />
      </SafeAreaView>
    );
  }

  if (isLoading) return <LoadingState message="Loading deliveries…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Quality Check" dark />

      {isError ? (
        <ErrorState message="Could not load deliveries" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={pendingDeliveries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={pendingDeliveries.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="All deliveries quality-checked"
              subtitle="No pending QC items."
            />
          }
          renderItem={({ item }) => (
            <DeliveryQCCard
              item={item}
              onPress={() => navigation.navigate('PolesQCDetail', { delivery: item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, borderLeftWidth: 3, borderLeftColor: Colors.warning, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },

  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  statsRow: { flexDirection: 'row', gap: Spacing.md },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.sm, color: Colors.textSecondary },
  meta:     { fontSize: Typography.xs, color: Colors.textMuted },
});
