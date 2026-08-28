import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { ReasonModal }   from '../../components/ReasonModal';
import { useRejectionHoldsList, useRejectionHoldActions, useResolutionCreate } from '../../hooks/useTimberLifecycle';
import { RejectionHoldRow, ResolutionDestination } from '../../types/api';
import { PolesProductionStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Pole Production Phase 2 — closes the mobile gap Phase 1 documented (the
// backend's Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal
// engine was already fully generic for poles-origin holds, but had no mobile
// screen at all — desktop had one via the Daily Poles page, mobile had
// none). Mirrors the Sawmill/VAT embedded RejectionHoldsCard pattern exactly
// (same hooks, same action shape), as a standalone screen since Poles has no
// existing dashboard screen with room to embed one. sourceType='poles'
// covers BOTH manufactured (pole_production_output_id) and purchased
// (procurement_goods_receipt_item_id) poles — the backend widens this one
// filter value to match both (rejectionHoldsList, data.js), so this single
// screen serves both pole sources without a second query.

type NavProp = NativeStackNavigationProp<PolesProductionStackParamList, 'PoleRejectionHolds'>;

const REJECTION_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', rework: 'In Rework', downgraded: 'Downgraded', returned: 'Returned', resolved: 'Resolved',
};
const REJECTED_DESTINATIONS: ResolutionDestination[] = ['Firewood', 'Scrap Sale', 'Disposal'];

function HoldCard({ hold, onRework, onReturn, onResolve }: {
  hold: RejectionHoldRow;
  onRework: () => void; onReturn: () => void; onResolve: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{hold.product_type ?? 'Unknown'} {hold.product_sub_type ?? ''} {hold.product_size ?? ''}</Text>
        <Text style={styles.rowMeta}>
          {hold.quantity} units · {REJECTION_STATUS_LABEL[hold.status] ?? hold.status}
          {hold.inspection_rejection_reason ? ` · ${hold.inspection_rejection_reason}` : ''}
        </Text>
        {hold.source === 'purchased_pole' && (
          <Text style={styles.sourceBadge}>Purchased — {hold.purchase_po_number ?? '—'} · {hold.purchase_supplier_name ?? '—'}</Text>
        )}
        {hold.source === 'poles' && hold.pole_batch_date && (
          <Text style={styles.sourceBadge}>Manufactured — batch {hold.pole_batch_date}</Text>
        )}
      </View>
      {hold.status === 'pending' ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={onRework}><Text style={styles.actionBtnText}>Rework</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onReturn}><Text style={styles.actionBtnText}>Return</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onResolve}><Text style={styles.actionBtnText}>Resolve</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.badgeMuted}><Text style={styles.badgeMutedText}>{REJECTION_STATUS_LABEL[hold.status] ?? hold.status}</Text></View>
      )}
    </View>
  );
}

export function PoleRejectionHoldsScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useRejectionHoldsList(undefined, 'poles');
  const { rework, returnToInventory } = useRejectionHoldActions();
  const { resolve } = useResolutionCreate();

  const [returnTarget, setReturnTarget] = useState<RejectionHoldRow | null>(null);
  const [returning, setReturning]       = useState(false);

  const rows = data?.rows ?? [];

  function handleRework(hold: RejectionHoldRow) {
    // Pole Production Phase 2 — a purchased finished pole has no in-house
    // production batch/process to rework through; rejectionResolveRework
    // (data.js) returns a clear, explicit error for this source. Surfacing
    // the same message here up front saves the round trip.
    if (hold.source === 'purchased_pole') {
      Alert.alert(
        'Rework not available',
        'This pole was purchased already finished — there is no in-house production process to rework it through. Use Return or Resolve instead.',
      );
      return;
    }
    Alert.alert('Send to Rework', `Re-enter ${hold.quantity} unit(s) into a new production output line for another Quality Inspection pass?`, [
      { text: 'Rework', onPress: async () => { try { await rework(hold.id); refetch(); } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to send to rework.'); } } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleReturn(hold: RejectionHoldRow) {
    setReturnTarget(hold);
  }

  async function submitReturn(reason: string) {
    if (!returnTarget || !reason.trim()) return;
    setReturning(true);
    try {
      await returnToInventory(returnTarget.id, reason.trim());
      setReturnTarget(null);
      refetch();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to return to inventory.');
    } finally {
      setReturning(false);
    }
  }

  function handleResolve(hold: RejectionHoldRow) {
    Alert.alert('Resolve To', `Choose a destination for ${hold.quantity} unit(s).`, [
      ...REJECTED_DESTINATIONS.map(dest => ({
        text: dest,
        onPress: async () => {
          if (dest !== 'Disposal') { Alert.alert('Use Desktop', 'This destination needs a warehouse — please use the desktop app to complete this resolution.'); return; }
          try { await resolve({ source_type: 'rejected_timber', source_id: hold.id, destination: dest, volume: hold.quantity }); refetch(); }
          catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to resolve.'); }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (isLoading) return <LoadingState message="Loading rejection holds…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Rejection Holds (Poles)" dark onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load rejection holds" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              title="No rejected poles on hold"
              subtitle="Rejections from Pole Quality Inspection — manufactured or purchased — will appear here."
            />
          }
          renderItem={({ item }) => (
            <HoldCard
              hold={item}
              onRework={() => handleRework(item)}
              onReturn={() => handleReturn(item)}
              onResolve={() => handleResolve(item)}
            />
          )}
        />
      )}

      <ReasonModal
        visible={!!returnTarget}
        title="Return to Inventory"
        message={returnTarget ? `Enter a reason for returning ${returnTarget.quantity} unit(s) of ${returnTarget.product_type ?? 'this item'} ${returnTarget.product_size ?? ''} back to stock as-is:` : ''}
        confirmLabel="Return"
        loading={returning}
        onCancel={() => setReturnTarget(null)}
        onConfirm={submitReturn}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm, flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowMeta:  { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  sourceBadge: { fontSize: Typography.xs, color: Colors.navy, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  actionBtnText: { fontSize: Typography.xs, color: Colors.white, fontWeight: Typography.medium },

  badgeMuted: {
    backgroundColor: Colors.navyBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  badgeMutedText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
});
