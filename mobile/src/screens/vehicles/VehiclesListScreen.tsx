import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { useVehicleList } from '../../hooks/useVehicles';
import { Vehicle, VehicleStatus } from '../../types/api';
import { VehiclesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<VehiclesStackParamList, 'VehiclesList'>;

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1_000;

function dateColor(isoDate: string | null): string {
  if (!isoDate) return Colors.textMuted;
  const d = new Date(isoDate);
  const now = new Date();
  if (d < now)          return Colors.error;
  if (d.getTime() - now.getTime() < THIRTY_DAYS) return Colors.warning;
  return Colors.textSecondary;
}

function statusStyle(status: VehicleStatus) {
  switch (status) {
    case 'Active':         return { bg: Colors.successBg, text: Colors.success };
    case 'In Maintenance': return { bg: Colors.warningBg, text: Colors.warning };
    default:               return { bg: Colors.statusDraft, text: Colors.statusDraftText };
  }
}

function MetricsBanner({ metrics }: { metrics: { fleet: number; active: number; maintenance: number; fuelCost: number } }) {
  const items = [
    { label: 'Fleet',       value: metrics.fleet },
    { label: 'Active',      value: metrics.active },
    { label: 'Maintenance', value: metrics.maintenance },
    { label: 'Fuel (RWF)',  value: `${metrics.fuelCost.toLocaleString()}` },
  ];
  return (
    <View style={styles.metricsRow}>
      {items.map(({ label, value }) => (
        <View key={label} style={styles.metricCard}>
          <Text style={styles.metricValue}>{value}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const st = statusStyle(vehicle.status);
  const insColor = dateColor(vehicle.insurance_expiry);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardReg}>{vehicle.registration}</Text>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.text }]}>{vehicle.status}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {vehicle.vehicle_category ? (
          <View style={styles.metaItem}>
            <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{vehicle.vehicle_category}</Text>
          </View>
        ) : null}
        {makeModel ? (
          <View style={styles.metaItem}>
            <Ionicons name="construct-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{makeModel}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Ionicons name="shield-outline" size={12} color={insColor} />
          <Text style={[styles.metaText, { color: insColor }]}>
            {vehicle.insurance_expiry
              ? new Date(vehicle.insurance_expiry).toLocaleDateString('en-GB')
              : 'No insurance date'}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.ownerBadge, vehicle.ownership_type === 'Third-Party Car' ? styles.ownerBadgeThird : styles.ownerBadgeCompany]}>
          <Text style={styles.ownerBadgeText}>
            {vehicle.ownership_type === 'Third-Party Car' ? 'Third-Party' : 'Company'}
          </Text>
        </View>
        <Text style={styles.fuelCost}>
          <Ionicons name="flame-outline" size={11} color={Colors.textMuted} />
          {' '}RWF {Math.round(vehicle.total_fuel_cost).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function VehiclesListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useVehicleList();

  const rows    = data?.rows ?? [];
  const metrics = data?.metrics ?? { fleet: 0, active: 0, maintenance: 0, fuelCost: 0, expiredInsurance: 0 };

  if (isLoading) return <LoadingState message="Loading fleet…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Vehicle Fleet"
        dark
        actions={[{
          icon: 'add',
          onPress: () => navigation.navigate('VehicleForm', { vehicle: undefined }),
        }]}
      />

      {isError ? (
        <ErrorState message="Could not load fleet" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
          }
          ListHeaderComponent={
            rows.length > 0 ? (
              <View>
                <MetricsBanner metrics={metrics} />
                {metrics.expiredInsurance > 0 && (
                  <View style={styles.alertBanner}>
                    <Ionicons name="warning-outline" size={16} color={Colors.error} />
                    <Text style={styles.alertText}>
                      <Text style={styles.alertBold}>{metrics.expiredInsurance} vehicle{metrics.expiredInsurance > 1 ? 's' : ''}</Text>
                      {' '}with expired insurance — update before dispatching.
                    </Text>
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="car-outline"
              title="No vehicles"
              subtitle="Tap + to register the first vehicle in the fleet."
            />
          }
          renderItem={({ item }) => (
            <VehicleCard
              vehicle={item}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: Number(item.id) })}
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

  metricsRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  metricCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center', ...Shadow.sm,
  },
  metricValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.navy },
  metricLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm, backgroundColor: Colors.errorBg,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.error,
    marginBottom: Spacing.sm,
  },
  alertText: { flex: 1, fontSize: Typography.sm, color: Colors.error, lineHeight: 18 },
  alertBold: { fontWeight: Typography.bold },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardReg: {
    fontSize: Typography.lg, fontWeight: Typography.bold,
    color: Colors.textPrimary, fontFamily: 'monospace',
  },
  badge:     { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: Typography.semibold },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },

  cardFooter:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  ownerBadge:       { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  ownerBadgeCompany:{ backgroundColor: Colors.navyBg },
  ownerBadgeThird:  { backgroundColor: Colors.infoBg },
  ownerBadgeText:   { fontSize: 10, color: Colors.textSecondary, fontWeight: Typography.semibold },
  fuelCost:         { fontSize: Typography.xs, color: Colors.textMuted },
});
