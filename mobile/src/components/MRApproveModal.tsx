import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { FormSelect } from './FormSelect';
import { Colors, Spacing, Typography, Radius } from '../theme';

// Stabilization Phase 5 (F-6) — extracted from WorkshopOverviewScreen.tsx
// (its original, sole location) so MaterialRequestDetailScreen can offer the
// same approve action directly, rather than only via the Workshop Overview
// tab. Behavior/fields unchanged: approving a Material Request always
// creates an approved Stock Transfer, so a source workshop (and, when the
// request itself has no destination, a destination workshop too) must be
// picked here — mirrors desktop's approve overlay's mandatory selects.

interface MRApproveItem {
  id:            number;
  item_name:     string;
  requested_qty: number;
  uom?:          string;
  workshop_id?:  number | null;
}

interface MRApproveWorkshop {
  id:   number;
  name: string;
}

export function MRApproveModal({
  item, workshops, onClose, onConfirm, loading,
}: {
  item: MRApproveItem | null;
  workshops: MRApproveWorkshop[];
  onClose: () => void;
  onConfirm: (qty: number, sourceWarehouseId: number, destinationWorkshopId: number | null, notes: string) => void;
  loading: boolean;
}) {
  const [qty, setQty]           = useState('');
  const [sourceId, setSourceId] = useState<string | number | null>(null);
  const [destId, setDestId]     = useState<string | number | null>(null);
  const [notes, setNotes]       = useState('');

  React.useEffect(() => {
    if (item) { setQty(String(item.requested_qty)); setSourceId(null); setDestId(null); setNotes(''); }
  }, [item]);

  const needsDest = !!item && !item.workshop_id;
  const whOptions = workshops.map(w => ({ label: w.name, value: w.id }));
  const canSubmit = Number(qty) > 0 && sourceId != null && (!needsDest || destId != null) && !loading;

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Approve Request</Text>
          {item && <Text style={styles.modalSub}>{item.item_name} — requested {item.requested_qty} {item.uom}</Text>}
          <View style={styles.modalField}>
            <Text style={styles.modalFieldLabel}>Approved Quantity <Text style={{ color: Colors.error }}>*</Text></Text>
            <TextInput
              style={styles.modalInput}
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel="Approved quantity"
            />
          </View>
          <FormSelect
            label="Source Workshop (to issue from)"
            options={whOptions}
            value={sourceId}
            onChange={setSourceId}
            required
          />
          {needsDest && (
            <FormSelect
              label="Destination Workshop (to receive)"
              options={whOptions}
              value={destId}
              onChange={setDestId}
              required
            />
          )}
          <View style={styles.modalField}>
            <Text style={styles.modalFieldLabel}>Notes <Text style={{ color: Colors.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
            <TextInput
              style={styles.modalInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes…"
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel="Notes (optional)"
            />
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} disabled={loading} accessibilityRole="button">
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, !canSubmit && styles.btnDisabled]}
              onPress={() => { if (canSubmit) onConfirm(Number(qty), Number(sourceId), needsDest ? Number(destId) : null, notes.trim()); }}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.modalConfirmText}>Confirm Approve</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: Spacing.xl },
  modalCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  modalSub:     { fontSize: Typography.xs, color: Colors.textSecondary },
  modalField:      { gap: 4 },
  modalFieldLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  modalActions:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  modalCancelBtn:   { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  modalCancelText:  { fontSize: Typography.sm, color: Colors.textSecondary },
  modalConfirmBtn:  { flex: 2, backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  modalConfirmText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled:      { opacity: 0.4 },
});
