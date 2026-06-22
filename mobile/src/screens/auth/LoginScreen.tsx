import React, { useState, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { FormInput } from '../../components/FormInput';
import { Colors, Spacing, Typography, Radius, Layout } from '../../theme';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const pwRef = useRef<TextInput>(null);

  const login    = useAuthStore((s) => s.login);
  const error    = useAuthStore((s) => s.error);
  const clearErr = useAuthStore((s) => s.clearError);

  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) return;
    clearErr();
    setLoading(true);
    try {
      await login(username.trim(), password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>UFCL</Text>
            <Text style={styles.subtitle}>Production Management</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <FormInput
              label="Username"
              required
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
              placeholder="Enter your username"
            />

            <View style={styles.pwWrapper}>
              <FormInput
                ref={pwRef}
                label="Password"
                required
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                placeholder="Enter your password"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPw((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, (loading || !username || !password) && styles.loginBtnDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading || !username.trim() || !password}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.loginBtnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>UFCL Mobile v1.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.navy },
  kav:     { flex: 1 },
  scroll:  {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.base,
    gap: Spacing.xl,
  },
  header: { alignItems: 'center', gap: Spacing.xs },
  logo: {
    fontSize: 48,
    fontWeight: Typography.bold,
    color: Colors.white,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textOnDarkMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  cardTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sm,
    lineHeight: Typography.sm * 1.5,
  },
  pwWrapper: { position: 'relative' },
  eyeBtn: {
    position: 'absolute',
    right: Spacing.md,
    bottom: 14,
  },
  eyeText: {
    fontSize: Typography.sm,
    color: Colors.navy,
    fontWeight: Typography.medium,
  },
  loginBtn: {
    height: Layout.buttonHeight,
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  loginBtnDisabled: { opacity: 0.55 },
  loginBtnText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  version: {
    textAlign: 'center',
    fontSize: Typography.xs,
    color: Colors.textOnDarkMuted,
  },
});
