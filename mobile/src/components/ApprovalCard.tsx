import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, Modal,
  Pressable, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../theme';
import { StatusBadge } from './StatusBadge';

interface ApprovalCardProps {
  title:           string;
  subtitle?:       string;
  meta?:           Array<{ label: string; value: string }>;
  status:          string;
  onApprove?:      () => Promise<void>;
  onReject?:       (reason: string) => Promise<void>;
  approveLabel?:   string;
  rejectLabel?:    string;
  disabled?:       boolean;
  children?:       React.ReactNode;
}

export function ApprovalCard({
  title, subtitle, meta = [], status,
  onApprove, onReject,
  approveLabel = 'Approve',
  rejectLabel  = 'Reject',
  disabled,
  children,
}: ApprovalCardProps) {
  const [loading, setLoading]   = useState<'approve' | 'reject' | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [reason, setReason]     = useState('');

  async function handleApprove() {
    if (!onApprove || loading) return;
    setLoading('approve');
    try { await onApprove(); } finally { setLoading(null); }
  }

  async function handleReject() {
    if (!onReject || loading) return;
    setLoading('reject');
    try { await onReject(reason); setRejectModal(false); setReason(''); }
    finally { setLoading(null); }
  }

  const isPending = status === 'pending';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <StatusBadge status={status} size="sm" />
      </View>

      {meta.length > 0 && (
        <View style={styles.meta}>
          {meta.map((m, i) => (
            <View key={i} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{m.label}</Text>
              <Text style={styles.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>
      )}

      {children}

      {isPending && (onApprove || onReject) && !disabled ? (
        <View style={styles.actions}>
          {onReject ? (
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => setRejectModal(true)}
              activeOpacity={0.8}
              disabled={loading !== null}
            >
              {loading === 'reject'
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={styles.rejectText}>{rejectLabel}</Text>}
            </TouchableOpacity>
          ) : null}
          {onApprove ? (
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={handleApprove}
              activeOpacity={0.8}
              disabled={loading !== null}
            >
              {loading === 'approve'
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.approveText}>{approveLabel}</Text>}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Reject reason modal */}
      <Modal visible={rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRejectModal(false)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Reason for rejection</Text>
          <TextInput
            style={styles.reasonInput}
            multiline
            numberOfLines={4}
            placeholder="Enter reason (optional)…"
            placeholderTextColor={Colors.textMuted}
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => setRejectModal(false)} activeOpacity={0.8}>
              <Text style={styles.rejectText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={handleReject} activeOpacity={0.8} disabled={loading !== null}>
              {loading === 'reject'
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.approveText}>Confirm reject</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  headerLeft: { flex: 1 },
  title: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: Spacing.xxs },
  meta: { gap: Spacing.xs },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  metaValue: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  rejectBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: { fontSize: Typography.base, color: Colors.error, fontWeight: Typography.semibold },
  approveBtn: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.green,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { fontSize: Typography.base, color: Colors.white, fontWeight: Typography.semibold },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  modalSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  modalTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  reasonInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    minHeight: 100,
  },
});
