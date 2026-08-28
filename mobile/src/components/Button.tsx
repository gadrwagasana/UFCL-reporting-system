import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Layout } from '../theme';

// Enterprise UI/UX Standardization Phase 1, Workstream B — the app's first
// shared Button component. 131 screens currently use raw TouchableOpacity
// with independent inline styles (no shared component existed at all); this
// is a drop-in for new/touched code, not a forced rewrite of every button.
// Variants mirror desktop's existing button classes: Primary/Secondary map
// directly to .bp1/.bs1; Danger matches the solid-red "confirm delete"
// pattern desktop uses for destructive actions (renderer/app.js
// confirmDelete); Outline/Ghost are new but built from the same color
// tokens so they stay visually consistent with everything else.
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  // Escape hatch for screens with an established bespoke accent color (e.g.
  // a navy "Update Status" action button) so adopting Button doesn't force
  // a color change — the 5 variants above remain the default, recommended
  // palette for anything new.
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLE: Record<ButtonVariant, { bg: string; border?: string; text: string }> = {
  primary:   { bg: Colors.green,       text: Colors.white },
  secondary: { bg: 'transparent',      border: Colors.border, text: Colors.textSecondary },
  danger:    { bg: Colors.error,       text: Colors.white },
  outline:   { bg: 'transparent',      border: Colors.navy, text: Colors.navy },
  ghost:     { bg: 'transparent',      text: Colors.navy },
};

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon,
  disabled = false, loading = false, fullWidth = false, color, style,
}: ButtonProps) {
  const v = VARIANT_STYLE[variant];
  const isDisabled = disabled || loading;
  const solid = variant === 'primary' || variant === 'danger';
  const bg = solid ? (color || v.bg) : v.bg;
  const border = !solid ? (color || v.border) : v.border;
  const text = solid ? v.text : (color || v.text);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      // Enterprise UI/UX Standardization Phase 3 — hitSlop on the compact
      // `sm` size brings its effective tap target closer to the 44pt/48dp
      // guideline without changing its visual height, so screens already
      // migrated in Phases 1-2 don't get a layout/visual change here.
      hitSlop={size === 'sm' ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: bg, borderColor: border || 'transparent', borderWidth: border ? 1.5 : 0 },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={text} style={styles.icon} /> : null}
          <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: text }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  md: { height: Layout.buttonHeight, paddingHorizontal: Spacing.lg },
  sm: { height: 36, paddingHorizontal: Spacing.md },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  icon: { marginRight: 2 },
  label: { fontSize: Typography.base, fontWeight: Typography.semibold },
  labelSm: { fontSize: Typography.sm },
});
