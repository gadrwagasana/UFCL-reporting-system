import React from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { StatusBar }           from 'expo-status-bar';
import { useNavigation }       from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }           from '../../components/AppHeader';
import { LoadingState }        from '../../components/LoadingState';
import { ErrorState }          from '../../components/ErrorState';
import { EmptyState }          from '../../components/EmptyState';
import { OfflineBanner }       from '../../components/OfflineBanner';
import { DeliveryStatusBadge } from '../../components/DeliveryStatusBadge';
import { useDeliveryList }     from '../../hooks/useDeliveries';
import { DeliveryOrder }       from '../../types/api';
import { DeliveryStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<DeliveryStackParamList, 'DeliveriesList'>;

function MetricCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, highlight && s.metricHighlight]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function DeliveryCard({ order, onPress }: { order: DeliveryOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.orderNumber}>{order.order_number}</Text>
        <DeliveryStatusBadge status={order.status} />
      </View>
      {order.customer_name && (
        <Text style={s.customer} numberOfLines={1}>{order.customer_name}</Text>
      )}
      <View style={s.metaRow}>
        {order.driver_name && (
          <Text style={s.metaText}>👤 {order.driver_name}</Text>
        )}
        {order.vehicle_registration && (
          <Text style={s.metaText}>🚗 {order.vehicle_registration}</Text>
        )}
        {order.qty_dispatched != null && (
          <Text style={s.metaText}>📦 {order.qty_dispatched} dispatched</Text>
        )}
      </View>
      {order.status === 'POD Recorded' && order.qty_accepted != null && (
        <Text style={s.podLine}>
          <Text style={{ color: Colors.success }}>✓ {order.qty_accepted} accepted</Text>
          {(order.qty_rejected ?? 0) > 0
            ? <Text style={{ color: Colors.error }}>  ↩ {order.qty_rejected} returned</Text>
            : null}
        </Text>
      )}
      {order.delivery_date && <Text style={s.date}>{order.delivery_date}</Text>}
    </TouchableOpacity>
  );
}

export function DeliveriesListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useDeliveryList();

  const orders  = data?.rows     ?? [];
  const metrics = data?.metrics;

  if (isLoading) return <LoadingState message="Loading deliveries…" fullScreen />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Deliveries"
        dark
        actions={[
          { icon: 'add-outline',       onPress: () => navigation.navigate('DeliveryCreate') },
          { icon: 'clipboard-outline', onPress: () => navigation.navigate('PODList') },
        ]}
      />

      {isError ? (
        <ErrorState message="Could not load deliveries" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={orders.length === 0 ? s.emptyContainer : s.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <View style={s.banner}>
              <MetricCard label="Total"        value={metrics?.total       ?? 0} />
              <View style={s.div} />
              <MetricCard label="Pending"      value={metrics?.pending     ?? 0} highlight={(metrics?.pending ?? 0) > 0} />
              <View style={s.div} />
              <MetricCard label="In Transit"   value={metrics?.inTransit   ?? 0} highlight={(metrics?.inTransit ?? 0) > 0} />
              <View style={s.div} />
              <MetricCard label="POD Recorded" value={metrics?.podRecorded ?? 0} />
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="cube-outline" title="No deliveries" subtitle="No delivery orders found. Tap + to create one." />
          }
          renderItem={({ item }) => (
            <DeliveryCard
              order={item}
              onPress={() => navigation.navigate('DeliveryDetail', { order: item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  metric:          { flex: 1, alignItems: 'center', gap: 2 },
  metricValue:     { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  metricHighlight: { color: Colors.warning },
  metricLabel:     { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  div:             { width: 1, backgroundColor: Colors.border },

  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  customer:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaText:    { fontSize: Typography.xs, color: Colors.textMuted },
  podLine:     { fontSize: Typography.xs },
  date:        { fontSize: Typography.xs, color: Colors.textMuted },
});
