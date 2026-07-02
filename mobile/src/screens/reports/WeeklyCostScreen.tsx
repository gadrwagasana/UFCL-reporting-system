import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { AppHeader }     from '../../components/AppHeader';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { useWeeklyCost, useSaveWeeklyExpense } from '../../hooks/useReports';
import { WeeklyCostCategory } from '../../types/api';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const RAG: Record<string, string> = {
  green: Colors.success,
  amber: Colors.warning,
  red:   Colors.error,
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      {sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  );
}

export function WeeklyCostScreen() {
  const { data, isLoading, isError, refetch } = useWeeklyCost();
  const saveMutation = useSaveWeeklyExpense();
  const role = useAuthStore(s => s.user?.role ?? '');
  const canEdit = hasPermission(role as any, 'reports.edit_expenses');

  const [editRow,   setEditRow]   = useState<WeeklyCostCategory | null>(null);
  const [amount,    setAmount]    = useState('');
  const [reason,    setReason]    = useState('');

  if (isLoading) return <LoadingState message="Loading weekly cost…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load weekly cost report" onRetry={refetch} fullScreen />;

  const { weekNumber, month, summary, totals } = data;
  const budgetPct = totals.budget > 0 ? Math.min(100, (totals.month / totals.budget) * 100) : 0;
  const varPct    = Number(totals.variance);

  function openEdit(row: WeeklyCostCategory) {
    setEditRow(row);
    setAmount(row.week_amount > 0 ? String(row.week_amount) : '');
    setReason('');
  }

  async function submitEdit() {
    if (!editRow || !data) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    try {
      await saveMutation.mutateAsync({
        categoryId: editRow.id,
        amount:     amt,
        weekNumber: weekNumber,
        month:      month,
        reason:     reason || undefined,
      });
      setEditRow(null);
    } catch {
      Alert.alert('Error', 'Could not save expense.');
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Weekly Cost" dark />

      <FlatList
        data={summary}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={s.list}
        refreshing={false}
        onRefresh={refetch}
        ListHeaderComponent={
          <>
            <Text style={s.period}>Week {weekNumber} · {month}</Text>
            {/* KPI banner */}
            <View style={s.banner}>
              <KpiCard label="This week"    value={`RWF ${totals.week.toLocaleString()}`} />
              <View style={s.div} />
              <KpiCard label="Month to date" value={`RWF ${totals.month.toLocaleString()}`} />
              <View style={s.div} />
              <KpiCard label="Monthly budget" value={`RWF ${totals.budget.toLocaleString()}`} />
              <View style={s.div} />
              <KpiCard
                label="Variance"
                value={`${varPct >= 0 ? '+' : ''}${varPct}%`}
                sub={varPct > 5 ? 'Over budget' : varPct < 0 ? 'Under budget' : 'On track'}
              />
            </View>
            {/* Utilisation bar */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Budget utilisation</Text>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${budgetPct}%` as any, backgroundColor: budgetPct > 100 ? Colors.error : budgetPct > 90 ? Colors.warning : Colors.success }]} />
              </View>
              <Text style={s.barLabel}>{budgetPct.toFixed(1)}% of monthly budget used</Text>
            </View>
            <Text style={s.sectionHeader}>Expense categories</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => canEdit && openEdit(item)}
            activeOpacity={canEdit ? 0.75 : 1}
          >
            <View style={s.rowTop}>
              <Text style={s.catName}>{item.name}</Text>
              <View style={[s.ragDot, { backgroundColor: RAG[item.status] }]} />
            </View>
            <View style={s.rowGrid}>
              <View style={s.col}>
                <Text style={s.colLabel}>This week</Text>
                <Text style={s.colValue}>{item.week_amount.toLocaleString()}</Text>
              </View>
              <View style={s.col}>
                <Text style={s.colLabel}>MTD</Text>
                <Text style={s.colValue}>{item.month_amount.toLocaleString()}</Text>
              </View>
              <View style={s.col}>
                <Text style={s.colLabel}>Budget</Text>
                <Text style={s.colValue}>{item.budget.toLocaleString()}</Text>
              </View>
              <View style={s.col}>
                <Text style={s.colLabel}>Var%</Text>
                <Text style={[s.colValue, { color: item.variance > 5 ? Colors.error : item.variance < 0 ? Colors.success : Colors.textPrimary }]}>
                  {item.variance >= 0 ? '+' : ''}{item.variance}%
                </Text>
              </View>
            </View>
            {canEdit && (
              <Text style={s.tapHint}>Tap to update this week's amount</Text>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Edit modal */}
      <Modal visible={!!editRow} animationType="slide" transparent onRequestClose={() => setEditRow(null)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editRow?.name}</Text>
              <TouchableOpacity onPress={() => setEditRow(null)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={s.fieldLabel}>Amount (RWF) *</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={s.fieldLabel}>Reason (optional)</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder="Enter reason for this expense…"
                placeholderTextColor={Colors.textMuted}
              />
            </ScrollView>
            <TouchableOpacity
              style={[s.saveBtn, saveMutation.isPending && { opacity: 0.6 }]}
              onPress={submitEdit}
              disabled={saveMutation.isPending}
            >
              <Text style={s.saveBtnText}>{saveMutation.isPending ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },
  list:          { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  period:        { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: 4 },

  banner:        { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, ...Shadow.sm },
  kpi:           { flex: 1, alignItems: 'center', gap: 2 },
  kpiLabel:      { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  kpiValue:      { fontSize: 11, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  kpiSub:        { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  div:           { width: 1, backgroundColor: Colors.border },

  card:          { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted },
  barBg:         { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginVertical: 6 },
  barFill:       { height: '100%', borderRadius: 4 },
  barLabel:      { fontSize: Typography.xs, color: Colors.textMuted },

  sectionHeader: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.xs },

  rowTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName:       { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  ragDot:        { width: 10, height: 10, borderRadius: 5 },
  rowGrid:       { flexDirection: 'row', gap: 4, marginTop: 4 },
  col:           { flex: 1, alignItems: 'center' },
  colLabel:      { fontSize: 9, color: Colors.textMuted },
  colValue:      { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary, marginTop: 1 },
  tapHint:       { fontSize: 9, color: Colors.textMuted, textAlign: 'right', marginTop: 2 },

  modalOverlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:    { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '70%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:    { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  fieldLabel:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginTop: Spacing.xs },
  input:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.bg },
  saveBtn:       { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText:   { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
