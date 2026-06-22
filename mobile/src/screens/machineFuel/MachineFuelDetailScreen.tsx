import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { MachineFuelStackScreenProps } from '../../navigation/types';
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

type Props = MachineFuelStackScreenProps<'MachineFuelDetail'>;

export function MachineFuelDetailScreen({ route, navigation }: Props) {
  const { entry } = route.params;
  const targetName = entry.machine_name ?? entry.plate_number ?? '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Fuel Log" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.qty}>{entry.quantity} {entry.unit}</Text>
          <Text style={styles.target}>{targetName}</Text>
          <Text style={styles.date}>{entry.date_fmt}</Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.fuelBadge}>
            <Text style={styles.fuelBadgeText}>{entry.fuel_type}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Machine"    value={entry.machine_name ?? entry.machine_code} />
          <DetailRow label="Plate"      value={entry.plate_number} />
          <DetailRow label="Date"       value={entry.date_fmt} />
          <DetailRow label="Operator"   value={entry.operator} />
          <DetailRow label="Notes"      value={entry.notes} />
          <DetailRow label="Logged By"  value={entry.logged_by_name} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  headerCard: { backgroundColor: Colors.navy + '1A', borderRadius: Radius.lg, padding: Spacing.base, gap: 2, ...Shadow.sm },
  qty:        { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.navy },
  target:     { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  date:       { fontSize: Typography.xs, color: Colors.textMuted },

  badgeRow:       { flexDirection: 'row' },
  fuelBadge:      { backgroundColor: Colors.info + '1A', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  fuelBadgeText:  { fontSize: Typography.xs, color: Colors.info, fontWeight: Typography.semibold },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  rowLabel:     { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:     { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 2, textAlign: 'right' },
});
