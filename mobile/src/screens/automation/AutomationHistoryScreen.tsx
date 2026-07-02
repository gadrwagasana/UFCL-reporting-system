import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAutomationDashboard } from '../../hooks/useAutomation';
import { AdminStackParamList } from '../../navigation/types';
import type { AutomationLogEntry } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function LogRow({ entry }: { entry: AutomationLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={s.row} onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
      <View style={s.rowMain}>
        <Text style={s.ruleKey} numberOfLines={1}>{entry.rule_key}</Text>
        <Text style={s.action} numberOfLines={expanded ? undefined : 1}>{entry.action_taken}</Text>
        <Text style={s.time}>{fmtAgo(entry.fired_at)}</Text>
      </View>
      {expanded && (entry.related_module || entry.related_id) && (
        <View style={s.detail}>
          {entry.related_module ? <Text style={s.detailText}>Module: {entry.related_module}</Text> : null}
          {entry.related_id     ? <Text style={s.detailText}>Record: {entry.related_id}</Text>     : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function AutomationHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [filterKey, setFilterKey] = useState<string>('');

  const { data: res, isLoading, isRefetching, refetch } = useAutomationDashboard();

  const log       = res?.ok ? res.automation_log : [];
  const ruleKeys  = useMemo(() => [...new Set(log.map(l => l.rule_key))].sort(), [log]);
  const filtered  = filterKey ? log.filter(l => l.rule_key === filterKey) : log;

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Automation History" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Automation History" onBack={() => navigation.goBack()} />

      {/* Filter chips */}
      {ruleKeys.length > 0 && (
        <View style={s.filterBar}>
          <FlatList
            horizontal
            data={['', ...ruleKeys]}
            keyExtractor={k => k || '__all__'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.xs, paddingHorizontal: Spacing.base }}
            renderItem={({ item: key }) => {
              const active = filterKey === key;
              return (
                <TouchableOpacity
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setFilterKey(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {key || 'All rules'}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={e => String(e.id)}
        renderItem={({ item }) => <LogRow entry={item} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <Text style={s.countLabel}>{filtered.length} entries{filterKey ? ` · ${filterKey}` : ''}</Text>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="time-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>No history entries.</Text>
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

  filterBar: { paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chip:      { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:  { fontSize: Typography.xs, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: Typography.semibold },

  list:       { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  countLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.xs },

  row:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  rowMain: { gap: 2 },
  ruleKey: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  action:  { fontSize: 11, color: Colors.textSecondary },
  time:    { fontSize: 10, color: Colors.textMuted },

  detail:      { marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.xs },
  detailText:  { fontSize: 11, color: Colors.textMuted },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
