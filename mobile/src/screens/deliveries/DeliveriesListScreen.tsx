import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }      from '../../components/AppHeader';
import { LoadingState }   from '../../components/LoadingState';
import { ErrorState }     from '../../components/ErrorState';
import { EmptyState }     from '../../components/EmptyState';
import { OfflineBanner }  from '../../components/OfflineBanner';
import { useDeliveryList } from '../../hooks/useDeliveries';
import { DeliveryOrder }   from '../../types/api';
import { DeliveryStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<DeliveryStackParamList, 'DeliveriesList'>;

const STATUS_COLOR: Record<string, string> = {
  'Pending':      Colors.textMuted,
  'Assigned':     Colors.info,
  'In Transit':   Colors.warning,
  'POD Recorded': Colors.success,
  'Failed':       Colors.error,
};

function DeliveryCard({ order, onPress }: { order: DeliveryOrder; onPress: () => void }) {
  const color = STATUS_COLOR[order.status] ?? Colors.textMuted;
  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.statusText, { color }]}>{order.status}</Text>
        </View>
      </View>
      {order.customer_name && (
        <Text style={styles.customer} numberOfLines={1}>{order.customer_name}</Text>
      )}
      <View style={styles.metaRow}>
        {order.driver_name && (
          <View style={styles.meta}>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{order.driver_name}</Text>
          </View>
        )}
        {order.vehicle_registration && (
          <View style={styles.meta}>
            <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{order.vehicle_registration}</Text>
          </View>
        )}
        {order.qty_dispatched != null && (
          <View style={styles.meta}>
            <Ionicons name="cube-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{order.qty_dispatched} dispatched</Text>
          </View>
        )}
      </View>
      {order.delivery_date && (
        <Text style={styles.date}>{order.delivery_date}</Text>
      )}
    </TouchableOpacity>
  );
}

export function DeliveriesListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useDeliveryList();

  const orders    = data?.rows ?? [];
  const pending   = useMemo(() => orders.filter((o) => ['Pending', 'Assigned', 'In Transit'].includes(o.status)).length, [orders]);
  const awaitPOD  = useMemo(() => orders.filter((o) => o.status === 'In Transit').length, [orders]);

  if (isLoading) return <LoadingState message="Loading deliveries…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Deliveries"
        dark
        actions={[{ icon: 'clipboard-outline', onPress: () => navigation.navigate('PODList') }]}
      />

      {isError ? (
        <ErrorState message="Could not load deliveries" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <View style={styles.banner}>
              <View style={styles.bannerStat}>
                <Text style={styles.bannerValue}>{pending}</Text>
                <Text style={styles.bannerLabel}>Pending</Text>
              </View>
              <View style={styles.bannerDivider} />
              <View style={styles.bannerStat}>
                <Text style={[styles.bannerValue, awaitPOD > 0 && { color: Colors.warning }]}>{awaitPOD}</Text>
                <Text style={styles.bannerLabel}>Awaiting POD</Text>
              </View>
              <View style={styles.bannerDivider} />
              <View style={styles.bannerStat}>
                <Text style={styles.bannerValue}>{orders.length}</Text>
                <Text style={styles.bannerLabel}>Total</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="cube-outline" title="No deliveries" subtitle="No delivery orders found." />
          }
          renderItem={({ item }) => (
            <DeliveryCard order={item} onPress={() => navigation.navigate('DeliveryDetail', { order: item })} />
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

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: Colors.border },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  bannerLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, borderLeftWidth: 3, ...Shadow.sm },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  statusBadge:  { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText:   { fontSize: Typography.xs, fontWeight: Typography.medium },
  customer:     { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  meta:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:     { fontSize: Typography.xs, color: Colors.textMuted },
  date:         { fontSize: Typography.xs, color: Colors.textMuted },
});
