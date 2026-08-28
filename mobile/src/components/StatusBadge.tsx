import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';

type Status =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'in-transit'
  | 'delivered'
  | 'completed'
  | 'draft'
  | string;

interface Props {
  status: Status;
  label?: string;
  size?: 'sm' | 'md';
  // Opt-in icon — off by default so every existing call site across the app
  // renders exactly as before. Procurement screens pass withIcon to get the
  // "professional status badge" treatment (Phase 2A UI report).
  withIcon?: boolean;
}

// Extends the original 7-status set with the full vocabulary actually used
// across procurement (requisitions/POs/RFQs/quotations/receipts/invoices/
// payments) — previously all of these fell through to the generic gray
// "draft" badge with no visual differentiation at all.
function resolveColors(status: Status): { bg: string; text: string } {
  switch (status.toLowerCase()) {
    case 'pending':
    case 'pending_match':
    case 'in_approval':
    case 'partial':
    case 'partially_received':
    case 'partially delivered':
    case 'pending_approval':
    case 'suspended':
    case 'returned_for_revision':
    case 'returned':
    case 'shortage_pending_approval':
      return { bg: Colors.statusPending, text: Colors.statusPendingText };
    case 'approved':
    case 'paid':
    case 'selected':
    case 'responded':
    case 'active':
    case 'excellent':
    case 'fully delivered':
    case 'pod recorded':
      return { bg: Colors.statusApproved, text: Colors.statusApprovedText };
    case 'rejected':
    case 'disputed':
    case 'declined':
    case 'cancelled':
    case 'blacklisted':
    case 'high risk':
    case 'closed_with_shortage':
    case 'closed (short)':
    case 'completed_with_discrepancy':
    case 'failed':
      return { bg: Colors.statusRejected, text: Colors.statusRejectedText };
    // Phase 3C — supplier intelligence score tiers (Excellent handled above
    // via 'approved''s green, High Risk via 'rejected''s red).
    case 'good':
      return { bg: Colors.navyBg, text: Colors.navy };
    case 'average':
      return { bg: Colors.statusPending, text: Colors.statusPendingText };
    case 'in-transit':
    case 'in_transit':
    case 'in transit':
    case 'in progress':
    case 'submitted':
    case 'sent':
    case 'invited':
    case 'matched':
    case 'acknowledged':
    case 'assigned':
    case 'dispatched':
      return { bg: Colors.statusInTransit, text: Colors.statusInTransitText };
    case 'delivered':
    case 'completed':
    case 'complete':
    case 'received':
      return { bg: Colors.statusCompleted, text: Colors.statusCompletedText };
    case 'issued':
    case 'po_issued':
    case 'confirmed':
      return { bg: Colors.navyBg, text: Colors.navy };
    case 'draft':
    case 'closed':
    case 'skipped':
    case 'archived':
    default:
      return { bg: Colors.statusDraft, text: Colors.statusDraftText };
  }
}

// Enterprise UI/UX Standardization Phase 1, Workstream A — labels that don't
// naturally fall out of the default "capitalize first letter" derivation
// below, carried over verbatim from the 3 duplicate badge components this
// registry replaced (DeliveryStatusBadge/TransferStatusBadge/SalesOrderStatusBadge).
const LABEL_OVERRIDES: Record<string, string> = {
  'partially delivered': 'Partial Delivery',
  'closed (short)': 'Closed Short',
};

const PROC_STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  draft: 'document-text-outline', submitted: 'send-outline', in_approval: 'time-outline',
  pending: 'time-outline', approved: 'checkmark-circle-outline', rejected: 'close-circle-outline',
  cancelled: 'ban-outline', po_issued: 'document-attach-outline', issued: 'document-attach-outline',
  acknowledged: 'checkmark-outline', partially_received: 'cube-outline', received: 'cube-outline',
  closed: 'lock-closed-outline', pending_match: 'scale-outline', matched: 'checkmark-outline',
  disputed: 'alert-circle-outline', paid: 'cash-outline', sent: 'send-outline', invited: 'mail-outline',
  responded: 'chatbox-ellipses-outline', declined: 'close-outline', selected: 'star-outline',
  partial: 'cube-outline', complete: 'cube-outline', skipped: 'play-skip-forward-outline',
  // Phase 3B — supplier lifecycle.
  pending_approval: 'time-outline', active: 'checkmark-circle-outline', suspended: 'pause-outline',
  blacklisted: 'ban-outline', archived: 'archive-outline',
  // Phase 3C — supplier intelligence score tiers.
  excellent: 'trophy-outline', good: 'thumbs-up-outline', average: 'remove-outline', 'high risk': 'warning-outline',
  // Procurement Exception Management Phase 2 — Return for Revision.
  returned_for_revision: 'arrow-undo-outline', returned: 'arrow-undo-outline',
  // Procurement Exception Management Phase 3 — Close with Shortage.
  shortage_pending_approval: 'time-outline', closed_with_shortage: 'alert-circle-outline',
  // Enterprise UI/UX Standardization Phase 1 — merged in from the 3 duplicate
  // badge components (Delivery/Transfer/SalesOrder statuses).
  in_transit: 'car-outline', 'in transit': 'car-outline', assigned: 'person-outline',
  'pod recorded': 'checkmark-done-outline', failed: 'close-circle-outline',
  confirmed: 'checkmark-outline', 'in progress': 'sync-outline', dispatched: 'car-outline',
  'partially delivered': 'cube-outline', 'fully delivered': 'checkmark-done-outline',
  'closed (short)': 'alert-circle-outline', completed_with_discrepancy: 'alert-circle-outline',
};

export function StatusBadge({ status, label, size = 'md', withIcon = false }: Props) {
  const { bg, text } = resolveColors(status);
  const displayLabel = label ?? LABEL_OVERRIDES[status.toLowerCase()]
    ?? (status.charAt(0).toUpperCase() + status.slice(1).replace(/_|-/g, ' '));
  const icon = withIcon ? PROC_STATUS_ICON[status.toLowerCase()] : undefined;

  return (
    <View
      style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.badgeSm]}
      accessible
      accessibilityLabel={`Status: ${displayLabel}`}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 10 : 12} color={text} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: text }, size === 'sm' && styles.labelSm]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingVertical: Spacing.xxs + 1,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
  },
  icon: {
    marginRight: 3,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  labelSm: {
    fontSize: Typography.xs,
  },
});
