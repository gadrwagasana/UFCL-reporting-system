import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBadge }  from '../../components/StatusBadge';
import { MaterialRequestsStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type RouteProps = MaterialRequestsStackScreenProps<'MaterialRequestDetail'>['route'];
type NavProps   = MaterialRequestsStackScreenProps<'MaterialRequestDetail'>['navigation'];

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'Normal', urgent: 'Urgent', critical: 'Critical',
};

interface RowProps { label: string; value: string }
function Row({ label, value }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function MaterialRequestDetailScreen() {
  const route      = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const { item }   = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Request Details" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <StatusBadge status={item.status} />
          </View>
          {item.workshop_name ? (
            <View style={styles.workshopRow}>
              <Ionicons name="business-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.workshopName}>{item.workshop_name}</Text>
            </View>
          ) : null}
        </View>

        {/* Request details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request</Text>
          <View style={styles.divider} />
          <Row label="Requested Qty"  value={`${item.requested_qty}${item.uom ? ` ${item.uom}` : ''}`} />
          {item.approved_qty != null ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Approved Qty" value={`${item.approved_qty}${item.uom ? ` ${item.uom}` : ''}`} />
            </>
          ) : null}
          <View style={styles.rowDivider} />
          <Row label="Priority"     value={PRIORITY_LABEL[item.priority] ?? item.priority} />
          <View style={styles.rowDivider} />
          <Row label="Submitted"    value={item.requested_at} />
          {item.requested_by ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Requested by" value={item.requested_by} />
            </>
          ) : null}
          {item.reason ? (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Reason</Text>
                <Text style={[styles.rowValue, styles.multilineValue]}>{item.reason}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Review result — only shown after decision */}
        {(item.status === 'approved' || item.status === 'rejected' || item.status === 'partial') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review</Text>
            <View style={styles.divider} />
            <View style={styles.timelineRow}>
              <Ionicons
                name={item.status === 'rejected' ? 'close-circle' : 'checkmark-circle'}
                size={20}
                color={item.status === 'rejected' ? Colors.error : Colors.success}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineMain}>
                  {item.status === 'rejected' ? 'Rejected'
                    : item.status === 'partial' ? 'Partially Approved' : 'Approved'}
                  {item.reviewed_by ? ` by ${item.reviewed_by}` : ''}
                </Text>
                {item.reviewed_at ? (
                  <Text style={styles.timelineSub}>{item.reviewed_at}</Text>
                ) : null}
              </View>
            </View>
            {item.review_notes ? (
              <View style={[styles.reviewBox,
                item.status === 'rejected' ? styles.reviewBoxRejected : styles.reviewBoxApproved]}>
                <Text style={[styles.reviewLabel,
                  item.status === 'rejected' ? styles.reviewLabelRejected : styles.reviewLabelApproved]}>
                  Reviewer Notes
                </Text>
                <Text style={[styles.reviewText,
                  item.status === 'rejected' ? styles.reviewTextRejected : styles.reviewTextApproved]}>
                  {item.review_notes}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
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
  itemName: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  workshopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxs,
  },
  workshopName: {
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
  multilineValue: {
    textAlign: 'left',
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  timelineContent: { flex: 1 },
  timelineMain: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  timelineSub: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },

  reviewBox: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  reviewBoxApproved: { backgroundColor: Colors.successBg },
  reviewBoxRejected: { backgroundColor: Colors.errorBg },
  reviewLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  reviewLabelApproved: { color: Colors.success },
  reviewLabelRejected: { color: Colors.error },
  reviewText: { fontSize: Typography.sm },
  reviewTextApproved: { color: Colors.success },
  reviewTextRejected: { color: Colors.error },
});
