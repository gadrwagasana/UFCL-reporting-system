import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { PolesProductionStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = PolesProductionStackScreenProps<'PolesProductionDetail'>;

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '' || value === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function PolesProductionDetailScreen({ navigation, route }: Props) {
  const { entry } = route.params;
  const totalConsumed = (entry.poles_units ?? 0) + (entry.poles_waste ?? 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Production Detail" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="cube" size={28} color={Colors.navy} />
            <Text style={styles.dateText}>{entry.date}</Text>
          </View>
          {entry.product_size && (
            <View style={styles.sizeBadge}>
              <Text style={styles.sizeBadgeText}>{entry.product_size}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{entry.poles_units ?? 0}</Text>
              <Text style={styles.statLabel}>Units Produced</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: Colors.warning }]}>{entry.poles_waste ?? 0}</Text>
              <Text style={styles.statLabel}>Waste</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{totalConsumed}</Text>
              <Text style={styles.statLabel}>Total Consumed</Text>
            </View>
          </View>
        </View>

        {entry.logs_received !== undefined && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Operations</Text>
            <DetailRow label="Logs Received"  value={entry.logs_received} />
            <DetailRow label="Downtime (hrs)" value={entry.downtime_hours} />
          </View>
        )}

        {entry.remarks && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Remarks</Text>
            <Text style={styles.remarksText}>{entry.remarks}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm,
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dateText:     { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  sizeBadge:    { backgroundColor: Colors.navyBg, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  sizeBadgeText:{ fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.semibold },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },

  statsGrid:   { flexDirection: 'row', justifyContent: 'space-around' },
  stat:        { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel:  { fontSize: Typography.sm, color: Colors.textSecondary },
  rowValue:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  remarksText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
