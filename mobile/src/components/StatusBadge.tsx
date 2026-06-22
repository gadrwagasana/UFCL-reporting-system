import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
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
}

function resolveColors(status: Status): { bg: string; text: string } {
  switch (status.toLowerCase()) {
    case 'pending':    return { bg: Colors.statusPending,   text: Colors.statusPendingText };
    case 'approved':   return { bg: Colors.statusApproved,  text: Colors.statusApprovedText };
    case 'rejected':   return { bg: Colors.statusRejected,  text: Colors.statusRejectedText };
    case 'in-transit': return { bg: Colors.statusInTransit, text: Colors.statusInTransitText };
    case 'delivered':
    case 'completed':  return { bg: Colors.statusCompleted, text: Colors.statusCompletedText };
    case 'draft':      return { bg: Colors.statusDraft,     text: Colors.statusDraftText };
    default:           return { bg: Colors.statusDraft,     text: Colors.statusDraftText };
  }
}

export function StatusBadge({ status, label, size = 'md' }: Props) {
  const { bg, text } = resolveColors(status);
  const displayLabel = label ?? (status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' '));

  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.label, { color: text }, size === 'sm' && styles.labelSm]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.xxs + 1,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  labelSm: {
    fontSize: Typography.xs,
  },
});
