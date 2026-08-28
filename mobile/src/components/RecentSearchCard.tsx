import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, TextStyles } from '../theme';

interface Props {
  query:     string;
  onPress:   () => void;
  onRemove:  () => void;
}

export function RecentSearchCard({ query, onPress, onRemove }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
      <Text style={styles.text} numberOfLines={1}>{query}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  text: {
    ...TextStyles.body,
    color: Colors.textPrimary,
    flex: 1,
  },
});
