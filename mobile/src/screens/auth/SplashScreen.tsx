import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Typography, Spacing } from '../../theme';

export function SplashScreen() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession().catch(() => {
      // restoreSession has an inner try/finally and should never reject.
      // This is a final safety net: if it somehow does, force isLoading=false
      // so the app always reaches the Login screen rather than hanging.
      useAuthStore.setState({ isLoading: false });
    });
  }, [restoreSession]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.logo}>UFCL</Text>
      <Text style={styles.tagline}>Production Management</Text>
      <ActivityIndicator
        size="large"
        color="rgba(255,255,255,0.7)"
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logo: {
    fontSize: 52,
    fontWeight: Typography.bold,
    color: Colors.white,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: Typography.base,
    color: Colors.textOnDarkMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  spinner: {
    marginTop: Spacing.xxl,
  },
});
