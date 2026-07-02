import React from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { UserRole } from '../../types/auth';
import { useAutomationDashboard, useResolveEscalation, useAckEscalation } from '../../hooks/useAutomation';
import { AdminStackParamList } from '../../navigation/types';
import type { EscalationRow, EscalationLevel } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const LVL_BG: Record<EscalationLevel, string>  = { leader:'#E0F2FE', manager:'#FEF3C7', director:'#FED7AA', ceo:'#FEE2E2' };
const LVL_FG: Record<EscalationLevel, string>  = { leader:'#0369A1', manager:'#B45309', director:'#9A3412', ceo:'#991B1B' };

const ENTITY_ICON: Record<string, 'construct' | 'car' | 'hardware-chip' | 'shield' | 'create' | 'trash'> = {
  maintenance:  'construct',
  delivery:     'car',
  workflow:     'hardware-chip',
  security:     'shield',
  approval_edit:'create',
  approval_del: 'trash',
};

function fmtAge(hours: number): string {
  if (hours < 1)  return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function AutomationEscalationsScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role as UserRole | undefined);
  const canResolve = !!(role && hasPermission(role, 'automation.escalation_resolve'));
  const canAck     = !!(role && hasPermission(role, 'automation.escalation_ack'));

  const { data: res, isLoading, isRefetching, refetch } = useAutomationDashboard();
  const resolveMut = useResolveEscalation();
  const ackMut     = useAckEscalation();

  function handleResolve(esc: EscalationRow) {
    Alert.prompt(
      'Resolve Escalation',
      `Resolve "${esc.entity_ref || esc.entity_type}"? Enter reason:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: (reason) => {
            if (!reason?.trim()) return;
            resolveMut.mutate(
              { id: esc.id, reason: reason.trim() },
              {
                onSuccess: (r: any) => {
                  if (!r?.ok) Alert.alert('Error', r?.error || 'Resolve failed.');
                },
                onError: () => Alert.alert('Error', 'Network error.'),
              },
            );
          },
        },
      ],
      'plain-text',
    );
  }

  function handleAck(esc: EscalationRow) {
    ackMut.mutate(esc.id, {
      onSuccess: (r: any) => {
        if (!r?.ok) Alert.alert('Error', r?.error || 'Acknowledge failed.');
      },
      onError: () => Alert.alert('Error', 'Network error.'),
    });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Active Escalations" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  const active = res?.ok ? res.escalations?.active || [] : [];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Active Escalations" onBack={() => navigation.goBack()} />

      <FlatList
        data={active}
        keyExtractor={e => String(e.id)}
        renderItem={({ item: e }) => {
          const icon = ENTITY_ICON[e.entity_type] || 'alert-circle';
          const lvl  = e.current_level as EscalationLevel;
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name={icon} size={20} color={LVL_FG[lvl] || Colors.textMuted} />
                <View style={s.cardBody}>
                  <Text style={s.entityRef} numberOfLines={1}>
                    {e.entity_ref || e.entity_id}
                  </Text>
                  <Text style={s.entityMeta}>
                    {(e.entity_type || '').replace('_', ' ')} · rule: {e.triggered_by}
                  </Text>
                </View>
                <View style={[s.lvlBadge, { backgroundColor: LVL_BG[lvl] || '#F3F4F6' }]}>
                  <Text style={[s.lvlText, { color: LVL_FG[lvl] || '#374151' }]}>
                    {lvl?.toUpperCase()}
                  </Text>
                </View>
                <Text style={s.age}>{fmtAge(Number(e.age_hours) || 0)}</Text>
              </View>
              <View style={s.cardActions}>
                {canAck && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.ackBtn]}
                    onPress={() => handleAck(e)}
                    disabled={ackMut.isPending}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye" size={14} color={Colors.navy} />
                    <Text style={[s.actionBtnText, { color: Colors.navy }]}>Ack</Text>
                  </TouchableOpacity>
                )}
                {canResolve && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.resolveBtn]}
                    onPress={() => handleResolve(e)}
                    disabled={resolveMut.isPending}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={[s.actionBtnText, { color: '#fff' }]}>Resolve</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={36} color={Colors.success} />
            <Text style={s.emptyText}>No active escalations.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  card:       { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardBody:   { flex: 1 },
  entityRef:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  entityMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  lvlBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  lvlText:  { fontSize: 10, fontWeight: '700' },
  age:      { fontSize: 12, color: Colors.textMuted, minWidth: 28, textAlign: 'right' },

  cardActions: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, justifyContent: 'flex-end' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.md },
  ackBtn:      { borderWidth: 1, borderColor: Colors.navy },
  resolveBtn:  { backgroundColor: Colors.success },
  actionBtnText:{ fontSize: 12, fontWeight: Typography.semibold },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.base, color: Colors.textMuted },
});
