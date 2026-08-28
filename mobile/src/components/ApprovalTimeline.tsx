import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../theme';
import type { ProcurementApprovalStep } from '../types/api';

const STAGE_LABEL: Record<string, string> = {
  supervisor: 'Supervisor',
  department_manager: 'Department Manager',
  procurement_review: 'Procurement Review',
  finance: 'Finance',
  ceo: 'CEO',
};

interface Props {
  steps: ProcurementApprovalStep[];
}

// The only multi-stage approval stepper in the app — every other "Timeline"
// in this codebase is a single-event row or a flat activity feed (see the
// Procurement Management plan's research). Shows the whole approval path up
// front: completed stages checked, the current one highlighted, future ones
// greyed, and a rejection stops the chain visibly rather than just vanishing.
export function ApprovalTimeline({ steps }: Props) {
  if (!steps.length) return null;

  return (
    <View style={styles.container}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const label = STAGE_LABEL[step.stage_key] || step.stage_key;

        let iconName: keyof typeof Ionicons.glyphMap = 'ellipse-outline';
        let iconColor: string = Colors.textMuted;
        let labelColor: string = Colors.textMuted;

        if (step.status === 'approved') {
          iconName = 'checkmark-circle';
          iconColor = Colors.success;
          labelColor = Colors.textPrimary;
        } else if (step.status === 'rejected') {
          iconName = 'close-circle';
          iconColor = Colors.error;
          labelColor = Colors.error;
        } else if (step.status === 'returned') {
          iconName = 'arrow-undo-circle';
          iconColor = Colors.warning;
          labelColor = Colors.warning;
        } else if (step.status === 'skipped') {
          iconName = 'remove-circle-outline';
          iconColor = Colors.textMuted;
        } else if (step.status === 'pending') {
          // First pending stage in the list is the "current" one awaiting action.
          const isCurrent = !steps.slice(0, i).some((s) => s.status === 'pending');
          if (isCurrent) {
            iconName = 'time';
            iconColor = Colors.orange;
            labelColor = Colors.textPrimary;
          }
        }

        return (
          <View key={step.id} style={styles.row}>
            <View style={styles.iconColumn}>
              <Ionicons name={iconName} size={20} color={iconColor} />
              {!isLast ? <View style={[styles.connector, { backgroundColor: step.status === 'approved' ? Colors.success : Colors.border }]} /> : null}
            </View>
            <View style={styles.content}>
              <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
              {step.status === 'approved' && step.approved_by_name ? (
                <Text style={styles.sub}>Approved by {step.approved_by_name}{step.approved_at ? ` · ${new Date(step.approved_at).toLocaleDateString()}` : ''}</Text>
              ) : step.status === 'rejected' ? (
                <Text style={[styles.sub, { color: Colors.error }]}>Rejected{step.approved_by_name ? ` by ${step.approved_by_name}` : ''}{step.notes ? ` — ${step.notes}` : ''}</Text>
              ) : step.status === 'returned' ? (
                <Text style={[styles.sub, { color: Colors.warning }]}>Returned for revision{step.approved_by_name ? ` by ${step.approved_by_name}` : ''}{step.notes ? ` — ${step.notes}` : ''}</Text>
              ) : step.status === 'skipped' ? (
                <Text style={styles.sub}>Skipped</Text>
              ) : (
                <Text style={styles.sub}>Awaiting decision</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing.xs },
  row: { flexDirection: 'row' },
  iconColumn: { alignItems: 'center', width: 28 },
  connector: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
  content: { flex: 1, paddingBottom: Spacing.md, paddingLeft: Spacing.sm },
  label: { fontSize: Typography.base, fontWeight: Typography.semibold },
  sub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
});
