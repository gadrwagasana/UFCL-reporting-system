import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { LogTransportStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = LogTransportStackScreenProps<'LogTransportDetail'>;

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export function LogTransportDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<Props['route']>();
  const { entry }  = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Transport Record" dark onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Quantity header */}
        <View style={styles.header}>
          <View style={styles.qtyGroup}>
            <Ionicons name="git-merge-outline" size={22} color={Colors.navy} />
            <Text style={styles.qtyValue}>{entry.qty_transported}</Text>
            <Text style={styles.qtyUnit}>{entry.unit ?? 'logs'}</Text>
          </View>
          <Text style={styles.dateLabel}>{entry.date_fmt ?? entry.transport_date}</Text>
        </View>

        {/* Vehicle & Driver */}
        {(entry.tractor_plate || entry.loggers_number) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vehicle & Driver</Text>
            <DetailRow label="Vehicle"     value={entry.tractor_plate} />
            <DetailRow label="Driver"      value={entry.loggers_number} />
          </View>
        )}

        {/* Source */}
        {(entry.compt_name || entry.sub_name || entry.species) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Source Compartment</Text>
            <DetailRow label="Compartment" value={entry.compt_name} />
            <DetailRow label="Sub-plot"    value={entry.sub_name} />
            <DetailRow label="Species"     value={entry.species} />
          </View>
        )}

        {/* Meta */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record Info</Text>
          <DetailRow label="Logged by" value={entry.logged_by_name} />
          <DetailRow label="Logged on" value={entry.created_at} />
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
  qtyGroup:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  qtyValue:  { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  qtyUnit:   { fontSize: Typography.base, color: Colors.textMuted, alignSelf: 'flex-end', marginBottom: 2 },
  dateLabel: { fontSize: Typography.sm, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  notes: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
