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
import { PolesDeliveryStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<PolesDeliveryStackParamList, 'PolesDeliveryList'>;

function DeliveryCard({ item }: { item: PolesDelivery }) {
  const isChecked = item.status === 'quality_checked';
  return (
    <View style={[styles.card, isChecked && styles.cardChecked]}>
      <View style={styles.cardTop}>
        <Text style={styles.dateText}>{item.delivery_date}</Text>
        <View style={[styles.badge, isChecked ? styles.badgeChecked : styles.badgePending]}>
          <Text style={[styles.badgeText, isChecked ? styles.badgeTextChecked : styles.badgeTextPending]}>
            {isChecked ? 'QC Done' : 'Pending QC'}
          </Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="cube-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.statText}>{item.delivered_qty} delivered</Text>
        </View>
        {isChecked && item.approved_qty != null && (
          <>
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle-outline" size={13} color={Colors.success} />
              <Text style={styles.statText}>{item.approved_qty} approved</Text>
            </View>
            {(item.rejected_qty ?? 0) > 0 && (
              <View style={styles.stat}>
                <Ionicons name="close-circle-outline" size={13} color={Colors.error} />
                <Text style={styles.statText}>{item.rejected_qty} rejected</Text>
              </View>
            )}
          </>
        )}
      </View>
      {item.supplier_name && (
        <Text style={styles.meta}>{item.supplier_name}</Text>
      )}
      {item.delivery_note_ref && (
        <Text style={styles.meta}>Ref: {item.delivery_note_ref}</Text>
      )}
    </View>
  );
}

export function PolesDeliveriesScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = usePolesList();

  const deliveries    = useMemo(() => data?.deliveries ?? [], [data]);
  const pendingQC     = useMemo(() => deliveries.filter((d) => d.status !== 'quality_checked').length, [deliveries]);
  const approvedTotal = data?.approved_total ?? 0;
  const available     = data?.available_qty ?? 0;

  if (isLoading) return <LoadingState message="Loading deliveries…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Deliveries"
        dark
        actions={can('poles.delivery') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('PolesDeliveryCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load deliveries" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={deliveries.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <>
              <View style={styles.stockBanner}>
                <View style={styles.stockStat}>
                  <Text style={styles.stockValue}>{approvedTotal}</Text>
                  <Text style={styles.stockLabel}>Total Approved</Text>
                </View>
                <View style={styles.stockDivider} />
                <View style={styles.stockStat}>
                  <Text style={[styles.stockValue, { color: available === 0 ? Colors.error : Colors.success }]}>
                    {available}
                  </Text>
                  <Text style={styles.stockLabel}>Available</Text>
                </View>
              </View>
              {pendingQC > 0 && (
                <View style={styles.qcBanner}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                  <Text style={styles.qcText}>{pendingQC} delivery{pendingQC > 1 ? 'ies' : ''} awaiting quality check</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No deliveries recorded"
              subtitle={can('poles.delivery') ? 'Tap + to record a delivery.' : 'No deliveries found.'}
            />
          }
          renderItem={({ item }) => <DeliveryCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  stockBanner: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  stockStat:    { flex: 1, alignItems: 'center' },
  stockDivider: { width: 1, backgroundColor: Colors.border },
  stockValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  stockLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  qcBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warningBg, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  qcText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardChecked: { borderLeftWidth: 3, borderLeftColor: Colors.success },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },

  badge:            { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeChecked:     { backgroundColor: Colors.successBg },
  badgePending:     { backgroundColor: Colors.warningBg },
  badgeText:        { fontSize: Typography.xs, fontWeight: Typography.medium },
  badgeTextChecked: { color: Colors.success },
  badgeTextPending: { color: Colors.warning },

  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.sm, color: Colors.textSecondary },
  meta:     { fontSize: Typography.xs, color: Colors.textMuted },
});
