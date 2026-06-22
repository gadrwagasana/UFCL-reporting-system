import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { MachineLogStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '' || value === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

type Props = MachineLogStackScreenProps<'MachineLogDetail'>;

export function MachineLogDetailScreen({ route, navigation }: Props) {
  const { entry } = route.params;
  const hasDowntime = (entry.downtime_hours ?? 0) > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Machine Log" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.machineName}>{entry.machine_name ?? entry.machine_code ?? '—'}</Text>
          <Text style={styles.date}>{entry.log_date}</Text>
          {entry.shift && (
            <View style={styles.shiftBadge}>
              <Text style={styles.shiftText}>{entry.shift}</Text>
            </View>
          )}
        </View>

        {/* Key metrics grid */}
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridValue}>{entry.hours_worked ?? '—'}</Text>
            <Text style={styles.gridLabel}>Hours Worked</Text>
          </View>
          <View style={styles.gridSep} />
          <View style={styles.gridCell}>
            <Text style={[styles.gridValue, hasDowntime && { color: Colors.warning }]}>{entry.downtime_hours ?? 0}</Text>
            <Text style={styles.gridLabel}>Downtime (h)</Text>
          </View>
          <View style={styles.gridSep} />
          <View style={styles.gridCell}>
            <Text style={styles.gridValue}>{entry.fuel_consumed ?? '—'}</Text>
            <Text style={styles.gridLabel}>Fuel (L)</Text>
          </View>
        </View>

        {/* Production grid */}
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridValue}>{entry.daily_production ?? '—'}</Text>
            <Text style={styles.gridLabel}>Production</Text>
          </View>
          <View style={styles.gridSep} />
          <View style={styles.gridCell}>
            <Text style={styles.gridValue}>{entry.loading_trips ?? '—'}</Text>
            <Text style={styles.gridLabel}>Trips</Text>
          </View>
          <View style={styles.gridSep} />
          <View style={styles.gridCell}>
            <Text style={styles.gridValue}>{entry.fuel_issued ?? '—'}</Text>
            <Text style={styles.gridLabel}>Fuel Issued</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Machine Code"    value={entry.machine_code} />
          <DetailRow label="Category"        value={entry.category_name} />
          <DetailRow label="Item Category"   value={entry.item_category} />
          <DetailRow label="Product Type"    value={entry.product_type} />
          <DetailRow label="Downtime Reason" value={entry.downtime_reason} />
          <DetailRow label="Logs Loaded"     value={entry.logs_loaded} />
          <DetailRow label="Logs Unloaded"   value={entry.logs_unloaded} />
          <DetailRow label="Capacity/Day"    value={entry.capacity_per_day} />
          <DetailRow label="Remarks"         value={entry.remarks} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  headerCard:  { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  machineName: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  date:        { fontSize: Typography.sm, color: Colors.textMuted },
  shiftBadge:  { alignSelf: 'flex-start', backgroundColor: Colors.navy + '1A', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  shiftText:   { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  grid:      { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  gridCell:  { flex: 1, alignItems: 'center' },
  gridSep:   { width: 1, backgroundColor: Colors.border },
  gridValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  gridLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  card:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  rowLabel:     { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue:     { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 2, textAlign: 'right' },
});
