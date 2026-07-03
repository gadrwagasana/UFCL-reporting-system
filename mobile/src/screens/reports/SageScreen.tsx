import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem   from 'expo-file-system';
import * as Sharing      from 'expo-sharing';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useWeeklyCost } from '../../hooks/useReports';
import type { ReportsStackParamList } from '../../navigation/types';
import type { WeeklyCostCategory } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

const RECONCILIATION: Record<string, string> = {
  green: 'Clear',
  amber: 'Monitor',
  red:   'Review needed',
};
const STATUS_COLOR: Record<string, string> = {
  green: Colors.success,
  amber: Colors.warning,
  red:   Colors.error,
};
const STATUS_BG: Record<string, string> = {
  green: Colors.successBg,
  amber: Colors.warningBg,
  red:   Colors.errorBg,
};

function formatMonth(yyyyMm: string): string {
  if (!yyyyMm) return yyyyMm;
  const [y, m] = yyyyMm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function CategoryRow({ item }: { item: WeeklyCostCategory }) {
  const varColor = item.variance > 5 ? Colors.error : item.variance > 0 ? Colors.warning : Colors.success;
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.catName} numberOfLines={1}>{item.name}</Text>
        <View style={[s.statusBadge, { backgroundColor: STATUS_BG[item.status] }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[item.status] }]}>
            {RECONCILIATION[item.status] || item.status}
          </Text>
        </View>
      </View>
      <View style={s.rowGrid}>
        <View style={s.col}>
          <Text style={s.colLabel}>Week</Text>
          <Text style={s.colValue}>{Number(item.week_amount).toLocaleString()}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.colLabel}>Month</Text>
          <Text style={s.colValue}>{Number(item.month_amount).toLocaleString()}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.colLabel}>Budget</Text>
          <Text style={s.colValue}>{Number(item.budget).toLocaleString()}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.colLabel}>Variance</Text>
          <Text style={[s.colValue, { color: varColor }]}>
            {item.variance >= 0 ? '+' : ''}{item.variance}%
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SageScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isRefetching, refetch } = useWeeklyCost();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!data?.ok) return;
    const { weekNumber, month, summary, totals } = data as any;

    const lines: string[] = [
      'Category,Week Amount (RWF),Month to Date (RWF),Budget (RWF),Variance %,Reconciliation Status',
    ];
    for (const cat of summary) {
      const escaped = `"${String(cat.name).replace(/"/g, '""')}"`;
      lines.push(
        `${escaped},${cat.week_amount || 0},${cat.month_amount || 0},${cat.budget || 0},${Number(cat.variance || 0).toFixed(1)},${RECONCILIATION[cat.status] || cat.status}`,
      );
    }
    lines.push(
      `Total,${totals.week || 0},${totals.month || 0},${totals.budget || 0},${Number(totals.variance || 0).toFixed(1)},`,
    );

    const csv      = lines.join('\n');
    const filename = `sage-reconciliation-${month}.csv`;
    const path     = `${FileSystem.cacheDirectory}${filename}`;

    try {
      setExporting(true);
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'Your device does not support file sharing.');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType:   'text/csv',
        dialogTitle: `Sage Reconciliation — ${formatMonth(month)}`,
        UTI:         'public.comma-separated-values-text',
      });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export CSV.');
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Sage Reconciliation" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  if (!data?.ok) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Sage Reconciliation" onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.errText}>{(data as any)?.error || 'Failed to load data'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { weekNumber, month, summary, totals } = data as any;
  const totalVarColor = Number(totals.variance) > 5 ? Colors.error : Number(totals.variance) > 0 ? Colors.warning : Colors.success;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Sage Reconciliation"
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon:    exporting ? 'hourglass-outline' : 'share-outline',
            onPress: handleExport,
          },
        ]}
      />

      <FlatList
        data={summary as WeeklyCostCategory[]}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        renderItem={({ item }) => <CategoryRow item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}

        ListHeaderComponent={
          <>
            {/* Reporting Period */}
            <View style={s.periodCard}>
              <Ionicons name="calendar-outline" size={18} color={Colors.navy} />
              <View>
                <Text style={s.periodSub}>Current Reporting Period</Text>
                <Text style={s.periodMain}>Week {weekNumber} · {formatMonth(month)}</Text>
              </View>
            </View>

            {/* Totals summary */}
            <View style={s.totalsCard}>
              <Text style={s.totalsTitle}>Expense Totals</Text>
              <View style={s.totalsRow}>
                <View style={s.totalsCol}>
                  <Text style={s.totalsLabel}>This week</Text>
                  <Text style={s.totalsValue}>RWF {Number(totals.week || 0).toLocaleString()}</Text>
                </View>
                <View style={s.totalsDivider} />
                <View style={s.totalsCol}>
                  <Text style={s.totalsLabel}>Month to date</Text>
                  <Text style={s.totalsValue}>RWF {Number(totals.month || 0).toLocaleString()}</Text>
                </View>
                <View style={s.totalsDivider} />
                <View style={s.totalsCol}>
                  <Text style={s.totalsLabel}>Monthly budget</Text>
                  <Text style={s.totalsValue}>RWF {Number(totals.budget || 0).toLocaleString()}</Text>
                </View>
                <View style={s.totalsDivider} />
                <View style={s.totalsCol}>
                  <Text style={s.totalsLabel}>Variance</Text>
                  <Text style={[s.totalsValue, { color: totalVarColor }]}>
                    {Number(totals.variance) >= 0 ? '+' : ''}{Number(totals.variance || 0).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Export button */}
            <TouchableOpacity
              style={[s.exportBtn, exporting && { opacity: 0.6 }]}
              onPress={handleExport}
              disabled={exporting}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={s.exportBtnText}>
                {exporting ? 'Exporting…' : 'Export CSV for Sage'}
              </Text>
            </TouchableOpacity>

            <Text style={s.sectionLabel}>EXPENSE SUMMARY</Text>
          </>
        }

        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="calculator-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>No expense categories found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  errText:  { fontSize: Typography.sm, color: Colors.error, textAlign: 'center' },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.md },
  retryText:{ color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },
  list:   { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  periodCard:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.navy + '0F', borderRadius: Radius.lg, padding: Spacing.base, borderLeftWidth: 3, borderLeftColor: Colors.navy },
  periodSub:    { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  periodMain:   { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.navy, marginTop: 1 },

  totalsCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  totalsTitle:   { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  totalsRow:     { flexDirection: 'row', alignItems: 'center' },
  totalsCol:     { flex: 1, alignItems: 'center' },
  totalsDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  totalsLabel:   { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  totalsValue:   { fontSize: 11, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center', marginTop: 2 },

  exportBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base },
  exportBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: Typography.semibold },

  sectionLabel:  { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, letterSpacing: 1, marginTop: Spacing.xs },

  row:       { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  rowTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  catName:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.xs },
  statusBadge:{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700' },
  rowGrid:   { flexDirection: 'row', gap: 4 },
  col:       { flex: 1, alignItems: 'center' },
  colLabel:  { fontSize: 9, color: Colors.textMuted },
  colValue:  { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary, marginTop: 1 },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
