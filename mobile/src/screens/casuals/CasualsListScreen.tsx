import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ReasonModal }  from '../../components/ReasonModal';
import { useCasualsList, useCasualDelete } from '../../hooks/useCasuals';
import { useAuth } from '../../hooks/useAuth';
import { CasualWorker } from '../../types/api';
import { CasualLabourStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<CasualLabourStackParamList, 'CasualsList'>;

function MetricBanner({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{total}</Text>
        <Text style={styles.bannerLabel}>Total</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{active}</Text>
        <Text style={styles.bannerLabel}>Active</Text>
      </View>
    </View>
  );
}

function CasualCard({
  item, onEdit, onDelete,
}: {
  item: CasualWorker;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, !item.active && styles.cardInactive]}>
      <TouchableOpacity onPress={onEdit} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{item.full_name}</Text>
          {!item.active && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
        <View style={styles.cardMeta}>
          {item.job_role ? (
            <Text style={styles.cardMetaItem} numberOfLines={1}>
              <Ionicons name="briefcase-outline" size={11} color={Colors.textMuted} /> {item.job_role}
            </Text>
          ) : null}
          {item.department ? (
            <Text style={styles.cardMetaItem} numberOfLines={1}>
              <Ionicons name="business-outline" size={11} color={Colors.textMuted} /> {item.department}
            </Text>
          ) : null}
          {item.phone ? (
            <Text style={styles.cardMetaItem}>
              <Ionicons name="call-outline" size={11} color={Colors.textMuted} /> {item.phone}
            </Text>
          ) : null}
        </View>
        {item.supervisor ? <Text style={styles.cardSub}>Supervisor: {item.supervisor}</Text> : null}
        <Text style={styles.cardSub}>Started {item.start_fmt ?? item.start_date ?? '—'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={14} color={Colors.error} />
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CasualsListScreen() {
  const navigation = useNavigation<NavProp>();
  const { can }     = useAuth();
  const canManage   = can('casual.manage');
  const { data, isLoading, isError, refetch, isRefetching } = useCasualsList();
  const { deleteCasual } = useCasualDelete();

  const rows   = data?.rows ?? [];
  const total  = rows.length;
  const active = rows.filter((r) => r.active).length;

  const [deleteTarget, setDeleteTarget] = useState<CasualWorker | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function submitDelete(reason: string) {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCasual(deleteTarget.id, reason.trim() || undefined);
      setDeleteTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not delete this record.');
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading casual workers…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Casual Workers"
        dark
        onBack={() => navigation.goBack()}
        actions={canManage ? [{
          icon: 'add',
          onPress: () => navigation.navigate('CasualForm', { casual: undefined }),
        }] : []}
      />

      {isError ? (
        <ErrorState message="Could not load casual workers" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
          }
          ListHeaderComponent={total > 0 ? <MetricBanner total={total} active={active} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No casual workers yet"
              subtitle={canManage ? 'Tap + to register the first casual worker.' : 'No casual workers registered.'}
            />
          }
          renderItem={({ item }) => (
            <CasualCard
              item={item}
              onEdit={() => canManage
                ? navigation.navigate('CasualForm', { casual: item })
                : undefined}
              onDelete={() => canManage ? setDeleteTarget(item) : undefined}
            />
          )}
        />
      )}

      <ReasonModal
        visible={deleteTarget !== null}
        title="Delete Casual Worker"
        message={deleteTarget ? `This permanently deletes ${deleteTarget.full_name}'s record. Provide a reason for the audit trail:` : ''}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={submitDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  banner: {
    flexDirection: 'row',
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  bannerStat:    { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  bannerValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  bannerLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: 4,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.base },
  cardMetaItem: { fontSize: Typography.xs, color: Colors.textMuted },
  cardSub:  { fontSize: Typography.xs, color: Colors.textMuted },

  cardInactive: { opacity: 0.65 },
  inactiveBadge:     { backgroundColor: Colors.errorBg, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginRight: Spacing.xs },
  inactiveBadgeText: { fontSize: Typography.xs, color: Colors.error },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm, paddingVertical: 4, marginTop: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.errorBg,
  },
  deleteBtnText: { fontSize: Typography.xs, color: Colors.error },
});
