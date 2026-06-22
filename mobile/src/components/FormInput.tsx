import React, { forwardRef } from 'react';
import { StyleSheet, View, Text, TextInput, TextInputProps } from 'react-native';
import { Colors, Spacing, Typography, Radius, Layout } from '../theme';

interface Props extends TextInputProps {
  label:      string;
  error?:     string;
  required?:  boolean;
  hint?:      string;
}

export const FormInput = forwardRef<TextInput, Props>(function FormInput(
  { label, error, required, hint, style, ...rest },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={Colors.textMuted}
        {...rest}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  required: {
    color: Colors.error,
  },
  input: {
    height: Layout.inputHeight,
    borderWidth: Layout.borderWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  error: {
    fontSize: Typography.xs,
    color: Colors.error,
  },
});
