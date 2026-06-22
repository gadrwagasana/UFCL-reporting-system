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
import { useMachineFuelList } from '../../hooks/useMachineFuel';
import { MachineFuelLog }     from '../../types/api';
import { MachineFuelStackParamList } from '../../navigation/types';
import { hasPermission } from '../../utils/permissions';
import { useAuthStore }   from '../../stores/authStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<MachineFuelStackParamList, 'MachineFuelList'>;

function FuelCard({ entry, onPress }: { entry: MachineFuelLog; onPress: () => void }) {
  const targetName = entry.machine_name ?? entry.plate_number ?? '—';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.qty}>{entry.quantity} {entry.unit}</Text>
        <Text style={styles.date}>{entry.date_fmt}</Text>
      </View>
      <Text style={styles.target}>{targetName}</Text>
      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons name="water-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText}>{entry.fuel_type}</Text>
        </View>
        {entry.operator && (
          <View style={styles.meta}>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.operator}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function MachineFuelListScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);
  const { data, isLoading, isError, refetch, isRefetching } = useMachineFuelList();
  const logs = data?.rows ?? [];

  if (isLoading) return <LoadingState message="Loading fuel logs…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Machine Fuel"
        dark
        actions={can('fuel.machine') ? [{ icon: 'add', onPress: () => navigation.navigate('MachineFuelCreate') }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load fuel logs" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={logs.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="water-outline" title="No fuel logs" subtitle="No machine fuel logs found." />
          }
          renderItem={({ item }) => (
            <FuelCard entry={item} onPress={() => navigation.navigate('MachineFuelDetail', { entry: item })} />
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

  card:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qty:     { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.navy },
  date:    { fontSize: Typography.xs, color: Colors.textMuted },
  target:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', gap: Spacing.base },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
});
