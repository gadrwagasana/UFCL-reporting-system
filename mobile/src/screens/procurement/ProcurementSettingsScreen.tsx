import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { useProcurementConfig, useProcurementConfigActions } from '../../hooks/useProcurementDashboard';
import { useAuth } from '../../hooks/useAuth';
import { showToast } from '../../stores/toastStore';
import { ProcurementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'ProcurementSettings'>;

// Page itself is only reachable via a button shown on ProcurementDashboardScreen
// for admin/ceo (see that screen). The `canEdit` check below is a second,
// defense-in-depth layer, matching desktop's renderProcurementSettings — the
// real enforcement is procurementConfigUpdate's existing admin/ceo check in
// data.js, which this screen does not alter.
export function ProcurementSettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'ceo';
  const { data, isLoading, isError, refetch } = useProcurementConfig();
  const { update } = useProcurementConfigActions();
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.config) setThreshold(String(Number(data.config.ceo_threshold || 0)));
  }, [data?.config?.ceo_threshold]);

  if (isLoading || !data) return <LoadingState message="Loading settings…" fullScreen />;
  if (isError) return <ErrorState message="Could not load procurement settings" onRetry={refetch} fullScreen />;

  const cfg = data.config;
  const originalValue = String(Number(cfg.ceo_threshold || 0));

  function onCancel() {
    setThreshold(originalValue);
    setError('');
  }

  async function onSave() {
    setError('');
    const val = Number(threshold.trim());
    if (threshold.trim() === '' || Number.isNaN(val) || val < 0) {
      setError('Enter a valid non-negative amount.');
      return;
    }
    setSaving(true);
    try {
      const res = await update(val);
      if (!res.ok) {
        setError(res.error ?? 'Could not save settings.');
        return;
      }
      showToast('Procurement settings saved.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Procurement Settings" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!canEdit ? (
          <View style={styles.readonlyBanner}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.warning} />
            <Text style={styles.readonlyText}>You have read-only access — only Admin/CEO can change these settings.</Text>
          </View>
        ) : null}

        <Text style={styles.sectionHdr}>Approval Thresholds</Text>
        <View style={styles.card}>
          <Text style={styles.label}>CEO Approval Threshold (RWF) *</Text>
          <TextInput
            style={[styles.input, !canEdit && styles.inputDisabled]}
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="numeric"
            editable={canEdit}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.helper}>
            Purchase requisitions with an estimated total above this amount require an additional CEO approval
            stage, on top of the standard Supervisor → Department Manager → Procurement Review → Finance chain.
            Requisitions at or below this amount skip the CEO stage. This does not change who can approve each
            existing stage — only whether the CEO stage is added.
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {cfg.updated_at ? (
            <Text style={styles.metaText}>
              Last updated {new Date(cfg.updated_at).toLocaleString()}{cfg.updated_by_name ? ` by ${cfg.updated_by_name}` : ''}
            </Text>
          ) : null}

          {canEdit ? (
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  readonlyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.base,
  },
  readonlyText: { flex: 1, fontSize: Typography.sm, color: Colors.warning },
  sectionHdr: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card },
  inputDisabled: { backgroundColor: Colors.bg, color: Colors.textMuted },
  helper: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  errorText: { fontSize: Typography.sm, color: Colors.error, marginTop: Spacing.sm },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.sm },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: Typography.base, fontWeight: Typography.medium },
  saveBtn: { flex: 1, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  saveBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
