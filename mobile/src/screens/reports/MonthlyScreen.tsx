import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView }          from 'react-native-safe-area-context';
import { StatusBar }             from 'expo-status-bar';
import { Ionicons }              from '@expo/vector-icons';
import { AppHeader }             from '../../components/AppHeader';
import { LoadingState }          from '../../components/LoadingState';
import { ErrorState }            from '../../components/ErrorState';
import { useMonthlyDashboard, useMonthlyApprove } from '../../hooks/useReports';
import { MonthlyExpenseRow }     from '../../types/api';
import { useAuthStore }          from '../../stores/authStore';
import { hasPermission }         from '../../utils/permissions';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function KpiTile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={[s.tileValue, warn && { color: Colors.warning }]}>{value}</Text>
      {sub && <Text style={s.tileSub}>{sub}</Text>}
    </View>
  );
}

function ExpenseRow({ row, total }: { row: MonthlyExpenseRow; total: number }) {
  const share = total > 0 ? (row.total / total) * 100 : 0;
  return (
    <View style={s.expRow}>
      <View style={s.expInfo}>
        <Text style={s.expCat} numberOfLines={1}>{row.category}</Text>
        <Text style={s.expAmt}>RWF {row.total.toLocaleString()}</Text>
      </View>
      <View style={s.expBarBg}>
        <View style={[s.expBarFill, { width: `${share}%` as any }]} />
      </View>
      <Text style={s.expShare}>{share.toFixed(1)}%</Text>
    </View>
  );
}

export function MonthlyScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useMonthlyDashboard();
  const approveMutation = useMonthlyApprove();
  const role = useAuthStore(s => s.user?.role ?? '');
  const isCeo = role === 'ceo';

  if (isLoading) return <LoadingState message="Loading monthly dashboard…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load monthly dashboard" onRetry={refetch} fullScreen />;

  const { month, production, sales, expenses, totalExpenses, approval } = data;

  const timberWastePct = production.timber_units > 0
    ? ((production.timber_waste / production.timber_units) * 100).toFixed(1) : '0.0';
  const polesWastePct  = production.poles_units > 0
    ? ((production.poles_waste / production.poles_units) * 100).toFixed(1) : '0.0';

  async function handleApprove() {
    Alert.alert('Approve monthly report', `Sign off on the report for ${month}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'default',
        onPress: async () => {
          try {
            await approveMutation.mutateAsync(month);
          } catch {
            Alert.alert('Error', 'Could not approve report.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Monthly Dashboard" dark />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        <Text style={s.period}>{month}</Text>

        {/* Approval banner */}
        {isCeo ? (
          approval.approved ? (
            <View style={[s.approvalBanner, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '44' }]}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={[s.approvalText, { color: Colors.success }]}>Report approved by CEO</Text>
            </View>
          ) : (
            <View style={[s.approvalBanner, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '44' }]}>
              <Ionicons name="time-outline" size={18} color={Colors.warning} />
              <Text style={[s.approvalText, { color: Colors.warning, flex: 1 }]}>Monthly report for {month} — pending your approval</Text>
              <TouchableOpacity
                style={s.approveBtn}
                onPress={handleApprove}
                disabled={approveMutation.isPending}
              >
                <Text style={s.approveBtnText}>{approveMutation.isPending ? '…' : 'Approve'}</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={[s.approvalBanner, { backgroundColor: Colors.bg, borderColor: Colors.border }]}>
            <Text style={s.approvalMuted}>
              {approval.approved ? '✓ Approved by CEO' : 'Pending CEO approval'}
            </Text>
          </View>
        )}

        {/* Production KPIs */}
        <Text style={s.sectionHeader}>Production</Text>
        <View style={s.tileGrid}>
          <KpiTile label="Timber produced"    value={production.timber_units.toLocaleString()} sub="units" />
          <KpiTile label="Poles produced"     value={production.poles_units.toLocaleString()}  sub="units" />
          <KpiTile label="Timber waste rate"  value={`${timberWastePct}%`} warn={Number(timberWastePct) > 10} />
          <KpiTile label="Poles waste rate"   value={`${polesWastePct}%`}  warn={Number(polesWastePct) > 10}  />
          <KpiTile label="Downtime"           value={`${Number(production.downtime_hours).toFixed(1)}h`} sub="total" />
          <KpiTile label="Log days"           value={String(production.log_days)} sub="days" />
        </View>

        {/* Sales KPIs */}
        <Text style={s.sectionHeader}>Sales & financials</Text>
        <View style={s.tileGrid}>
          <KpiTile label="Sales orders"  value={String(sales.order_count)} sub="orders" />
          <KpiTile label="Units sold"    value={Number(sales.total_qty).toLocaleString()} sub="units" />
          <KpiTile label="Revenue"       value={`RWF ${Number(sales.total_revenue).toLocaleString()}`} sub="month" />
          <KpiTile label="Total expenses" value={`RWF ${totalExpenses.toLocaleString()}`} sub="month" />
        </View>

        {/* Expenses table */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Monthly expenses by category</Text>
          {expenses.length > 0 ? (
            <>
              {expenses.map((e, i) => <ExpenseRow key={i} row={e} total={totalExpenses} />)}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>RWF {totalExpenses.toLocaleString()}</Text>
                <Text style={s.totalShare}>100%</Text>
              </View>
            </>
          ) : (
            <Text style={s.emptyText}>No expense data for {month}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  scroll:         { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  period:         { fontSize: Typography.xs, color: Colors.textMuted },

  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1 },
  approvalText:   { fontSize: Typography.sm, fontWeight: Typography.medium },
  approvalMuted:  { fontSize: Typography.sm, color: Colors.textMuted },
  approveBtn:     { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  approveBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.xs },

  sectionHeader:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.xs },
  tileGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile:           { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center', gap: 2, ...Shadow.sm },
  tileLabel:      { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  tileValue:      { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  tileSub:        { fontSize: 9, color: Colors.textMuted },

  card:           { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted },
  emptyText:      { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.base },

  expRow:         { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + '55', gap: 4 },
  expInfo:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expCat:         { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  expAmt:         { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  expBarBg:       { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  expBarFill:     { height: '100%', backgroundColor: Colors.navy, borderRadius: 3 },
  expShare:       { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },

  totalRow:       { flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 2, borderTopColor: Colors.border },
  totalLabel:     { flex: 1, fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  totalValue:     { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  totalShare:     { width: 40, textAlign: 'right', fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
});
