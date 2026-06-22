import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { HarvestStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = HarvestStackScreenProps<'HarvestDetail'>;

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export function HarvestDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<Props['route']>();
  const { entry }  = route.params;

  const hasLogs = (entry.logs_crosscut ?? 0) > 0 || (entry.logs_handrolled ?? 0) > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Harvest Entry" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Species header */}
        <View style={styles.header}>
          <View style={styles.speciesBadge}>
            <Ionicons name="leaf" size={20} color={Colors.green} />
            <Text style={styles.speciesName}>{entry.species}</Text>
          </View>
          <Text style={styles.dateLabel}>{entry.harvest_date}</Text>
        </View>

        {/* Quantities */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Production</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{entry.quantity}</Text>
              <Text style={styles.statLabel}>{entry.uom ?? 'Trees'}</Text>
            </View>
            {hasLogs && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{entry.logs_crosscut ?? 0}</Text>
                  <Text style={styles.statLabel}>Crosscut</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{entry.logs_handrolled ?? 0}</Text>
                  <Text style={styles.statLabel}>Handrolled</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Location */}
        {(entry.compt_name || entry.location || entry.sub_name) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location</Text>
            <DetailRow label="Compartment" value={entry.compt_name} />
            <DetailRow label="Sub-plot"    value={entry.sub_name} />
            <DetailRow label="Location"    value={entry.location} />
          </View>
        )}

        {/* Meta */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record Info</Text>
          <DetailRow label="Logged by"  value={entry.logged_by} />
          <DetailRow label="Logged on"  value={entry.created_at} />
        </View>

        {/* Notes */}
        {entry.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Remarks</Text>
            <Text style={styles.notes}>{entry.notes}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  header: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', ...Shadow.sm,
  },
  speciesBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  speciesName:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  dateLabel:    { fontSize: Typography.sm, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  statsGrid:   { flexDirection: 'row', alignItems: 'center' },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  statValue:   { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  notes: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
