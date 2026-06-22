import React from 'react';
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
import { useVatInbound } from '../../hooks/useVat';
import { useAuth }       from '../../hooks/useAuth';
import { VatInboundEntry } from '../../types/api';
import { VatInboundStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<VatInboundStackParamList, 'VatInboundList'>;

function InboundCard({
  item, onPress, canIntake,
}: { item: VatInboundEntry; onPress: () => void; canIntake: boolean }) {
  const available = item.received_qty - item.intake_used;
  const fullUsed  = available <= 0;

  return (
    <TouchableOpacity
      style={[styles.card, fullUsed && styles.cardExhausted]}
      onPress={canIntake && !fullUsed ? onPress : undefined}
      activeOpacity={canIntake && !fullUsed ? 0.75 : 1}
    >
      <View style={styles.cardTop}>
        <Text style={styles.sizeText} numberOfLines={1}>{item.product_size}</Text>
        {fullUsed ? (
          <View style={styles.exhaustedBadge}>
            <Text style={styles.exhaustedText}>Exhausted</Text>
          </View>
        ) : canIntake ? (
          <View style={styles.actionHint}>
            <Text style={styles.actionText}>Intake</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.navy} />
          </View>
        ) : null}
      </View>

      <View style={styles.usageRow}>
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              {
                width: item.received_qty > 0
                  ? `${Math.min((item.intake_used / item.received_qty) * 100, 100)}%`
                  : '0%',
                backgroundColor: fullUsed ? Colors.textMuted : Colors.navy,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Received</Text>
          <Text style={styles.statValue}>{item.received_qty}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Used</Text>
          <Text style={styles.statValue}>{item.intake_used}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, !fullUsed && { color: Colors.success }]}>Available</Text>
          <Text style={[styles.statValue, !fullUsed && { color: Colors.success }]}>{available}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function VatInboundScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useVatInbound();

  const rows = data?.rows ?? [];
  const canIntake = can('vat.write');

  if (isLoading) return <LoadingState message="Loading inbound transfers…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Inbound Transfers" dark />

      {isError ? (
        <ErrorState message="Could not load inbound transfers" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.id}-${item.product_size}`}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            canIntake && rows.some((r) => r.received_qty - r.intake_used > 0) ? (
              <View style={styles.tipBanner}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.info} />
                <Text style={styles.tipText}>Tap a transfer row to record VAT intake for that size.</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="arrow-down-circle-outline"
              title="No inbound transfers"
              subtitle="No timber received at Nyanza yet."
            />
          }
          renderItem={({ item }) => (
            <InboundCard
              item={item}
              canIntake={canIntake}
              onPress={() =>
                navigation.navigate('VatIntakeCreate', {
                  transferId:  item.id,
                  productSize: item.product_size,
                  available:   item.received_qty - item.intake_used,
                })
              }
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

  tipBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.infoBg, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  tipText: { flex: 1, fontSize: Typography.xs, color: Colors.info },

  card:          { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  cardExhausted: { opacity: 0.6 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sizeText:      { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },

  exhaustedBadge: { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  exhaustedText:  { fontSize: Typography.xs, color: Colors.textMuted },

  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  usageRow: { height: 6 },
  bar:      { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },

  statsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  stat:      { alignItems: 'center' },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
});
