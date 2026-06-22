import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isValid } from 'date-fns';
import { Colors, Spacing, Typography, Radius, Layout } from '../theme';

interface Props {
  label:     string;
  value:     string | null;   // ISO date string 'yyyy-MM-dd'
  onChange:  (iso: string) => void;
  required?: boolean;
  error?:    string;
  minDate?:  Date;
  maxDate?:  Date;
}

export function DatePickerField({ label, value, onChange, required, error, minDate, maxDate }: Props) {
  const [open, setOpen] = useState(false);

  const date = value ? parseISO(value) : null;
  const displayText = date && isValid(date) ? format(date, 'dd MMM yyyy') : 'Select date…';

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
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} style={styles.icon} />
        <Text style={[styles.text, !value && styles.placeholder]}>{displayText}</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <DateTimePickerModal
        isVisible={open}
        mode="date"
        date={date && isValid(date) ? date : new Date()}
        minimumDate={minDate}
        maximumDate={maxDate ?? new Date()}
        onConfirm={(d) => { setOpen(false); onChange(format(d, 'yyyy-MM-dd')); }}
        onCancel={() => setOpen(false)}
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
      />
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
    backgroundColor: Colors.white,
  },
  triggerError: { borderColor: Colors.error },
  icon: { marginRight: Spacing.sm },
  text: { fontSize: Typography.base, color: Colors.textPrimary },
  placeholder: { color: Colors.textMuted },
  error: { fontSize: Typography.xs, color: Colors.error },
});
