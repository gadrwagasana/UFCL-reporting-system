import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { useAudit, AuditFilters } from '../../hooks/useAdmin';
import type { AuditRow } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const ACTION_TYPES = ['All', 'create', 'update', 'delete', 'approve', 'reject',
  'login', 'login_failed', 'privileged_override'];

function AuditCard({ item }: { item: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasBefore = item.before_values && Object.keys(item.before_values as object).length > 0;
  const hasAfter  = item.after_values  && Object.keys(item.after_values as object).length > 0;
  const hasExtra  = hasBefore || hasAfter || !!item.reason;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => hasExtra && setExpanded((v) => !v)}
      activeOpacity={hasExtra ? 0.75 : 1}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardAction} numberOfLines={1}>{item.action}</Text>
          <Text style={styles.cardSub}>
            {item.username || '—'} · {item.role} · {item.module}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardTime}>{item.time}</Text>
          {hasExtra && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14} color={Colors.textMuted}
            />
          )}
        </View>
      </View>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: Colors.navy + '20' }]}>
          <Text style={[styles.badgeText, { color: Colors.navy }]}>{item.action_type}</Text>
        </View>
        {item.ip_address ? (
          <Text style={styles.ip}>{item.ip_address}</Text>
        ) : null}
      </View>
      {expanded && (
        <View style={styles.expandSection}>
          {item.reason ? (
            <Text style={styles.expandReason}>Reason: {item.reason}</Text>
          ) : null}
          {hasBefore ? (
            <Text style={styles.expandPre}>
              Before: {JSON.stringify(item.before_values, null, 2)}
            </Text>
          ) : null}
          {hasAfter ? (
            <Text style={styles.expandPre}>
              After: {JSON.stringify(item.after_values, null, 2)}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function AuditScreen() {
  const navigation = useNavigation();
  const [pending, setPending] = useState<AuditFilters>({});
  const [applied, setApplied] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useAudit(applied);

  function apply() {
    setApplied({ ...pending });
    setShowFilters(false);
  }
  function clear() {
    setPending({});
    setApplied({});
    setShowFilters(false);
  }

  const hasFilter = Object.values(applied).some(Boolean);

  if (isLoading) return <LoadingState message="Loading audit log…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Audit Trail" searchModule="audit_logs" onBack={() => navigation.goBack()} />

      {/* Filter toggle */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterBtn, hasFilter && styles.filterBtnActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Ionicons name="filter" size={16} color={hasFilter ? Colors.white : Colors.navy} />
          <Text style={[styles.filterBtnText, hasFilter && styles.filterBtnTextActive]}>
            {hasFilter ? 'Filtered' : 'Filter'}
          </Text>
        </TouchableOpacity>
        {hasFilter && (
          <TouchableOpacity onPress={clear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
        {data ? (
          <Text style={styles.countText}>{data.rows.length} records</Text>
        ) : null}
      </View>

      {showFilters && (
        <ScrollView style={styles.filterPanel} keyboardShouldPersistTaps="handled">
          <Text style={styles.filterLabel}>Module</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {['All', ...(data?.modules ?? [])].map((m) => {
              const sel = (pending.module ?? '') === (m === 'All' ? '' : m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, sel && styles.chipActive]}
                  onPress={() => setPending((p) => ({ ...p, module: m === 'All' ? undefined : m }))}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Action Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {ACTION_TYPES.map((t) => {
              const sel = (pending.actionType ?? '') === (t === 'All' ? '' : t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, sel && styles.chipActive]}
                  onPress={() => setPending((p) => ({ ...p, actionType: t === 'All' ? undefined : t }))}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Search</Text>
          <TextInput
            style={styles.input}
            value={pending.search ?? ''}
            onChangeText={(v) => setPending((p) => ({ ...p, search: v || undefined }))}
            placeholder="Search action, user…"
            placeholderTextColor={Colors.textMuted}
          />

          <View style={styles.filterRow}>
            <View style={styles.filterHalf}>
              <Text style={styles.filterLabel}>From date</Text>
              <TextInput
                style={styles.input}
                value={pending.fromDate ?? ''}
                onChangeText={(v) => setPending((p) => ({ ...p, fromDate: v || undefined }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.filterHalf}>
              <Text style={styles.filterLabel}>To date</Text>
              <TextInput
                style={styles.input}
                value={pending.toDate ?? ''}
                onChangeText={(v) => setPending((p) => ({ ...p, toDate: v || undefined }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.navy }]} onPress={apply}>
              <Text style={styles.actionBtnText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.border }]} onPress={clear}>
              <Text style={[styles.actionBtnText, { color: Colors.textPrimary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {isError ? (
        <ErrorState message="Could not load audit log" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={data?.rows ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={(data?.rows ?? []).length === 0 ? styles.empty : styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
          }
          ListEmptyComponent={
            <EmptyState icon="document-text-outline" title="No audit records" subtitle="Try adjusting your filters." />
          }
          renderItem={({ item }) => <AuditCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  empty: { flex: 1, justifyContent: 'center' },

  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.navy,
  },
  filterBtnActive:     { backgroundColor: Colors.navy },
  filterBtnText:       { fontSize: Typography.sm, color: Colors.navy },
  filterBtnTextActive: { color: Colors.white },
  clearBtn:   { paddingHorizontal: Spacing.sm },
  clearBtnText: { fontSize: Typography.sm, color: Colors.error },
  countText: { fontSize: Typography.xs, color: Colors.textMuted, marginLeft: 'auto' },

  filterPanel: { maxHeight: 360, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border, padding: Spacing.base },
  filterLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: 6, marginTop: Spacing.sm },
  chips:  { gap: Spacing.sm, paddingVertical: 4 },
  chip:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:   { fontSize: Typography.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  filterRow:   { flexDirection: 'row', gap: Spacing.sm },
  filterHalf:  { flex: 1 },
  filterActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.sm },
  actionBtn:   { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  actionBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  cardMeta:   { flex: 1 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  cardAction: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardSub:    { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  cardTime:   { fontSize: Typography.xs, color: Colors.textMuted },
  badgeRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge:      { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  badgeText:  { fontSize: Typography.xs, fontWeight: Typography.medium },
  ip:         { fontSize: Typography.xs, color: Colors.textMuted },
  expandSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: Spacing.xs },
  expandReason:  { fontSize: Typography.sm, color: Colors.warning, fontStyle: 'italic' },
  expandPre:     { fontSize: Typography.xs, color: Colors.textSecondary, fontFamily: 'monospace' },
});
