import React, { useState } from 'react';
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
import { useVehicleFuelList } from '../../hooks/useVehicleFuel';
import { useDeliveryList }    from '../../hooks/useDeliveries';
import { FuelLog, MetaVehicle } from '../../types/api';
import { VehicleFuelStackParamList } from '../../navigation/types';
import { hasPermission } from '../../utils/permissions';
import { useAuthStore }   from '../../stores/authStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<VehicleFuelStackParamList, 'VehicleFuelList'>;

function FuelCard({ entry, onPress }: { entry: FuelLog; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.liters}>{entry.liters} L</Text>
        <Text style={styles.date}>{entry.log_date}</Text>
      </View>
      {entry.total_cost != null && (
        <Text style={styles.cost}>TZS {entry.total_cost.toLocaleString()}</Text>
      )}
      <View style={styles.metaRow}>
        {entry.cost_per_liter != null && (
          <View style={styles.meta}>
            <Ionicons name="pricetag-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.cost_per_liter}/L</Text>
          </View>
        )}
        {entry.odometer != null && (
          <View style={styles.meta}>
            <Ionicons name="speedometer-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.odometer} km</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function VehicleFuelListScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const can  = (perm: Parameters<typeof hasPermission>[1]) => !!user && hasPermission(user.role, perm);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  // Vehicles list comes from the delivery list endpoint (same metadata)
  const { data: deliveryData, isLoading: vehiclesLoading } = useDeliveryList();
  const vehicles: MetaVehicle[] = deliveryData?.vehicles ?? [];

  const vehicleOptions = vehicles.map((v) => ({
    label: `${v.registration}${v.driver_assigned ? ` — ${v.driver_assigned}` : ''}`,
    value: String(v.id),
  }));

  const { data, isLoading, isError, refetch, isRefetching } = useVehicleFuelList(selectedVehicleId);
  const logs = data?.rows ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Vehicle Fuel"
        dark
        actions={can('fuel.vehicle') ? [{ icon: 'add', onPress: () => navigation.navigate('VehicleFuelCreate') }] : []}
      />

      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={logs.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <View style={styles.vehiclePicker}>
            <FormSelect
              label="Select Vehicle"
              value={selectedVehicleId !== null ? String(selectedVehicleId) : ''}
              options={vehicleOptions}
              placeholder="Choose a vehicle to view logs"
              onChange={(v) => setSelectedVehicleId(v ? Number(v) : null)}
            />
          </View>
        }
        ListEmptyComponent={
          vehiclesLoading || isLoading ? (
            <LoadingState message="Loading fuel logs…" fullScreen />
          ) : isError ? (
            <ErrorState message="Could not load fuel logs" onRetry={refetch} fullScreen />
          ) : selectedVehicleId === null ? (
            <EmptyState icon="car-outline" title="Select a vehicle" subtitle="Choose a vehicle above to view its fuel history." />
          ) : (
            <EmptyState icon="water-outline" title="No fuel logs" subtitle="No fuel logs found for this vehicle." />
          )
        }
        renderItem={({ item }) => (
          <FuelCard entry={item} onPress={() => navigation.navigate('VehicleFuelDetail', { entry: item })} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: Spacing.base },
  vehiclePicker:  { padding: Spacing.base, paddingBottom: 0 },

  card:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liters:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.navy },
  date:    { fontSize: Typography.xs, color: Colors.textMuted },
  cost:    { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', gap: Spacing.base },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },
});
