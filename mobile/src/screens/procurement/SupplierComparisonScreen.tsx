import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ErrorState } from '../../components/ErrorState';
import { useProcurementSuppliers } from '../../hooks/useProcurementSuppliers';
import { fetchSupplierComparison } from '../../hooks/useProcurementIntelligence';
import { ProcurementStackParamList } from '../../navigation/types';
import type { SupplierIntelligence } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'SupplierComparison'>;
type RouteType = RouteProp<ProcurementStackParamList, 'SupplierComparison'>;

const TIER_COLOR: Record<string, string> = { Excellent: Colors.success, Good: Colors.navy, Average: Colors.warning, 'High Risk': Colors.error };

interface MetricRow { label: string; get: (s: SupplierIntelligence) => number | string | null; fmt?: (v: any) => string; higherBetter?: boolean }

const METRICS: MetricRow[] = [
  { label: 'Overall Score', get: (s) => s.overallScore, higherBetter: true },
  { label: 'Rating', get: (s) => s.tier },
  { label: 'Total Spend', get: (s) => s.totalSpend, fmt: (v) => Number(v).toLocaleString() },
  { label: 'Purchase Orders', get: (s) => s.totalPos },
  { label: 'Goods Receipts', get: (s) => s.totalReceipts },
  { label: 'Delivery Score', get: (s) => s.scores.delivery, higherBetter: true },
  { label: 'Quality Score', get: (s) => s.scores.quality, higherBetter: true },
  { label: 'Cost Score', get: (s) => s.scores.cost, higherBetter: true },
  { label: 'Compliance Score', get: (s) => s.scores.compliance, higherBetter: true },
  { label: 'Responsiveness Score', get: (s) => s.scores.responsiveness, higherBetter: true },
  { label: 'Risk', get: (s) => (s.tier === 'High Risk' ? 'High' : s.riskIndicators.length ? 'Moderate' : 'Low') },
  { label: 'Contract Status', get: (s) => (s.activeContracts > 0 ? `${s.activeContracts} active` : s.expiredContracts > 0 ? 'Expired' : 'None on file') },
  { label: 'Last Purchase', get: (s) => s.lastPurchaseDate, fmt: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
];

export function SupplierComparisonScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data: suppliersData } = useProcurementSuppliers();
  const [selected, setSelected] = useState<number[]>(params?.supplierIds ?? []);
  const [results, setResults] = useState<SupplierIntelligence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runCompare(ids: number[]) {
    if (ids.length < 2) { setError('Select at least two suppliers to compare.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetchSupplierComparison(ids);
      setResults(res.suppliers);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.message ?? 'Could not load comparison.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params?.supplierIds && params.supplierIds.length >= 2) runCompare(params.supplierIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSupplier(id: number) {
    setResults(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Compare Suppliers" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pickerCard}>
          <Text style={styles.cardTitle}>Select 2-4 Suppliers</Text>
          <View style={styles.divider} />
          <View style={styles.chipsWrap}>
            {(suppliersData?.rows ?? []).map((s) => {
              const active = selected.includes(s.id);
              return (
                <TouchableOpacity key={s.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSupplier(s.id)} activeOpacity={0.7}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.compareBtn, selected.length < 2 && { opacity: 0.5 }]}
            disabled={selected.length < 2 || loading}
            onPress={() => runCompare(selected)}
          >
            <Ionicons name="git-compare-outline" size={16} color={Colors.white} />
            <Text style={styles.compareBtnText}>{loading ? 'Comparing…' : `Compare (${selected.length})`}</Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={Colors.navy} style={{ marginTop: Spacing.base }} /> : null}
        {error ? <ErrorState message={error} onRetry={() => runCompare(selected)} /> : null}

        {results && results.length >= 2 ? (
          <View style={styles.resultsCard}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1.2 }} />
              {results.map((s) => (
                <View key={s.id} style={styles.headerCell}>
                  <Text style={styles.headerName} numberOfLines={2}>{s.name}</Text>
                  <View style={[styles.tierPill, { backgroundColor: (TIER_COLOR[s.tier] ?? Colors.textMuted) + '22' }]}>
                    <Text style={[styles.tierPillText, { color: TIER_COLOR[s.tier] ?? Colors.textMuted }]}>{s.tier}</Text>
                  </View>
                </View>
              ))}
            </View>
            {METRICS.map((m) => {
              const vals = results.map((s) => m.get(s));
              const best = m.higherBetter ? Math.max(...vals.map((v) => Number(v) || 0)) : null;
              return (
                <View key={m.label} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  {results.map((s, i) => {
                    const raw = vals[i];
                    const isWinner = best !== null && Number(raw) === best && best > 0;
                    return (
                      <View key={s.id} style={styles.metricCell}>
                        <Text style={[styles.metricValue, isWinner && { color: Colors.success, fontWeight: Typography.bold }]}>
                          {m.fmt ? m.fmt(raw) : String(raw ?? '—')}{isWinner ? ' 🏆' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  pickerCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.bg, maxWidth: '100%' },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },
  compareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm },
  compareBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
  resultsCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, ...Shadow.sm },
  headerRow: { flexDirection: 'row', paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headerCell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  headerName: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textPrimary, textAlign: 'center' },
  tierPill: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  tierPillText: { fontSize: 9, fontWeight: Typography.semibold },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  metricLabel: { flex: 1.2, fontSize: Typography.xs, color: Colors.textMuted },
  metricCell: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: Typography.xs, color: Colors.textPrimary, textAlign: 'center' },
});
