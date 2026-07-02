import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView }           from 'react-native-safe-area-context';
import { StatusBar }              from 'expo-status-bar';
import { Ionicons }               from '@expo/vector-icons';
import { AppHeader }              from '../../components/AppHeader';
import { LoadingState }           from '../../components/LoadingState';
import { ErrorState }             from '../../components/ErrorState';
import { useKpiBudgets, useSaveKpiBudgets } from '../../hooks/useReports';
import { KpiBudgetRow }           from '../../types/api';
import { useAuthStore }           from '../../stores/authStore';
import { hasPermission }          from '../../utils/permissions';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

export function KpiScreen() {
  const { data, isLoading, isError, refetch } = useKpiBudgets();
  const saveMutation = useSaveKpiBudgets();
  const role  = useAuthStore(s => s.user?.role ?? '');
  const canEdit = hasPermission(role as any, 'reports.edit_kpi');

  const [editRow, setEditRow]   = useState<KpiBudgetRow | null>(null);
  const [amount,  setAmount]    = useState('');

  if (isLoading) return <LoadingState message="Loading KPI budgets…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load KPI scorecard" onRetry={refetch} fullScreen />;

  const { month, rows } = data;
  const total = rows.reduce((s, r) => s + r.budget_amount, 0);

  function openEdit(row: KpiBudgetRow) {
    setEditRow(row);
    setAmount(row.budget_amount > 0 ? String(row.budget_amount) : '');
  }

  async function submitEdit() {
    if (!editRow || !data) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    const updated = rows.map(r => ({ id: r.id, budget_amount: r.id === editRow.id ? amt : r.budget_amount }));
    try {
      await saveMutation.mutateAsync({ month, items: updated });
      setEditRow(null);
    } catch {
      Alert.alert('Error', 'Could not save budget.');
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="KPI Scorecard" dark />

      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={false}
        ListHeaderComponent={
          <>
            <Text style={s.period}>{month}</Text>
            <View style={s.banner}>
              <View style={s.kpi}>
                <Text style={s.kpiValue}>{rows.length}</Text>
                <Text style={s.kpiLabel}>Categories</Text>
              </View>
              <View style={s.div} />
              <View style={s.kpi}>
                <Text style={s.kpiValue}>RWF {total.toLocaleString()}</Text>
                <Text style={s.kpiLabel}>Total monthly budget</Text>
              </View>
            </View>
            <Text style={s.sectionHeader}>Budget targets</Text>
          </>
        }
        renderItem={({ item }) => {
          const share = total > 0 ? (item.budget_amount / total) * 100 : 0;
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => canEdit && openEdit(item)}
              activeOpacity={canEdit ? 0.75 : 1}
            >
              <View style={s.rowTop}>
                <Text style={s.catName}>{item.name}</Text>
                <Text style={s.catBudget}>RWF {item.budget_amount.toLocaleString()}</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${share}%` as any }]} />
              </View>
              <Text style={s.shareText}>{share.toFixed(1)}% of total budget</Text>
              {canEdit && <Text style={s.tapHint}>Tap to update budget</Text>}
            </TouchableOpacity>
          );
        }}
      />

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
              <Text style={s.fieldLabel}>Monthly budget (RWF) *</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
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
  period:        { fontSize: Typography.xs, color: Colors.textMuted },

  banner:        { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', ...Shadow.sm },
  kpi:           { flex: 1, alignItems: 'center', gap: 2 },
  kpiValue:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  kpiLabel:      { fontSize: Typography.xs, color: Colors.textMuted },
  div:           { width: 1, height: 32, backgroundColor: Colors.border },

  sectionHeader: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.xs },
  card:          { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  rowTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName:       { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  catBudget:     { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.navy },
  barBg:         { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:       { height: '100%', backgroundColor: Colors.navy, borderRadius: 3 },
  shareText:     { fontSize: Typography.xs, color: Colors.textMuted },
  tapHint:       { fontSize: 9, color: Colors.textMuted, textAlign: 'right' },

  modalOverlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:    { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '60%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:    { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  fieldLabel:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginTop: Spacing.xs },
  input:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.bg },
  saveBtn:       { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText:   { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
