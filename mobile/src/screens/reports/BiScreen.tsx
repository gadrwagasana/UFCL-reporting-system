import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { LineChart }      from 'react-native-gifted-charts';
import { AppHeader }      from '../../components/AppHeader';
import { LoadingState }   from '../../components/LoadingState';
import { ErrorState }     from '../../components/ErrorState';
import { SparklineChart } from '../../components/SparklineChart';
import { useBiDashboard } from '../../hooks/useReports';
import type { BiRisk, BiRecommendation, BiStockShortage, BiHarvestForecast } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Severity = 'critical' | 'high' | 'medium' | 'low';
const SEV_COLOR: Record<Severity, string> = {
  critical: '#DC2626',
  high:     '#EA580C',
  medium:   '#D97706',
  low:      Colors.success,
};
const INDIGO = '#4F46E5';

function SevBadge({ sev }: { sev: string }) {
  const color = SEV_COLOR[sev as Severity] ?? Colors.textMuted;
  return (
    <View style={[s.badge, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
      <Text style={[s.badgeText, { color }]}>{sev.toUpperCase()}</Text>
    </View>
  );
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? Colors.success : score >= 60 ? Colors.warning : Colors.error;
  return (
    <View style={s.gaugeWrap}>
      <View style={[s.gaugeBg, { borderColor: Colors.border }]}>
        <Text style={[s.gaugeScore, { color }]}>{score}</Text>
        <Text style={s.gaugeLabel}>/ 100</Text>
      </View>
      <Text style={[s.gaugeStatus, { color }]}>
        {score >= 80 ? 'Healthy' : score >= 60 ? 'Attention needed' : 'Critical'}
      </Text>
    </View>
  );
}

function PredCard({ icon, label, val, sev, sparkData }: {
  icon?: string; label: string; val: string; sev: string; sparkData?: number[];
}) {
  const color = SEV_COLOR[sev as Severity] ?? Colors.textMuted;
  return (
    <View style={[s.predCard, { borderLeftColor: color }]}>
      <View style={s.predTop}>
        <Text style={s.predLabel}>{label}</Text>
        <SevBadge sev={sev} />
      </View>
      <Text style={s.predVal}>{val}</Text>
      {sparkData && sparkData.length >= 2 && (
        <SparklineChart data={sparkData} width={80} height={24} color={color} />
      )}
    </View>
  );
}

function RiskCard({ risk }: { risk: BiRisk }) {
  const color = SEV_COLOR[risk.severity] ?? Colors.textMuted;
  return (
    <View style={[s.riskCard, { borderLeftColor: color }]}>
      <View style={s.riskTop}>
        <Text style={s.riskModule}>{risk.module}</Text>
        <SevBadge sev={risk.severity} />
      </View>
      <Text style={s.riskTitle}>{risk.title}</Text>
      <Text style={s.riskDetail}>{risk.detail}</Text>
    </View>
  );
}

function RecCard({ rec }: { rec: BiRecommendation }) {
  return (
    <View style={s.recCard}>
      <View style={s.recTop}>
        <SevBadge sev={rec.priority} />
        <Text style={s.recModule}>{rec.module}</Text>
      </View>
      <Text style={s.recTitle}>{rec.title}</Text>
      <Text style={s.recDesc}>{rec.description}</Text>
      {rec.action && <Text style={s.recAction}>→ {rec.action}</Text>}
    </View>
  );
}

function StockRow({ item }: { item: BiStockShortage }) {
  const d   = item.days_until_depletion;
  const color = d != null ? (d <= 7 ? Colors.error : d <= 14 ? Colors.warning : '#D97706') : Colors.warning;
  return (
    <View style={s.tableRow}>
      <Text style={[s.cell, { flex: 1.5 }]} numberOfLines={1}>{item.name}</Text>
      <Text style={s.numCell}>{item.current_stock} {item.uom}</Text>
      <Text style={s.numCell}>{Number(item.avg_daily_consumption).toFixed(1)}/d</Text>
      <View style={[s.badge, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
        <Text style={[s.badgeText, { color }]}>{d != null ? `${d}d` : '< min'}</Text>
      </View>
    </View>
  );
}

function HarvestRow({ item }: { item: BiHarvestForecast }) {
  const d     = item.days_to_complete;
  const color = d !== null ? (d > 90 ? Colors.warning : Colors.success) : Colors.textMuted;
  return (
    <View style={s.tableRow}>
      <Text style={[s.cell, { flex: 1.5 }]} numberOfLines={1}>{item.compt_name}</Text>
      <Text style={s.numCell}>{item.pct_complete.toFixed(0)}%</Text>
      <View style={[s.badge, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
        <Text style={[s.badgeText, { color }]}>{d !== null ? `${d}d` : 'stalled'}</Text>
      </View>
    </View>
  );
}

export function BiScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useBiDashboard();

  if (isLoading) return <LoadingState message="Running predictive analytics…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load business intelligence" onRetry={refetch} fullScreen />;

  const { health, predictions, forecasts, risks, recommendations, stockAnomalies } = data;
  const sec = new Set(data.sections);

  const fuelAnomaly = predictions.fuelAnomaly;
  const fuelPct     = Number(fuelAnomaly?.pct_change ?? 0);
  const fuelZ       = Number(fuelAnomaly?.z_score    ?? 0);
  const fuelSev     = fuelZ > 2 ? 'critical' : fuelZ > 1.5 ? 'high' : fuelZ > 0.8 ? 'medium' : 'low';

  const critStock  = (predictions.stockShortages ?? []).filter(s => (s.days_until_depletion ?? 99) <= 7);
  const stSev      = critStock.length > 0 ? 'critical' : (predictions.stockShortages ?? []).length > 0 ? 'high' : 'low';

  const overdueM   = (predictions.machineAlerts ?? []).filter(m => Number(m.days_overdue) > 0);
  const macSev     = overdueM.some(m => Number(m.days_overdue) > 14) ? 'critical' : overdueM.length ? 'high' : 'medium';

  const sReg       = predictions.salesRegression ?? { avg_daily: 0, slope: 0, r2: 0 };
  const sAvg       = Number(sReg.avg_daily) || 0;
  const sTrend     = sAvg > 0 ? (Number(sReg.slope) / sAvg) * 100 : 0;
  const sSev       = sTrend < -10 ? 'high' : sTrend < -5 ? 'medium' : 'low';

  const wReg       = predictions.workshopRegression ?? { total_avg: 0, total_slope: 0 };
  const wAvg       = Number(wReg.total_avg) || 0;
  const wTrend     = wAvg > 0 ? (Number(wReg.total_slope) / wAvg) * 100 : 0;
  const wSev       = wTrend < -15 ? 'critical' : wTrend < -5 ? 'high' : 'low';

  const actH       = (predictions.harvestForecast ?? []).filter(h => Number(h.rate_per_day) > 0);
  const hSev       = actH.filter(h => h.days_to_complete !== null && (h.days_to_complete ?? 0) > 90).length > 0 ? 'medium' : 'low';

  const salesChartData  = (forecasts.sales30d ?? []).map(r => ({ value: Number(r.revenue) }));
  const wkChartData     = (forecasts.wkTrend  ?? []).map(r => ({ value: Number(r.timber) + Number(r.poles) }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Business Intelligence" dark />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {/* Health score */}
        <View style={s.healthCard}>
          <HealthGauge score={health.score} />
          {health.breakdown.length > 0 ? (
            <View style={s.breakdownList}>
              {health.breakdown.map((b, i) => (
                <View key={i} style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>{b.label}</Text>
                  <Text style={s.breakdownPts}>−{b.pts}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.healthOk}>No deductions — all systems healthy</Text>
          )}
        </View>

        {/* Prediction cards */}
        <Text style={s.sectionHeader}>Predictive analytics</Text>
        <View style={s.predGrid}>
          {sec.has('stock') && (
            <PredCard label="Stock Forecast"      sev={stSev}  val={`${(predictions.stockShortages ?? []).length} item(s) at risk — ${critStock.length} critical`} sparkData={(predictions.stockShortages ?? []).map(s => s.days_until_depletion ?? 30)} />
          )}
          {sec.has('fuel') && (
            <PredCard label="Fuel Forecast"       sev={fuelSev} val={fuelZ > 1.5 ? `${Math.abs(fuelPct).toFixed(1)}% ${fuelPct > 0 ? 'above' : 'below'} baseline` : `Z-score ${fuelZ.toFixed(2)} — normal`} />
          )}
          {sec.has('machines') && (
            <PredCard label="Maintenance Forecast" sev={macSev} val={overdueM.length ? `${overdueM.length} overdue · ${(predictions.efficiencyDecline ?? []).length} declining` : 'All machines on schedule'} sparkData={(predictions.efficiencyDecline ?? []).map(m => Number(m.avg_eff))} />
          )}
          {sec.has('sales') && (
            <PredCard label="Sales Forecast" sev={sSev} val={sReg.r2 > 0.05 ? `${sTrend >= 0 ? '+' : ''}${sTrend.toFixed(1)}%/day · R²=${sReg.r2.toFixed(2)}` : 'Insufficient regression data'} sparkData={(forecasts.sales30d ?? []).slice(-8).map(r => Number(r.revenue))} />
          )}
          {sec.has('workshop') && (
            <PredCard label="Workshop Forecast" sev={wSev} val={wAvg > 0 ? `${wTrend >= 0 ? '+' : ''}${wTrend.toFixed(1)}%/wk · avg ${wAvg.toFixed(0)} u/wk` : 'No production data'} sparkData={(forecasts.wkTrend ?? []).map(r => Number(r.timber) + Number(r.poles))} />
          )}
          {sec.has('harvest') && (
            <PredCard label="Harvest Forecast" sev={hSev} val={actH.length ? `${actH.length} active · ${actH.filter(h => (h.days_to_complete ?? 0) > 90).length} behind schedule` : 'No active harvest operations'} sparkData={actH.map(h => h.pct_complete)} />
          )}
        </View>

        {/* Forecast charts */}
        {sec.has('charts') && salesChartData.length >= 2 && (
          <View style={s.chartCard}>
            <Text style={s.sectionTitle}>Sales revenue (30 days)</Text>
            <LineChart
              data={salesChartData}
              width={320}
              height={80}
              hideDataPoints
              color={Colors.success}
              thickness={2}
              hideYAxisText
              hideAxesAndRules
              areaChart
              startFillColor={Colors.success + '22'}
              endFillColor={Colors.success + '00'}
              curved
              initialSpacing={0}
              endSpacing={0}
            />
          </View>
        )}
        {sec.has('charts') && wkChartData.length >= 2 && (
          <View style={s.chartCard}>
            <Text style={s.sectionTitle}>Workshop production trend</Text>
            <LineChart
              data={wkChartData}
              width={320}
              height={80}
              hideDataPoints
              color={INDIGO}
              thickness={2}
              hideYAxisText
              hideAxesAndRules
              areaChart
              startFillColor={INDIGO + '22'}
              endFillColor={INDIGO + '00'}
              curved
              initialSpacing={0}
              endSpacing={0}
            />
          </View>
        )}

        {/* Risks */}
        {risks.length > 0 && (
          <>
            <Text style={s.sectionHeader}>Risk register</Text>
            {risks.slice(0, 8).map((r, i) => <RiskCard key={i} risk={r} />)}
          </>
        )}

        {/* Recommendations */}
        {sec.has('recommendations') && recommendations.length > 0 && (
          <>
            <Text style={s.sectionHeader}>Recommendations</Text>
            {recommendations.slice(0, 8).map((r, i) => <RecCard key={i} rec={r} />)}
          </>
        )}

        {/* Stock shortages table */}
        {sec.has('stock') && (predictions.stockShortages ?? []).length > 0 && (
          <View style={s.tableCard}>
            <Text style={s.sectionTitle}>Stock shortages</Text>
            <View style={[s.tableRow, s.tableHead]}>
              <Text style={[s.headCell, { flex: 1.5 }]}>Item</Text>
              <Text style={[s.headCell, s.numCell]}>Stock</Text>
              <Text style={[s.headCell, s.numCell]}>Avg/d</Text>
              <Text style={[s.headCell, s.numCell]}>Days</Text>
            </View>
            {(predictions.stockShortages ?? []).slice(0, 8).map((item, i) => <StockRow key={i} item={item} />)}
          </View>
        )}

        {/* Harvest progress table */}
        {sec.has('harvest') && actH.length > 0 && (
          <View style={s.tableCard}>
            <Text style={s.sectionTitle}>Harvest progress</Text>
            <View style={[s.tableRow, s.tableHead]}>
              <Text style={[s.headCell, { flex: 1.5 }]}>Compartment</Text>
              <Text style={[s.headCell, s.numCell]}>Done%</Text>
              <Text style={[s.headCell, s.numCell]}>Est days</Text>
            </View>
            {actH.slice(0, 8).map((item, i) => <HarvestRow key={i} item={item} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },
  scroll:        { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  healthCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, flexDirection: 'row', gap: Spacing.base, alignItems: 'flex-start', ...Shadow.sm },
  gaugeWrap:     { alignItems: 'center', gap: 4 },
  gaugeBg:       { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  gaugeScore:    { fontSize: Typography.xxl, fontWeight: Typography.bold },
  gaugeLabel:    { fontSize: 9, color: Colors.textMuted },
  gaugeStatus:   { fontSize: Typography.xs, fontWeight: Typography.medium, textAlign: 'center' },
  breakdownList: { flex: 1, gap: 4 },
  breakdownRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, flex: 1 },
  breakdownPts:  { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },
  healthOk:      { flex: 1, fontSize: Typography.xs, color: Colors.success },

  sectionHeader: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.xs },
  sectionTitle:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },

  predGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  predCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, borderLeftWidth: 3, gap: 4, ...Shadow.sm },
  predTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  predLabel:     { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textMuted, flex: 1 },
  predVal:       { fontSize: Typography.xs, color: Colors.textPrimary },

  badge:         { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText:     { fontSize: 9, fontWeight: Typography.bold },

  riskCard:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, borderLeftWidth: 3, gap: 3, ...Shadow.sm },
  riskTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riskModule:    { fontSize: 10, color: Colors.textMuted, fontWeight: Typography.medium },
  riskTitle:     { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  riskDetail:    { fontSize: Typography.xs, color: Colors.textSecondary },

  recCard:       { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, gap: 3, ...Shadow.sm },
  recTop:        { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  recModule:     { fontSize: 10, color: Colors.navy, backgroundColor: Colors.navy + '14', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  recTitle:      { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  recDesc:       { fontSize: Typography.xs, color: Colors.textSecondary },
  recAction:     { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  chartCard:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },

  tableCard:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 0, ...Shadow.sm },
  tableHead:     { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 4 },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  headCell:      { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textMuted, flex: 1 },
  cell:          { fontSize: Typography.xs, color: Colors.textPrimary, flex: 1 },
  numCell:       { width: 64, textAlign: 'right' as const, fontSize: Typography.xs, color: Colors.textPrimary },
});
