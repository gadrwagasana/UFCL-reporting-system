import React from 'react';
import {
  StyleSheet, View, Text, FlatList, Switch,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { EmptyState }    from '../../components/EmptyState';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { UserRole } from '../../types/auth';
import { useAutomationDashboard, useUpdateAutomationRule } from '../../hooks/useAutomation';
import { AdminStackParamList } from '../../navigation/types';
import type { AutomationRule } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const SEV_BG: Record<string, string>    = { critical:'#FEE2E2', high:'#FEF3C7', medium:'#DBEAFE', low:'#DCFCE7', info:'#E0E7FF' };
const SEV_FG: Record<string, string>    = { critical:'#DC2626', high:'#D97706', medium:'#1D4ED8', low:'#16A34A', info:'#4F46E5' };
const ACTION_BG: Record<string, string> = { notify:'#DBEAFE', draft_request:'#DCFCE7', escalate:'#FEF3C7', log_only:'#F3F4F6' };
const ACTION_FG: Record<string, string> = { notify:'#1D4ED8', draft_request:'#166534', escalate:'#92400E', log_only:'#6B7280' };

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export function AutomationRulesScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role as UserRole | undefined);
  const canEdit    = !!(role && hasPermission(role, 'automation.edit_rules'));

  const { data: res, isLoading, isRefetching, refetch } = useAutomationDashboard();
  const updateRule = useUpdateAutomationRule();

  function handleToggle(rule: AutomationRule, enabled: boolean) {
    updateRule.mutate(
      { ruleKey: rule.rule_key, enabled },
      { onError: () => Alert.alert('Error', 'Failed to update rule.') },
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Automation Rules" onBack={() => navigation.goBack()} />
        <LoadingState message="Loading automation rules…" fullScreen />
      </SafeAreaView>
    );
  }

  const rules = res?.ok ? res.rules : [];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Automation Rules"
        onBack={() => navigation.goBack()}
        actions={canEdit ? [{ icon: 'add', onPress: () => navigation.navigate('AutomationRuleDetail', {}) }] : []}
      />

      {!canEdit && (
        <View style={s.readOnlyBanner}>
          <Ionicons name="eye-outline" size={14} color={Colors.warning} />
          <Text style={s.readOnlyText}>Read-only · Rule editing requires admin or CEO role</Text>
        </View>
      )}

      <FlatList
        data={rules}
        keyExtractor={r => r.rule_key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('AutomationRuleDetail', { ruleKey: item.rule_key })}
            activeOpacity={0.75}
          >
            <View style={[s.statusDot, { backgroundColor: item.enabled ? Colors.success : Colors.error }]} />
            <View style={s.rowBody}>
              <Text style={s.rowLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={s.rowMeta}>
                {item.rule_key} · cooldown {item.cooldown_hours}h · last: {fmtAgo(item.last_fired)}
              </Text>
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: SEV_BG[item.severity] || '#F3F4F6' }]}>
                  <Text style={[s.badgeText, { color: SEV_FG[item.severity] || '#374151' }]}>
                    {(item.severity || '—').toUpperCase()}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: ACTION_BG[item.auto_action] || '#F3F4F6' }]}>
                  <Text style={[s.badgeText, { color: ACTION_FG[item.auto_action] || '#6B7280' }]}>
                    {(item.auto_action || '—').replace('_', ' ')}
                  </Text>
                </View>
              </View>
            </View>
            {canEdit ? (
              <Switch
                value={item.enabled}
                onValueChange={(v) => handleToggle(item, v)}
                trackColor={{ false: '#D1D5DB', true: Colors.success + '80' }}
                thumbColor={item.enabled ? Colors.success : '#9CA3AF'}
              />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <EmptyState icon="hardware-chip-outline" title="No automation rules found" subtitle="Automation rules will appear here once configured." />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  list:   { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warningBg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  readOnlyText:   { fontSize: Typography.xs, color: Colors.warning },

  row:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  statusDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0, marginTop: 2, alignSelf: 'flex-start' },
  rowBody:   { flex: 1 },
  rowLabel:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowMeta:   { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 6 },
  badgeRow:  { flexDirection: 'row', gap: Spacing.xs },
  badge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '600' },
});
