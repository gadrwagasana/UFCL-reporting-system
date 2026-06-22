import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Modal, FlatList,
  SafeAreaView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Layout, Shadow } from '../theme';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface Props {
  label:     string;
  options:   SelectOption[];
  value:     string | number | null;
  onChange:  (value: string | number) => void;
  placeholder?: string;
  error?:    string;
  required?: boolean;
}

export function FormSelect({ label, options, value, onChange, placeholder = 'Select…', error, required }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : null]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <SafeAreaView>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.optionSelected]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {item.value === value
                    ? <Ionicons name="checkmark" size={18} color={Colors.navy} />
                    : null}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  required: { color: Colors.error },
  trigger: {
    height: Layout.inputHeight,
    borderWidth: Layout.borderWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
  },
  triggerError: { borderColor: Colors.error },
  triggerText: { fontSize: Typography.base, color: Colors.textPrimary, flex: 1 },
  placeholder: { color: Colors.textMuted },
  error: { fontSize: Typography.xs, color: Colors.error },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '60%',
    ...Shadow.lg,
  },
  sheetTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  optionSelected: { backgroundColor: Colors.bg },
  optionText: { fontSize: Typography.base, color: Colors.textPrimary },
  optionTextSelected: { fontWeight: Typography.semibold, color: Colors.navy },
});
