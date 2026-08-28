import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { format, parse, isValid } from 'date-fns';
import { Colors, Spacing, Typography, Radius, Layout } from '../theme';

// Sawmill Timber Entry enhancement — Start/End Time capture. Mirrors
// DatePickerField almost exactly, reusing the same already-installed
// react-native-modal-datetime-picker dependency with mode="time" instead of
// building a new time-entry pattern from scratch.

interface Props {
  label:     string;
  value:     string | null;   // 'HH:mm'
  onChange:  (hhmm: string) => void;
  required?: boolean;
  error?:    string;
}

export function TimePickerField({ label, value, onChange, required, error }: Props) {
  const [open, setOpen] = useState(false);

  const time = value ? parse(value, 'HH:mm', new Date()) : null;
  const displayText = time && isValid(time) ? format(time, 'hh:mm a') : 'Select time…';

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
        <Ionicons name="time-outline" size={18} color={Colors.textMuted} style={styles.icon} />
        <Text style={[styles.text, !value && styles.placeholder]}>{displayText}</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <DateTimePickerModal
        isVisible={open}
        mode="time"
        date={time && isValid(time) ? time : new Date()}
        onConfirm={(d) => { setOpen(false); onChange(format(d, 'HH:mm')); }}
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
