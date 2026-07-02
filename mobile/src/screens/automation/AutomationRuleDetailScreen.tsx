import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { UserRole } from '../../types/auth';
import { useAutomationRule, useUpdateAutomationRule } from '../../hooks/useAutomation';
import { AdminStackParamList } from '../../navigation/types';
import type { AutomationSeverity, AutomationAction } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav   = NativeStackNavigationProp<AdminStackParamList>;
type Props = NativeStackScreenProps<AdminStackParamList, 'AutomationRuleDetail'>;

const SEVERITIES: AutomationSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const ACTIONS: AutomationAction[]      = ['notify', 'draft_request', 'escalate', 'log_only'];

const SEV_BG: Record<string, string> = { critical:'#FEE2E2', high:'#FEF3C7', medium:'#DBEAFE', low:'#DCFCE7', info:'#E0E7FF' };
const SEV_FG: Record<string, string> = { critical:'#DC2626', high:'#D97706', medium:'#1D4ED8', low:'#16A34A', info:'#4F46E5' };

export function AutomationRuleDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Props['route']>();
  const { ruleKey } = route.params;

  const role     = useAuthStore(s => s.user?.role as UserRole | undefined);
  const canEdit  = !!(role && hasPermission(role, 'automation.edit_rules'));

  const { data: res, isLoading } = useAutomationRule(ruleKey);
  const updateRule = useUpdateAutomationRule();

  const [severity,      setSeverity]     = useState<AutomationSeverity>('medium');
  const [autoAction,    setAutoAction]   = useState<AutomationAction>('notify');
  const [cooldownHours, setCooldownHours]= useState('4');
  const [notifyRoles,   setNotifyRoles]  = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (res?.ok) {
      const r = res.rule;
      setSeverity(r.severity);
      setAutoAction(r.auto_action);
      setCooldownHours(String(r.cooldown_hours));
      setNotifyRoles((r.notify_roles || []).join(', '));
      setDirty(false);
    }
  }, [res]);

  function handleSave() {
    const cd = Number(cooldownHours);
    if (!Number.isFinite(cd) || cd < 0) {
      Alert.alert('Validation', 'Cooldown must be a non-negative number.');
      return;
    }
    const roles = notifyRoles.split(',').map(r => r.trim()).filter(Boolean);
    updateRule.mutate(
      { ruleKey, severity, auto_action: autoAction, cooldown_hours: cd, notify_roles: roles },
      {
        onSuccess: (r: any) => {
          if (r?.ok) { setDirty(false); Alert.alert('Saved', 'Rule updated.'); }
          else Alert.alert('Error', r?.error || 'Save failed.');
        },
        onError: () => Alert.alert('Error', 'Network error.'),
      },
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Rule Detail" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  if (!res?.ok) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Rule Detail" onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.errorText}>{(res as any)?.error || 'Failed to load rule.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rule = res.rule;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={rule.label} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Rule Identity</Text>
          <View style={s.field}><Text style={s.fieldLabel}>Key</Text><Text style={s.fieldMono}>{rule.rule_key}</Text></View>
          {rule.description ? (
            <View style={s.field}><Text style={s.fieldLabel}>Description</Text><Text style={s.fieldValue}>{rule.description}</Text></View>
          ) : null}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Status</Text>
            <View style={[s.statusChip, { backgroundColor: rule.enabled ? Colors.successBg : Colors.errorBg }]}>
              <Text style={[s.statusText, { color: rule.enabled ? Colors.success : Colors.error }]}>
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>

        {/* Editable fields */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{canEdit ? 'Configuration' : 'Configuration (read-only)'}</Text>

          {/* Severity */}
          <Text style={s.label}>Severity</Text>
          <View style={s.chipRow}>
            {SEVERITIES.map(sev => {
              const active = severity === sev;
              return (
                <TouchableOpacity
                  key={sev}
                  style={[s.chip, { backgroundColor: active ? (SEV_BG[sev] || '#F3F4F6') : Colors.bg, borderColor: active ? (SEV_FG[sev] || '#374151') : Colors.border }]}
                  onPress={() => { if (canEdit) { setSeverity(sev); setDirty(true); } }}
                  activeOpacity={canEdit ? 0.7 : 1}
                >
                  <Text style={[s.chipText, { color: active ? (SEV_FG[sev] || '#374151') : Colors.textMuted }]}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Auto Action */}
          <Text style={[s.label, { marginTop: Spacing.md }]}>Auto Action</Text>
          <View style={s.chipRow}>
            {ACTIONS.map(action => {
              const active = autoAction === action;
              return (
                <TouchableOpacity
                  key={action}
                  style={[s.chip, { backgroundColor: active ? Colors.navyBg : Colors.bg, borderColor: active ? Colors.navy : Colors.border }]}
                  onPress={() => { if (canEdit) { setAutoAction(action); setDirty(true); } }}
                  activeOpacity={canEdit ? 0.7 : 1}
                >
                  <Text style={[s.chipText, { color: active ? Colors.navy : Colors.textMuted }]}>
                    {action.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Cooldown */}
          <Text style={[s.label, { marginTop: Spacing.md }]}>Cooldown (hours)</Text>
          <TextInput
            style={[s.input, !canEdit && s.inputReadOnly]}
            value={cooldownHours}
            onChangeText={v => { setCooldownHours(v); setDirty(true); }}
            keyboardType="numeric"
            editable={canEdit}
          />

          {/* Notify Roles */}
          <Text style={[s.label, { marginTop: Spacing.md }]}>Notify Roles (comma-separated)</Text>
          <TextInput
            style={[s.input, !canEdit && s.inputReadOnly]}
            value={notifyRoles}
            onChangeText={v => { setNotifyRoles(v); setDirty(true); }}
            placeholder="admin, ceo, operations"
            placeholderTextColor={Colors.textMuted}
            editable={canEdit}
          />
        </View>

        {/* Threshold — read-only for all roles */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Threshold (read-only)</Text>
          <View style={s.codeBlock}>
            <Text style={s.codeText}>{JSON.stringify(rule.threshold || {}, null, 2)}</Text>
          </View>
          <Text style={s.threshNote}>Threshold values can only be edited from the desktop application.</Text>
        </View>

        {/* Last fired */}
        {rule.last_fired && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Last Activity</Text>
            <Text style={s.fieldValue}>Last fired: {new Date(rule.last_fired).toLocaleString()}</Text>
            <Text style={s.fieldValue}>Updated: {new Date(rule.updated_at).toLocaleString()}</Text>
          </View>
        )}

        {/* Save */}
        {canEdit && (
          <TouchableOpacity
            style={[s.saveBtn, (!dirty || updateRule.isPending) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!dirty || updateRule.isPending}
            activeOpacity={0.8}
          >
            <Text style={s.saveBtnText}>{updateRule.isPending ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: Typography.sm, color: Colors.error, textAlign: 'center' },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },

  field:       { marginBottom: Spacing.xs },
  fieldLabel:  { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 2 },
  fieldValue:  { fontSize: Typography.sm, color: Colors.textPrimary },
  fieldMono:   { fontSize: Typography.sm, color: Colors.textPrimary, fontFamily: 'monospace' },

  statusChip:  { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText:  { fontSize: Typography.xs, fontWeight: Typography.semibold },

  label:       { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:        { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.md, borderWidth: 1 },
  chipText:    { fontSize: Typography.xs, fontWeight: Typography.semibold },

  input:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.card },
  inputReadOnly: { backgroundColor: Colors.bg, color: Colors.textSecondary },

  codeBlock:   { backgroundColor: '#1E293B', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs },
  codeText:    { fontSize: 11, color: '#E2E8F0', fontFamily: 'monospace', lineHeight: 18 },
  threshNote:  { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },

  saveBtn:         { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { color: '#fff', fontSize: Typography.base, fontWeight: Typography.semibold },
});
