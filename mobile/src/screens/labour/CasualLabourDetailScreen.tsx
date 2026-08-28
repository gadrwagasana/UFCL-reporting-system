import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBadge }  from '../../components/StatusBadge';
import { Button }       from '../../components/Button';
import { ReasonModal }  from '../../components/ReasonModal';
import { useAuth }         from '../../hooks/useAuth';
import { useCasualLabourReview, useCasualLabourDelete } from '../../hooks/useCasualLabour';
import { CasualLabourStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// ERP Enterprise Completion Phase 3 (Workstream 11) — matches
// casualLabourRequestsReview's actual gate exactly (data.js:9287:
// `['ceo','operations'].includes(user.role)` — 'admin' is NOT included,
// unlike the mobile-api route's wider requireRoles('ceo','operations','admin')
// middleware gate one layer up). The route being wider than the function it
// calls doesn't grant admin anything real — the function is the true
// authoritative check and would still reject admin — so this deliberately
// matches the function, not the route, to avoid showing a button that
// silently fails. Also matches desktop's own canReview array exactly.
const REVIEW_ROLES = ['ceo', 'operations'];

type RouteProps = CasualLabourStackScreenProps<'CasualLabourDetail'>['route'];
type NavProps   = CasualLabourStackScreenProps<'CasualLabourDetail'>['navigation'];

interface RowProps { label: string; value: string }
function Row({ label, value }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function normaliseLabourItems(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return [raw]; }
}

export function CasualLabourDetailScreen() {
  const route      = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const { item }   = route.params;
  const { role }   = useAuth();
  const { review } = useCasualLabourReview();
  const [reviewing, setReviewing] = useState<'Approved' | 'Rejected' | null>(null);

  // Remediation Phase 2 — casualLabourRequestsDelete had desktop/IPC wiring
  // with no REST route/mobile UI; a submitted request could never be
  // withdrawn from mobile. Server-side applyGovernance remains authoritative
  // (non-owners/past-window requests are deferred to approval, not blocked
  // client-side) — mirrors VehicleDetailScreen's always-shown delete pattern.
  const { deleteRequest } = useCasualLabourDelete();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  async function submitDelete(reason: string) {
    if (!reason.trim()) return;
    setDeleting(true);
    try {
      const result = await deleteRequest(item.id, reason.trim());
      setShowDelete(false);
      if (result && 'pendingApproval' in result && result.pendingApproval) {
        Alert.alert('Submitted for Review', result.message);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not delete request.');
    } finally {
      setDeleting(false);
    }
  }

  const labourItems = normaliseLabourItems(item.labour_items);
  const isApproved  = item.status === 'Approved';
  const isRejected  = item.status === 'Rejected';
  const canReview   = item.status === 'Pending' && !!role && REVIEW_ROLES.includes(role);

  const handleReview = (status: 'Approved' | 'Rejected') => {
    Alert.alert(
      status === 'Approved' ? 'Approve request' : 'Reject request',
      status === 'Approved'
        ? `Approve this labour request for ${item.num_casuals} casual(s)?`
        : `Reject this labour request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'Approved' ? 'Approve' : 'Reject',
          style: status === 'Approved' ? 'default' : 'destructive',
          onPress: async () => {
            setReviewing(status);
            try {
              await review(item.id, status);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not submit review');
            } finally {
              setReviewing(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Labour Request" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.task}>{item.task}</Text>
            <StatusBadge status={item.status} />
          </View>
          {item.created_by_name ? (
            <View style={styles.submittedRow}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.submittedText}>By {item.created_by_name}</Text>
              {item.created_fmt ? <Text style={styles.submittedText}> · {item.created_fmt}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Schedule + headcount */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          <View style={styles.divider} />
          <Row label="Start Date"  value={item.start_fmt ?? item.start_date} />
          <View style={styles.rowDivider} />
          <Row label="End Date"    value={item.end_fmt ?? item.end_date} />
          <View style={styles.rowDivider} />
          <Row label="# Casuals"   value={String(item.num_casuals)} />
          {item.description ? (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Description</Text>
                <Text style={[styles.rowValue, styles.multilineValue]}>{item.description}</Text>
              </View>
            </>
          ) : null}
          {item.comments ? (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Comments</Text>
                <Text style={[styles.rowValue, styles.multilineValue]}>{item.comments}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Labour items list */}
        {labourItems.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Labour Items</Text>
            <View style={styles.divider} />
            {labourItems.map((li, idx) => (
              <View key={idx} style={styles.labourItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.navy} />
                <Text style={styles.labourItemText}>{li}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Review result */}
        {(isApproved || isRejected) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review</Text>
            <View style={styles.divider} />
            <View style={styles.timelineRow}>
              <Ionicons
                name={isRejected ? 'close-circle' : 'checkmark-circle'}
                size={20}
                color={isRejected ? Colors.error : Colors.success}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineMain}>
                  {isRejected ? 'Rejected' : 'Approved'}
                  {item.reviewed_by_name ? ` by ${item.reviewed_by_name}` : ''}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Review actions — mirrors desktop's Approve/Reject pair
            (renderCasualLabourRequests), ceo/operations/admin only */}
        {canReview ? (
          <View style={styles.reviewActions}>
            <Button
              label="Reject" variant="danger" icon="close-circle-outline"
              onPress={() => handleReview('Rejected')}
              loading={reviewing === 'Rejected'} disabled={reviewing !== null}
              style={styles.reviewBtn}
            />
            <Button
              label="Approve" variant="primary" icon="checkmark-circle-outline"
              onPress={() => handleReview('Approved')}
              loading={reviewing === 'Approved'} disabled={reviewing !== null}
              style={styles.reviewBtn}
            />
          </View>
        ) : null}

        <Button
          label="Delete Request" variant="danger" icon="trash-outline"
          onPress={() => setShowDelete(true)}
        />
      </ScrollView>

      <ReasonModal
        visible={showDelete}
        title="Delete Labour Request"
        message={`Enter a reason for deleting this request for ${item.num_casuals} casual(s).`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setShowDelete(false)}
        onConfirm={submitDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  divider:    { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { height: 1, backgroundColor: Colors.divider },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  task: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  submittedText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.base,
  },
  rowLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  rowValue: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  multilineValue: { textAlign: 'left' },

  labourItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  labourItemText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timelineContent: { flex: 1 },
  timelineMain: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },

  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reviewBtn: { flex: 1 },
});
