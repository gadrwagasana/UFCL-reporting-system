import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { SawmillStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = SawmillStackScreenProps<'SawmillProductionDetail'>;

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '' || value === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export function SawmillProductionDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<Props['route']>();
  const { entry }  = route.params;

  const totalTimber =
    (Number(entry.timber_kiln_dried ?? 0) +
     Number(entry.timber_cca_treated ?? 0) +
     Number(entry.timber_untreated ?? 0));

  const hasTimber = totalTimber > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Production Record" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="layers-outline" size={22} color={Colors.navy} />
            <Text style={styles.headerDate}>{entry.date}</Text>
          </View>
          {entry.machine && (
            <Text style={styles.machineBadge}>{entry.machine}</Text>
          )}
        </View>

        {/* Timber summary */}
        {hasTimber && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Timber Production</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{totalTimber}</Text>
                <Text style={styles.statLabel}>Total Units</Text>
              </View>
              {(entry.timber_waste ?? 0) > 0 && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={[styles.statValue, styles.wasteValue]}>{entry.timber_waste}</Text>
                    <Text style={styles.statLabel}>Waste</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.breakdown}>
              <DetailRow label="Kiln Dried"   value={entry.timber_kiln_dried} />
              <DetailRow label="CCA Treated"  value={entry.timber_cca_treated} />
              <DetailRow label="Untreated"    value={entry.timber_untreated} />
              <DetailRow label="Product Size" value={entry.product_size} />
            </View>
          </View>
        )}

        {/* Input / Downtime */}
        {((entry.logs_received ?? 0) > 0 || (entry.downtime_hours ?? 0) > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Operations</Text>
            <DetailRow label="Logs Received"  value={entry.logs_received} />
            <DetailRow label="Downtime Hours" value={entry.downtime_hours} />
          </View>
        )}

        {/* People */}
        {(entry.supervisor || entry.operators) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Team</Text>
            <DetailRow label="Supervisor" value={entry.supervisor} />
            <DetailRow label="Operators"  value={entry.operators} />
          </View>
        )}

        {/* Remarks */}
        {entry.remarks && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Remarks</Text>
            <Text style={styles.notes}>{entry.remarks}</Text>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerDate: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  machineBadge: {
    fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium,
    backgroundColor: Colors.navyBg ?? '#EEF2FF',
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  statsGrid:   { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  statValue:   { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  wasteValue:  { color: Colors.warning },
  statLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  breakdown: { gap: Spacing.xs },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  notes: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
