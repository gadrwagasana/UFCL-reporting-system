import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { VatEntriesStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = VatEntriesStackScreenProps<'VatDetail'>;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

const TYPE_COLOR: Record<string, string> = {
  'Kiln-dried timber':  Colors.warning,
  'CCA treated timber': Colors.navy,
};

export function VatDetailScreen({ navigation, route }: Props) {
  const { entry } = route.params;
  const typeColor = TYPE_COLOR[entry.type_value_added] ?? Colors.textMuted;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="VAT Entry Detail" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20', borderColor: typeColor }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{entry.type_value_added}</Text>
          </View>
          <Text style={styles.qtyText}>{entry.num_timber} pcs</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <Row label="Product Size"  value={entry.product_size} />
          <Row label="Entry Date"    value={entry.date_fmt} />
          <Row label="Transfer ID"   value={entry.source_transfer_id} />
        </View>

        {(entry.created_by_name || entry.created_at) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Record Info</Text>
            <Row label="Created By"  value={entry.created_by_name} />
            <Row label="Recorded At" value={entry.created_at} />
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
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm,
  },
  typeBadge:     { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  typeBadgeText: { fontSize: Typography.sm, fontWeight: Typography.semibold },
  qtyText:       { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel:  { fontSize: Typography.sm, color: Colors.textSecondary },
  rowValue:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
});
