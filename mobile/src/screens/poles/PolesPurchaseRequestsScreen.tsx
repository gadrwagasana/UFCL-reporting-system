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
import { PolesRequest }  from '../../types/api';
import { PolesPurchaseStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<PolesPurchaseStackParamList, 'PolesPurchaseList'>;

const STATUS_COLOR: Record<string, string> = {
  pending:  Colors.warning,
  approved: Colors.success,
  rejected: Colors.error,
};

function RequestCard({ item }: { item: PolesRequest }) {
  const color = STATUS_COLOR[item.status] ?? Colors.textMuted;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.supplier} numberOfLines={1}>{item.supplier_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.statusText, { color }]}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.statText}>{item.requested_qty} poles</Text>
        </View>
        {item.unit_price != null && (
          <View style={styles.stat}>
            <Ionicons name="cash-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.statText}>{Number(item.unit_price).toLocaleString()} / unit</Text>
          </View>
        )}
      </View>
      {item.requested_by_name && (
        <Text style={styles.meta}>Requested by {item.requested_by_name}</Text>
      )}
      {item.rejection_reason && (
        <Text style={styles.rejection}>Rejected: {item.rejection_reason}</Text>
      )}
    </View>
  );
}

export function PolesPurchaseRequestsScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = usePolesList();

  const requests = useMemo(() => data?.requests ?? [], [data]);
  const pending  = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  if (isLoading) return <LoadingState message="Loading purchase requests…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Purchase Requests"
        dark
        actions={can('poles.purchase') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('PolesPurchaseCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load purchase requests" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            pending > 0 ? (
              <View style={styles.pendingBanner}>
                <Ionicons name="hourglass-outline" size={14} color={Colors.warning} />
                <Text style={styles.pendingText}>{pending} awaiting CEO approval</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No purchase requests"
              subtitle={can('poles.purchase') ? 'Tap + to create a new request.' : 'No requests found.'}
            />
          }
          renderItem={({ item }) => <RequestCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warningBg, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  pendingText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  supplier:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  statusBadge: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  statusText: { fontSize: Typography.xs, fontWeight: Typography.medium, textTransform: 'capitalize' },
  statsRow:   { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  stat:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:   { fontSize: Typography.sm, color: Colors.textSecondary },
  meta:       { fontSize: Typography.xs, color: Colors.textMuted },
  rejection:  { fontSize: Typography.xs, color: Colors.error, fontStyle: 'italic' },
});
