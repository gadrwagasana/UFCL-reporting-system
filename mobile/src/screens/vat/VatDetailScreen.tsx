import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, Modal, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { ReasonModal }  from '../../components/ReasonModal';
import { useVatDelete, useVatUpdate } from '../../hooks/useVat';
import { useOfflineStore } from '../../stores/offlineStore';
import { VatEntriesStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = VatEntriesStackScreenProps<'VatDetail'>;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

// Nyanza Value-Added Production Completion Phase — a batch can now have
// multiple input and output lines (was a single flat VAT entry before), so
// this becomes a genuine drill-down rather than a re-display of the list row.
// ERP Enterprise Cross-Department Verification — Delete had backend
// (valueAddedProductionBatchDelete) and desktop UI (app.js), but the mobile
// hook (useVatDelete) was never called from any screen — a real
// Backend=YES/Desktop=YES/Mobile=NO gap found during audit. Wired here
// reusing the exact ReasonModal delete pattern MachineFuelDetailScreen
// already established, including pendingApproval handling.
export function VatDetailScreen({ navigation, route }: Props) {
  const { batch } = route.params;
  const totalInput  = batch.inputs.reduce((s, i) => s + Number(i.quantity), 0);
  const totalOutput = batch.outputs.reduce((s, o) => s + Number(o.quantity), 0);

  const { deleteBatch } = useVatDelete();
  const { updateBatch } = useVatUpdate();
  const { isOnline }    = useOfflineStore();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [orderRef, setOrderRef]     = useState(batch.order_reference ?? '');
  const [operator, setOperator]     = useState(batch.operator ?? '');
  const [supervisor, setSupervisor] = useState(batch.supervisor ?? '');
  const [notes, setNotes]           = useState(batch.notes ?? '');

  async function submitEdit() {
    setSaving(true);
    try {
      const result = await updateBatch(batch.id, {
        batch_date: batch.batch_date,
        production_type: batch.production_type,
        customer_id: batch.customer_id,
        order_reference: orderRef.trim() || null,
        operator: operator.trim() || null,
        supervisor: supervisor.trim() || null,
        notes: notes.trim() || null,
      });
      setShowEdit(false);
      if (result && 'pendingApproval' in result && result.pendingApproval) {
        Alert.alert('Submitted for Review', result.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update this production batch.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Deleting a production batch requires an active connection.');
      return;
    }
    setShowDelete(true);
  }

  async function submitDelete(reason: string) {
    if (!reason.trim()) return;
    setDeleting(true);
    try {
      const result = await deleteBatch(batch.id, reason.trim());
      setShowDelete(false);
      if (result && 'pendingApproval' in result && result.pendingApproval) {
        Alert.alert('Submitted for Review', result.message);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not delete this production batch.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Production Batch Detail" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Text style={styles.dateText}>{batch.date_fmt}</Text>
          <Text style={styles.typeText}>{batch.production_type || 'Production Batch'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <Row label="Customer"          value={batch.customer_name} />
          <Row label="Order Reference"   value={batch.order_reference} />
          <Row label="Operator"          value={batch.operator} />
          <Row label="Supervisor"        value={batch.supervisor} />
          <Row label="Notes"             value={batch.notes} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Input material ({totalInput} total)</Text>
          {batch.inputs.map((i, idx) => (
            <Row key={idx} label={i.stock_item_name} value={i.quantity} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Output product(s) ({totalOutput} total)</Text>
          {batch.outputs.map((o) => (
            <View key={o.id} style={styles.outputRow}>
              <Text style={styles.rowLabel}>{o.type}{o.sub_type ? ` ${o.sub_type}` : ''} {o.size} × {o.quantity}</Text>
              <Text style={[styles.statusText, o.status === 'inspected' ? { color: Colors.success } : { color: Colors.warning }]}>
                {o.status === 'inspected'
                  ? `Inspected — ${o.inspection_approved_qty ?? 0} ok / ${o.inspection_rejected_qty ?? 0} rej`
                  : 'Pending QC'}
              </Text>
            </View>
          ))}
        </View>

        {batch.created_by_name && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Record Info</Text>
            <Row label="Created By" value={batch.created_by_name} />
          </View>
        )}

        {isOnline && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={16} color={Colors.navy} />
              <Text style={styles.editBtnText}>Edit Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={styles.deleteBtnText}>Delete Production Batch</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ReasonModal
        visible={showDelete}
        title="Delete Production Batch"
        message={`Enter a reason for deleting this batch (${batch.date_fmt}). Input stock consumption will be reversed; already-posted output stock from a completed inspection is left untouched.`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setShowDelete(false)}
        onConfirm={submitDelete}
      />

      {/* Metadata-only edit — input/output lines already have real stock/QC
          consequences and stay uneditable, same boundary the backend and
          desktop UI both draw. */}
      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowEdit(false)} />
        <View style={styles.editSheet}>
          <Text style={styles.editTitle}>Edit Batch Details</Text>
          <Text style={styles.editLabel}>Order Reference</Text>
          <TextInput style={styles.editInput} value={orderRef} onChangeText={setOrderRef} placeholder="Order reference" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.editLabel}>Operator</Text>
          <TextInput style={styles.editInput} value={operator} onChangeText={setOperator} placeholder="Operator" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.editLabel}>Supervisor</Text>
          <TextInput style={styles.editInput} value={supervisor} onChangeText={setSupervisor} placeholder="Supervisor" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.editLabel}>Notes</Text>
          <TextInput style={[styles.editInput, styles.editTextArea]} value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.editCancelBtn} onPress={() => setShowEdit(false)} activeOpacity={0.8} disabled={saving}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editSaveBtn} onPress={submitEdit} activeOpacity={0.8} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.editSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  header: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm,
  },
  dateText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  typeText: { fontSize: Typography.sm, color: Colors.textSecondary },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel:  { fontSize: Typography.sm, color: Colors.textSecondary },
  rowValue:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  outputRow: { paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 2 },
  statusText: { fontSize: Typography.xs, fontWeight: Typography.medium },

  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.navyBg, borderRadius: Radius.lg, padding: Spacing.base,
  },
  editBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.navy },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.errorBg, borderRadius: Radius.lg, padding: Spacing.base,
  },
  deleteBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.error },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  editSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.lg,
  },
  editTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  editLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  editInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm,
    fontSize: Typography.base, color: Colors.textPrimary,
  },
  editTextArea: { minHeight: 70, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  editCancelBtn: {
    flex: 1, height: 46, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  editCancelText: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  editSaveBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  editSaveText: { fontSize: Typography.base, color: Colors.white, fontWeight: Typography.semibold },
});
