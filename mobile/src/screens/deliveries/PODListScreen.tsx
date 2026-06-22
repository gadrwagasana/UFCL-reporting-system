import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useNavigation }  from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { useDeliveryList } from '../../hooks/useDeliveries';
import { DeliveryOrder }   from '../../types/api';
import { DeliveryStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<DeliveryStackParamList, 'PODList'>;

function PODCard({ order, onPress }: { order: DeliveryOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <View style={styles.podBadge}>
          <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
          <Text style={styles.podBadgeText}>POD</Text>
        </View>
      </View>
      {order.customer_name && (
        <Text style={styles.customer} numberOfLines={1}>{order.customer_name}</Text>
      )}
      <View style={styles.qtyRow}>
        <Text style={styles.qtyText}>
          <Text style={styles.qtyNum}>{order.qty_accepted ?? 0}</Text> accepted
        </Text>
        {(order.qty_rejected ?? 0) > 0 && (
          <Text style={[styles.qtyText, { color: Colors.error }]}>
            <Text style={styles.qtyNum}>{order.qty_rejected}</Text> rejected
          </Text>
        )}
      </View>
      {order.pod_recorded_at && (
        <Text style={styles.date}>{order.pod_recorded_at}</Text>
      )}
    </TouchableOpacity>
  );
}

export function PODListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useDeliveryList();

  const podOrders = useMemo(
    () => (data?.rows ?? []).filter((o) => o.status === 'POD Recorded'),
    [data?.rows],
  );

  if (isLoading) return <LoadingState message="Loading POD history…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="POD History" dark onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load POD records" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={podOrders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={podOrders.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="clipboard-outline" title="No PODs recorded" subtitle="Completed deliveries will appear here." />
          }
          renderItem={({ item }) => (
            <PODCard order={item} onPress={() => navigation.navigate('PODDetail', { order: item })} />
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

  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  podBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success + '1A', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  podBadgeText: { fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.medium },
  customer:    { fontSize: Typography.sm, color: Colors.textSecondary },
  qtyRow:      { flexDirection: 'row', gap: Spacing.base },
  qtyText:     { fontSize: Typography.sm, color: Colors.textMuted },
  qtyNum:      { fontWeight: Typography.semibold, color: Colors.textPrimary },
  date:        { fontSize: Typography.xs, color: Colors.textMuted },
});
