import React from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({ message, fullScreen = false }: Props) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={Colors.navy} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  text: {
    fontSize: Typography.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
