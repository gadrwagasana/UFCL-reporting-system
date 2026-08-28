import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../stores/toastStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const AUTO_HIDE_MS = 2600;

// Mounted once at the app root (see App.tsx) — call showToast() from any
// screen to surface a success/error/warning/info message, matching the
// desktop app's showToast() helper so both platforms give the same feedback
// for the same actions (see PROCUREMENT_PHASE2A_UI_REPORT.md, "Shared
// design fixes"). warning/info added in Phase 3.
const TYPE_META: Record<string, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: Colors.greenDark, icon: 'checkmark-circle' },
  error:   { bg: Colors.error,     icon: 'alert-circle' },
  warning: { bg: '#B45309',        icon: 'warning' },
  info:    { bg: Colors.navy,      icon: 'information-circle' },
};

export function Toast() {
  const { message, type, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => hide());
    }, AUTO_HIDE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [message]);

  if (!message) return null;
  const m = TYPE_META[type] || TYPE_META.success;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + Spacing.lg, opacity, backgroundColor: m.bg }]}
    >
      <Ionicons name={m.icon} size={18} color={Colors.white} />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: Spacing.lg, right: Spacing.lg, zIndex: 999,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    ...Shadow.lg,
  },
  text: { flex: 1, color: Colors.white, fontSize: Typography.sm, fontWeight: Typography.medium },
});
