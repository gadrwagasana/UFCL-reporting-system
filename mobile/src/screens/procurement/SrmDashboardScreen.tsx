import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { useSrmDashboard } from '../../hooks/useSrm';
import { ProcurementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'SrmDashboard'>;

const SHORTCUTS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; screen: keyof ProcurementStackParamList }> = [
  { label: 'Contract Register', icon: 'document-text-outline', screen: 'ContractRegister' },
  { label: 'Compliance Center', icon: 'shield-checkmark-outline', screen: 'ComplianceCenter' },
  { label: 'SRM Reports', icon: 'bar-chart-outline', screen: 'ProcurementReports' },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SrmDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch } = useSrmDashboard();

  if (isLoading || !data) return <LoadingState message="Loading SRM dashboard…" fullScreen />;
  if (isError) return <ErrorState message="Could not load SRM dashboard" onRetry={refetch} fullScreen />;

  const { kpis } = data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Supplier Relationship Management" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statTile}><Text style={styles.statValue}>{kpis.totalSuppliers}</Text><Text style={styles.statLabel}>Suppliers</Text></View>
          <View style={styles.statTile}><Text style={styles.statValue}>{kpis.activeContracts}</Text><Text style={styles.statLabel}>Active Contracts</Text></View>
          <View style={styles.statTile}><Text style={[styles.statValue, kpis.expiringContracts > 0 && styles.statValueWarn]}>{kpis.expiringContracts}</Text><Text style={styles.statLabel}>Expiring Contracts</Text></View>
          <View style={styles.statTile}><Text style={[styles.statValue, kpis.expiredContracts > 0 && styles.statValueDanger]}>{kpis.expiredContracts}</Text><Text style={styles.statLabel}>Expired Contracts</Text></View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{kpis.compliancePct}%</Text><Text style={styles.statLabelAlt}>Compliance</Text></View>
          <View style={styles.statTileAlt}><Text style={[styles.statValueAlt, kpis.missingDocuments > 0 && styles.statValueWarn]}>{kpis.missingDocuments}</Text><Text style={styles.statLabelAlt}>Missing Docs</Text></View>
          <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{kpis.openImprovementPlans}</Text><Text style={styles.statLabelAlt}>Open Plans</Text></View>
          <View style={styles.statTileAlt}><Text style={[styles.statValueAlt, kpis.highRiskSuppliers > 0 && styles.statValueDanger]}>{kpis.highRiskSuppliers}</Text><Text style={styles.statLabelAlt}>High Risk</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <TouchableOpacity key={s.screen} style={styles.gridItem} onPress={() => navigation.navigate(s.screen as any)}>
              <Ionicons name={s.icon} size={22} color={Colors.navy} />
              <Text style={styles.gridLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Compliance by Type</Text>
          <View style={styles.divider} />
          {data.complianceTrend.map((c, i) => (
            <View key={c.type} style={i > 0 ? styles.rowDivider : undefined}>
              <Row label={c.type} value={`${c.validPct}% valid`} />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Improvement Plans</Text>
          <View style={styles.divider} />
          <Row label="Open" value={String(data.improvementProgress.openCount)} />
          <Row label="Avg Completion" value={`${data.improvementProgress.avgCompletion}%`} />
          <Row label="Closed" value={String(data.improvementProgress.closedCount)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Communication Activity (6 months)</Text>
          <View style={styles.divider} />
          {data.communicationActivity.length ? data.communicationActivity.map((m, i) => (
            <View key={m.month} style={i > 0 ? styles.rowDivider : undefined}>
              <Row label={m.month} value={`${m.n} logged`} />
            </View>
          )) : <Text style={styles.emptyText}>No communications logged in the last 6 months.</Text>}
        </View>

        <View style={styles.card}>
          <Row label="Documents nearing expiry (30 days)" value={String(data.documentsNearExpiry)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statTile: { flex: 1, backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center' },
  statValue: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold },
  statValueWarn: { color: '#ffd580' },
  statValueDanger: { color: '#ff9a9a' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, marginTop: 2, textAlign: 'center' },
  statTileAlt: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center', ...Shadow.sm },
  statValueAlt: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold },
  statLabelAlt: { color: Colors.textMuted, fontSize: Typography.xs, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: '31%', backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', gap: 6, ...Shadow.sm },
  gridLabel: { fontSize: Typography.xs, color: Colors.textPrimary, textAlign: 'center', fontWeight: Typography.medium },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.xs },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, gap: Spacing.base },
  rowLabel: { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textMuted, textAlign: 'right' },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, fontStyle: 'italic' },
});
