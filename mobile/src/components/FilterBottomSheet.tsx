import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Pressable, SafeAreaView, StyleSheet,
} from 'react-native';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { SEARCH_MODULE_LABEL, SEARCH_SORT_OPTIONS } from '../constants/searchModules';
import type { SearchFilters, SearchModule, SearchSort } from '../types/api';

interface Props {
  visible:        boolean;
  onClose:        () => void;
  filters:        SearchFilters;
  onApply:        (filters: SearchFilters) => void;
  availableModules: SearchModule[]; // pre-filtered by the caller's permissions
}

// Built from RN's own Modal (transparent + slide, bottom-anchored, rounded top
// corners) — this codebase has no bottom-sheet library, and FormSelect.tsx
// already establishes this exact overlay/sheet visual language.
export function FilterBottomSheet({ visible, onClose, filters, onApply, availableModules }: Props) {
  const [pending, setPending] = useState<SearchFilters>(filters);

  useEffect(() => {
    if (visible) setPending(filters);
  }, [visible, filters]);

  function apply() {
    onApply(pending);
    onClose();
  }
  function clearAll() {
    setPending({});
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <SafeAreaView>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={clearAll} hitSlop={8}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Module</Text>
            <View style={styles.chips}>
              <Chip
                label="All"
                selected={!pending.module}
                onPress={() => setPending((p) => ({ ...p, module: undefined }))}
              />
              {availableModules.map((m) => (
                <Chip
                  key={m}
                  label={SEARCH_MODULE_LABEL[m]}
                  selected={pending.module === m}
                  onPress={() => setPending((p) => ({ ...p, module: m }))}
                />
              ))}
            </View>

            <Text style={styles.label}>Sort by</Text>
            <View style={styles.chips}>
              {SEARCH_SORT_OPTIONS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={(pending.sort ?? 'newest') === s.value}
                  onPress={() => setPending((p) => ({ ...p, sort: s.value as SearchSort }))}
                />
              ))}
            </View>

            <Text style={styles.label}>Status</Text>
            <TextInput
              style={styles.input}
              value={pending.status ?? ''}
              onChangeText={(v) => setPending((p) => ({ ...p, status: v || undefined }))}
              placeholder="e.g. Pending, Approved, Active…"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Department</Text>
            <TextInput
              style={styles.input}
              value={pending.department ?? ''}
              onChangeText={(v) => setPending((p) => ({ ...p, department: v || undefined }))}
              placeholder="e.g. Logistics"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Created by</Text>
            <TextInput
              style={styles.input}
              value={pending.createdBy ?? ''}
              onChangeText={(v) => setPending((p) => ({ ...p, createdBy: v || undefined }))}
              placeholder="Staff name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Date range</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.half]}
                value={pending.fromDate ?? ''}
                onChangeText={(v) => setPending((p) => ({ ...p, fromDate: v || undefined }))}
                placeholder="From YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.half]}
                value={pending.toDate ?? ''}
                onChangeText={(v) => setPending((p) => ({ ...p, toDate: v || undefined }))}
                placeholder="To YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={apply} activeOpacity={0.8}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  clearText: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.medium },
  body: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  label: {
    fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary,
    marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.card,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.sm, color: Colors.textPrimary },
  chipTextActive: { color: Colors.white, fontWeight: Typography.semibold },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  actions: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  applyBtn: {
    flex: 2, backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  applyText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
