import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { StatusBadge } from './StatusBadge';
import { SEARCH_MODULE_LABEL, SEARCH_MODULE_ICON } from '../constants/searchModules';
import type { SearchResult } from '../types/api';

interface Props {
  result: SearchResult | null;
  onClose: () => void;
}

// Read-only fallback for modules with no direct-navigation target yet (see
// DIRECT_NAV_MODULE in constants/searchModules.ts and the redesign plan's
// punch-list). Honest about the limitation — shows exactly what the search
// result already carries, rather than guessing at a screen that may not exist.
export function SearchResultDetailSheet({ result, onClose }: Props) {
  if (!result) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <SafeAreaView>
          <View style={styles.header}>
            <View style={styles.moduleRow}>
              <Ionicons name={SEARCH_MODULE_ICON[result.module]} size={16} color={Colors.textMuted} />
              <Text style={styles.moduleLabel}>{SEARCH_MODULE_LABEL[result.module]}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{result.title}</Text>
            {result.status ? <StatusBadge status={result.status} /> : null}
            {result.subtitle ? <Text style={styles.subtitle}>{result.subtitle}</Text> : null}
            {result.description ? <Text style={styles.description}>{result.description}</Text> : null}
            {result.created_at ? (
              <Text style={styles.date}>{new Date(result.created_at).toLocaleDateString()}</Text>
            ) : null}

            <Text style={styles.note}>
              A dedicated detail screen for this record isn't available yet — this is a preview
              of what search already knows.
            </Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    top: '25%',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  moduleLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  body: { padding: Spacing.base, gap: Spacing.xs },
  title: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  subtitle: { fontSize: Typography.base, color: Colors.textSecondary, marginTop: Spacing.xxs },
  description: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: Spacing.xxs },
  date: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.sm },
  note: {
    fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic',
    marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  closeBtn: {
    margin: Spacing.base, marginTop: 0, backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  closeText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
