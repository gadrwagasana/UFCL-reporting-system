import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBadge }  from '../../components/StatusBadge';
import { useAuth }      from '../../hooks/useAuth';
import { usePolesApprove } from '../../hooks/usePolesRequests';
import { CeoApprovalsStackScreenProps } from '../../navigation/types';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type RouteProps = CeoApprovalsStackScreenProps<'ApprovalDetail'>['route'];
type NavProps   = CeoApprovalsStackScreenProps<'ApprovalDetail'>['navigation'];

interface DetailRowProps { label: string; value: string }
function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ApprovalDetailScreen() {
  const route      = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const { can }    = useAuth();
  const { approve, reject } = usePolesApprove();

  const { item } = route.params;

  const [approving, setApproving]   = useState(false);
  const [rejecting, setRejecting]   = useState(false);
  const [modalVisible, setModal]     = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const canAct = item.status === 'pending' && can('ceo.approve');

  async function handleApprove() {
    setApproving(true);
    try {
      await approve(item.id);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not approve request. Please try again.');
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      await reject(item.id, rejectReason.trim());
      setModal(false);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not reject request. Please try again.');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Request Details"
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.supplierName}>{item.supplier_name}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.submittedDate}>
            Submitted {formatDate(item.requested_at)}
          </Text>
        </View>

        {/* Detail grid */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request Details</Text>
          <View style={styles.divider} />
          <DetailRow label="Requested Qty" value={String(item.requested_qty)} />
          <View style={styles.rowDivider} />
          <DetailRow
            label="Unit Price"
            value={item.unit_price != null ? formatCurrency(item.unit_price) : '—'}
          />
          <View style={styles.rowDivider} />
          <DetailRow label="Notes" value={item.notes?.trim() || '—'} />
        </View>

        {/* Timeline card — only if reviewed */}
        {(item.status === 'approved' || item.status === 'rejected') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review Timeline</Text>
            <View style={styles.divider} />
            <View style={styles.timelineRow}>
              <Ionicons
                name={item.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={item.status === 'approved' ? Colors.success : Colors.error}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineMain}>
                  {item.status === 'approved' ? 'Approved' : 'Rejected'}
                  {item.approved_by_name ? ` by ${item.approved_by_name}` : ''}
                </Text>
                {item.approved_at ? (
                  <Text style={styles.timelineSub}>{formatDateTime(item.approved_at)}</Text>
                ) : null}
              </View>
            </View>
            {item.status === 'rejected' && item.rejection_reason ? (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionLabel}>Rejection Reason</Text>
                <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Action buttons */}
        {canAct && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={handleApprove}
              disabled={approving || rejecting}
              activeOpacity={0.8}
            >
              {approving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </>
                )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => setModal(true)}
              disabled={approving || rejecting}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Request</Text>
            <Text style={styles.modalSubtitle}>
              Optionally provide a reason for {item.supplier_name}.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Rejection reason (optional)"
              placeholderTextColor={Colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setModal(false); setRejectReason(''); }}
                disabled={rejecting}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={handleReject}
                disabled={rejecting}
                activeOpacity={0.8}
              >
                {rejecting
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.modalBtnDangerText}>Confirm Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.sm,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  supplierName: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  submittedDate: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.base,
  },
  detailLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  detailValue: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.divider,
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
  timelineSub: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rejectionBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  rejectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  rejectionText: {
    fontSize: Typography.sm,
    color: Colors.error,
  },

  actions: {
    gap: Spacing.sm,
  },
  actionBtn: {
    height: 52,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  approveBtn: {
    backgroundColor: Colors.green,
  },
  approveBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
  rejectBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  rejectBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.error,
  },

  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    ...Shadow.lg,
  },
  modalTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.base,
  },
  reasonInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    minHeight: 80,
    marginBottom: Spacing.base,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnCancelText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  modalBtnDanger: {
    backgroundColor: Colors.error,
  },
  modalBtnDangerText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
