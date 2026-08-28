import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';

// Enterprise UI/UX Standardization Phase 1, Workstream D — mobile counterpart
// to desktop's alertHtml(). Toast.tsx covers transient success/error
// feedback (auto-hides after ~2.6s, not user-dismissible, floats over the
// screen) — a different job from this: a persistent, inline, optionally
// dismissible banner for page-level context (e.g. the ad-hoc warnBanner
// DeliveryDetailScreen already hand-rolled for one screen, generalized here
// to all 4 severities instead of being copied to the next screen that needs it).
export type AlertType = 'critical' | 'warning' | 'info' | 'success';

interface AlertBannerProps {
  type: AlertType;
  message: string;
  dismissible?: boolean;
}

const TYPE_META: Record<AlertType, { bg: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  critical: { bg: Colors.errorBg,   color: Colors.error,   icon: 'alert-circle-outline' },
  warning:  { bg: Colors.warningBg, color: Colors.warning, icon: 'warning-outline' },
  info:     { bg: Colors.infoBg,    color: Colors.info,    icon: 'information-circle-outline' },
  success:  { bg: Colors.successBg, color: Colors.success, icon: 'checkmark-circle-outline' },
};

export function AlertBanner({ type, message, dismissible = false }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const m = TYPE_META[type];

  return (
    <View style={[styles.wrap, { backgroundColor: m.bg }]} accessibilityRole="alert">
      <Ionicons name={m.icon} size={18} color={m.color} />
      <Text style={[styles.text, { color: m.color }]}>{message}</Text>
      {dismissible ? (
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={16} color={m.color} style={{ opacity: 0.7 }} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  text: { flex: 1, fontSize: Typography.sm, fontWeight: Typography.medium },
});
