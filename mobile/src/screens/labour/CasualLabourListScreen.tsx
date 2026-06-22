import React, { useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { StatusBadge }  from '../../components/StatusBadge';
import { useCasualLabour } from '../../hooks/useCasualLabour';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuth }         from '../../hooks/useAuth';
import { CasualLabourRequest } from '../../types/api';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'CasualLabourList'>;

function LabourCard({ item, onPress }: { item: CasualLabourRequest; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.task} numberOfLines={1}>{item.task}</Text>
        <StatusBadge status={item.status} size="sm" />
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.metaText}>{item.num_casuals} casuals</Text>
        <Text style={styles.metaDot}>·</Text>
        <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.metaText}>
          {item.start_fmt ?? item.start_date} – {item.end_fmt ?? item.end_date}
        </Text>
      </View>
      <Text style={styles.date}>Submitted {item.created_fmt ?? ''}</Text>
    </TouchableOpacity>
  );
}

function QueueCard({ label }: { label: string }) {
  return (
    <View style={[styles.card, styles.queueCard]}>
      <View style={styles.cardTop}>
        <Text style={styles.task}>{label}</Text>
        <View style={styles.syncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={Colors.info} />
          <Text style={styles.syncText}>Pending Sync</Text>
        </View>
      </View>
      <Text style={styles.date}>Saved offline — will sync when connected</Text>
    </View>
  );
}

export function CasualLabourListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }    = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useCasualLabour();
  const queue      = useOfflineStore((s) => s.queue);

  const pendingQueue = useMemo(
    () => queue.filter((i) => i.context === 'casual-labour' && i.status !== 'failed'),
    [queue],
  );

  if (isLoading) return <LoadingState message="Loading casual labour requests…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Casual Labour"
        dark
        actions={can('labour.write') ? [{
          icon: 'add',
          onPress: () => navigation.navigate('CasualLabourCreate'),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load requests" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows?.length ?? 0) + pendingQueue.length === 0
            ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListHeaderComponent={pendingQueue.length > 0 ? (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingSectionTitle}>Pending Sync ({pendingQueue.length})</Text>
              {pendingQueue.map((q) => (
                <QueueCard
                  key={q.id}
                  label={q.body.task ? String(q.body.task) : 'Casual labour request'}
                />
              ))}
            </View>
          ) : null}
          ListEmptyComponent={pendingQueue.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No requests yet"
              subtitle={can('labour.write') ? 'Tap + to submit a casual labour request.' : 'No requests for your workshop.'}
            />
          ) : null}
          renderItem={({ item }) => (
            <LabourCard
              item={item}
              onPress={() => navigation.navigate('CasualLabourDetail', { item })}
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

  pendingSection: { marginBottom: Spacing.md },
  pendingSectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.info,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  queueCard: {
    borderWidth: 1,
    borderColor: Colors.infoBg,
    borderStyle: 'dashed',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  task: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  metaDot: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  date: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  syncText: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: Typography.medium,
  },
});
