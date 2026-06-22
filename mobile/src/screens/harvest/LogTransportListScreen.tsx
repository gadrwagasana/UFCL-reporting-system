import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { useLogTransportList } from '../../hooks/useLogTransport';
import { useOfflineStore }     from '../../stores/offlineStore';
import { useAuth }             from '../../hooks/useAuth';
import { LogTransportEntry }   from '../../types/api';
import { LogTransportStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<LogTransportStackParamList, 'LogTransportList'>;

function TotalsBanner({ data }: { data: ReturnType<typeof useLogTransportList>['data'] }) {
  if (!data?.totals) return null;
  const { totals } = data;
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{totals.totalLogsTransported}</Text>
        <Text style={styles.bannerLabel}>Transported</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{totals.remainingLogs}</Text>
        <Text style={styles.bannerLabel}>Remaining</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{(totals.totalVolumeM3 ?? 0).toFixed(1)}</Text>
        <Text style={styles.bannerLabel}>Vol m³</Text>
      </View>
    </View>
  );
}

function TransportCard({
  entry, onPress,
}: { entry: LogTransportEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.qty}>{entry.qty_transported} <Text style={styles.unit}>{entry.unit ?? 'logs'}</Text></Text>
        <Text style={styles.date}>{entry.date_fmt ?? entry.transport_date}</Text>
      </View>
      <View style={styles.metaRow}>
        {entry.tractor_plate && (
          <View style={styles.metaChip}>
            <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.tractor_plate}</Text>
          </View>
        )}
        {entry.loggers_number && (
          <View style={styles.metaChip}>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.loggers_number}</Text>
          </View>
        )}
        {entry.compt_name && (
          <View style={styles.metaChip}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{entry.compt_name}</Text>
          </View>
        )}
      </View>
      {entry.notes && (
        <Text style={styles.notes} numberOfLines={1}>{entry.notes}</Text>
      )}
    </TouchableOpacity>
  );
}

function QueueCard() {
  return (
    <View style={[styles.card, styles.queueCard]}>
      <View style={styles.cardTop}>
        <Text style={styles.qty}>Transport entry</Text>
        <View style={styles.syncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={Colors.info} />
          <Text style={styles.syncText}>Pending Sync</Text>
        </View>
      </View>
      <Text style={styles.notes}>Saved offline — will sync when connected</Text>
    </View>
  );
}

export function LogTransportListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useLogTransportList();
  const queue      = useOfflineStore((s) => s.queue);

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'log-transport' && i.status !== 'failed'),
    [queue],
  );

  if (isLoading) return <LoadingState message="Loading transport records…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Log Transport"
        dark
        actions={can('logtransport.write') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('LogTransportCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load transport records" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows?.length ?? 0) + pendingQueue.length === 0
            ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={
            <>
              <TotalsBanner data={data} />
              {pendingQueue.length > 0 && (
                <View style={styles.pendingSection}>
                  <Text style={styles.pendingSectionTitle}>
                    Pending Sync ({pendingQueue.length})
                  </Text>
                  {pendingQueue.map((q) => <QueueCard key={q.id} />)}
                </View>
              )}
            </>
          }
          ListEmptyComponent={pendingQueue.length === 0 ? (
            <EmptyState
              icon="git-merge-outline"
              title="No transport records"
              subtitle={can('logtransport.write') ? 'Tap + to log a transport trip.' : 'No records found.'}
            />
          ) : null}
          renderItem={({ item }) => (
            <TransportCard
              entry={item}
              onPress={() => navigation.navigate('LogTransportDetail', { entry: item })}
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

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  bannerLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  pendingSection:      { marginBottom: Spacing.sm },
  pendingSectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.info, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  queueCard: { borderWidth: 1, borderColor: Colors.infoBg, borderStyle: 'dashed' },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  qty:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  unit: { fontSize: Typography.sm, fontWeight: Typography.regular, color: Colors.textMuted },
  date: { fontSize: Typography.xs, color: Colors.textMuted },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },

  notes: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },

  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.infoBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  syncText: { fontSize: Typography.xs, color: Colors.info, fontWeight: Typography.medium },
});
