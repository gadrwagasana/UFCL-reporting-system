import React from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}

// Phase 1 audit found zero search/filter UI on any of the 17 procurement
// screens despite the backend already supporting status filters. This is the
// mobile equivalent of the desktop .filter-bar component — one shared piece
// reused across the highest-traffic lists rather than duplicated per screen.
export function ListSearchBar({ value, onChangeText, placeholder }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Ionicons name="close-circle" size={16} color={Colors.textMuted} onPress={() => onChangeText('')} accessibilityLabel="Clear search" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
  },
  icon: { flexShrink: 0 },
  input: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, padding: 0 },
});
