import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { VehicleFuelStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

type Props = VehicleFuelStackScreenProps<'VehicleFuelDetail'>;

export function VehicleFuelDetailScreen({ route, navigation }: Props) {
  const { entry } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Fuel Log" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.liters}>{entry.liters} L</Text>
          <Text style={styles.registration}>{entry.registration}</Text>
          <Text style={styles.date}>{entry.log_date}</Text>
        </View>

        <View style={styles.qtyGrid}>
          <View style={styles.qtyCell}>
            <Text style={styles.qtyValue}>{entry.liters}</Text>
            <Text style={styles.qtyLabel}>Litres</Text>
          </View>
          <View style={styles.qtySep} />
          <View style={styles.qtyCell}>
            <Text style={styles.qtyValue}>{entry.cost_per_liter ?? '—'}</Text>
            <Text style={styles.qtyLabel}>TZS/L</Text>
          </View>
          <View style={styles.qtySep} />
          <View style={styles.qtyCell}>
            <Text style={styles.qtyValue}>
              {entry.total_cost != null ? entry.total_cost.toLocaleString() : '—'}
            </Text>
            <Text style={styles.qtyLabel}>Total TZS</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Vehicle"   value={entry.registration} />
          <DetailRow label="Date"      value={entry.log_date} />
          <DetailRow label="Odometer"  value={entry.odometer != null ? `${entry.odometer} km` : null} />
          <DetailRow label="Notes"     value={entry.notes} />
          <DetailRow label="Logged By" value={entry.logged_by} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  headerCard:   { backgroundColor: Colors.navy + '1A', borderRadius: Radius.lg, padding: Spacing.base, gap: 2, ...Shadow.sm },
  liters:       { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.navy },
  registration: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  date:         { fontSize: Typography.xs, color: Colors.textMuted },

  qtyGrid:  { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  qtyCell:  { flex: 1, alignItems: 'center' },
  qtySep:   { width: 1, backgroundColor: Colors.border },
  qtyValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  qtyLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  rowLabel:     { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:     { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 2, textAlign: 'right' },
});
