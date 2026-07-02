import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Colors, Spacing, Typography, Radius } from '../theme';

interface Props {
  visible:       boolean;
  title:         string;
  message?:      string;
  confirmLabel?: string;
  loading?:      boolean;
  onCancel:      () => void;
  onConfirm:     (reason: string) => void;
}

export function ReasonModal({
  visible,
  title,
  message = 'Please provide a reason.',
  confirmLabel = 'Submit',
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  const canSubmit = reason.trim().length > 0 && !loading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
            autoFocus
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{reason.length}/500</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canSubmit && styles.btnDisabled]}
              onPress={() => { if (canSubmit) onConfirm(reason.trim()); }}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  title:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  message: { fontSize: Typography.sm,   color: Colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg, minHeight: 100,
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },
  actions:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cancelText:  { fontSize: Typography.sm, color: Colors.textSecondary },
  confirmBtn: {
    flex: 2, backgroundColor: Colors.error,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  confirmText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled: { opacity: 0.4 },
});
