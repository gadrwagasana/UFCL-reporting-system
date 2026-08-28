import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Layout } from '../theme';

const DEBOUNCE_MS = 300;

interface Props {
  value:              string;
  onChangeText:       (text: string) => void;
  onDebouncedChange?: (text: string) => void;
  onFilterPress?:     () => void;
  filterActive?:      boolean;
  placeholder?:       string;
  autoFocus?:         boolean;
}

export function SearchBar({
  value, onChangeText, onDebouncedChange, onFilterPress, filterActive = false,
  placeholder = 'Search orders, customers, vehicles…', autoFocus = false,
}: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!onDebouncedChange) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onDebouncedChange(value), DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, onDebouncedChange]);

  return (
    <View style={styles.row}>
      <View style={styles.inputWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="search"
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {onFilterPress ? (
        <TouchableOpacity
          style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
          onPress={onFilterPress}
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={20} color={filterActive ? Colors.white : Colors.navy} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: Layout.inputHeight,
    gap: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.xxs,
  },
  input: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    height: '100%',
  },
  filterBtn: {
    width: Layout.inputHeight,
    height: Layout.inputHeight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
});
