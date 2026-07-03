import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useEpmDashboard } from '../../hooks/useEpm';
import type { ReportsStackParamList } from '../../navigation/types';
import type { ActionPlan, ActionPlanStatus, ActionPlanPriority } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

const PRIORITY_COLOR: Record<ActionPlanPriority, string> = {
  critical: Colors.error,
  high:     Colors.warning,
  medium:   Colors.info,
  low:      Colors.textMuted,
};
const PRIORITY_BG: Record<ActionPlanPriority, string> = {
  critical: Colors.errorBg,
  high:     Colors.warningBg,
  medium:   Colors.infoBg,
  low:      Colors.bg,
};

const STATUS_LABEL: Record<ActionPlanStatus, string> = {
  draft:            'Draft',
  pending_approval: 'Pending',
  approved:         'Approved',
  in_progress:      'In Progress',
  completed:        'Completed',
  rejected:         'Rejected',
};
const STATUS_COLOR: Record<ActionPlanStatus, string> = {
  draft:            Colors.textMuted,
  pending_approval: Colors.warning,
  approved:         Colors.info,
  in_progress:      Colors.navy,
  completed:        Colors.success,
  rejected:         Colors.error,
};
const STATUS_BG: Record<ActionPlanStatus, string> = {
  draft:            Colors.bg,
  pending_approval: Colors.warningBg,
  approved:         Colors.infoBg,
  in_progress:      Colors.navy + '1A',
  completed:        Colors.successBg,
  rejected:         Colors.errorBg,
};

type StatusFilter = 'all' | ActionPlanStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',            label: 'All' },
  { key: 'in_progress',   label: 'In Progress' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved',      label: 'Approved' },
  { key: 'draft',         label: 'Draft' },
  { key: 'completed',     label: 'Completed' },
  { key: 'rejected',      label: 'Rejected' },
];

function PlanCard({ item }: { item: ActionPlan }) {
  const [expanded, setExpanded] = useState(false);
  const pr = item.priority as ActionPlanPriority;
  const st = item.status  as ActionPlanStatus;
  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}
    >
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <Text style={s.problem} numberOfLines={expanded ? undefined : 2}>{item.problem}</Text>
          <Text style={s.dept}>{item.responsible_dept}</Text>
        </View>
        <View style={s.cardRight}>
          <View style={[s.priBadge, { backgroundColor: PRIORITY_BG[pr] }]}>
            <Text style={[s.priBadgeText, { color: PRIORITY_COLOR[pr] }]}>{item.priority}</Text>
          </View>
          {item.auto_generated && (
            <View style={s.autoChip}>
              <Ionicons name="flash" size={9} color={Colors.navy} />
              <Text style={s.autoText}>Auto</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.cardFoot}>
        <View style={[s.statusBadge, { backgroundColor: STATUS_BG[st] }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[st] }]}>{STATUS_LABEL[st]}</Text>
        </View>
        {item.due_date && (
          <Text style={s.dueDate}>
            Due {new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}
        {item.kpi_name && (
          <Text style={s.kpiRef} numberOfLines={1}>KPI: {item.kpi_name}</Text>
        )}
      </View>

      {expanded && (
        <View style={s.detail}>
          {item.root_cause && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Root Cause</Text>
              <Text style={s.detailValue}>{item.root_cause}</Text>
            </View>
          )}
          {item.recommended_action && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Recommended Action</Text>
              <Text style={s.detailValue}>{item.recommended_action}</Text>
            </View>
          )}
          {item.expected_improvement && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Expected Improvement</Text>
              <Text style={s.detailValue}>{item.expected_improvement}</Text>
            </View>
          )}
          {item.created_by_name && (
            <Text style={s.meta}>Created by {item.created_by_name}</Text>
          )}
          {item.approved_by_name && (
            <Text style={s.meta}>Approved by {item.approved_by_name}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function EpmActionPlansScreen() {
  const navigation = useNavigation<Nav>();
  const { data: res, isLoading, isRefetching, refetch } = useEpmDashboard();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const plans     = res?.ok ? res.plans?.plans || [] : [];
  const planSummary = res?.ok ? res.plans?.summary : null;

  const filtered = useMemo(() =>
    statusFilter === 'all' ? plans : plans.filter(p => p.status === statusFilter),
    [plans, statusFilter],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Action Plans" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Action Plans"
        subtitle={planSummary ? `${planSummary.total} total` : undefined}
        onBack={() => navigation.goBack()}
      />

      {/* Summary Row */}
      {planSummary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.summaryRow}>
          {[
            { label: 'In Progress', val: planSummary.in_progress,   color: Colors.navy },
            { label: 'Pending',     val: planSummary.pending_approval, color: Colors.warning },
            { label: 'Approved',    val: planSummary.approved,       color: Colors.info },
            { label: 'Draft',       val: planSummary.draft,          color: Colors.textMuted },
            { label: 'Completed',   val: planSummary.completed,      color: Colors.success },
          ].map(i => (
            <View key={i.label} style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: i.color }]}>{i.val}</Text>
              <Text style={s.summaryLbl}>{i.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Status Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, statusFilter === f.key && s.chipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[s.chipText, statusFilter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        renderItem={({ item }) => <PlanCard item={item} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="list-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>No action plans.</Text>
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

  summaryRow:  { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.lg },
  summaryItem: { alignItems: 'center' },
  summaryNum:  { fontSize: Typography.xl, fontWeight: Typography.bold },
  summaryLbl:  { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  chipScroll:  { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.xs },
  chip:        { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive:  { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:    { fontSize: 12, fontWeight: Typography.semibold, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTop:   { flexDirection: 'row', gap: Spacing.sm },
  cardLeft:  { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  problem:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, lineHeight: 18 },
  dept:      { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  priBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  priBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  autoChip:  { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, backgroundColor: Colors.navy + '1A' },
  autoText:  { fontSize: 9, color: Colors.navy, fontWeight: '700' },
  cardFoot:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs, flexWrap: 'wrap' },
  statusBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  dueDate:   { fontSize: 10, color: Colors.textMuted },
  kpiRef:    { fontSize: 10, color: Colors.textSecondary, flex: 1 },

  detail:     { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.sm, paddingTop: Spacing.sm, gap: Spacing.xs },
  detailRow:  { gap: 2 },
  detailLabel:{ fontSize: 10, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue:{ fontSize: Typography.sm, color: Colors.textPrimary },
  meta:       { fontSize: 10, color: Colors.textMuted },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
