import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { StatusBadge }  from '../../components/StatusBadge';
import { CasualLabourStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type RouteProps = CasualLabourStackScreenProps<'CasualLabourDetail'>['route'];
type NavProps   = CasualLabourStackScreenProps<'CasualLabourDetail'>['navigation'];

interface RowProps { label: string; value: string }
function Row({ label, value }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function normaliseLabourItems(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return [raw]; }
}

export function CasualLabourDetailScreen() {
  const route      = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const { item }   = route.params;

  const labourItems = normaliseLabourItems(item.labour_items);
  const isApproved  = item.status === 'Approved';
  const isRejected  = item.status === 'Rejected';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Labour Request" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.task}>{item.task}</Text>
            <StatusBadge status={item.status} />
          </View>
          {item.created_by_name ? (
            <View style={styles.submittedRow}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.submittedText}>By {item.created_by_name}</Text>
              {item.created_fmt ? <Text style={styles.submittedText}> · {item.created_fmt}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Schedule + headcount */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          <View style={styles.divider} />
          <Row label="Start Date"  value={item.start_fmt ?? item.start_date} />
          <View style={styles.rowDivider} />
          <Row label="End Date"    value={item.end_fmt ?? item.end_date} />
          <View style={styles.rowDivider} />
          <Row label="# Casuals"   value={String(item.num_casuals)} />
          {item.description ? (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Description</Text>
                <Text style={[styles.rowValue, styles.multilineValue]}>{item.description}</Text>
              </View>
            </>
          ) : null}
          {item.comments ? (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Comments</Text>
                <Text style={[styles.rowValue, styles.multilineValue]}>{item.comments}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Labour items list */}
        {labourItems.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Labour Items</Text>
            <View style={styles.divider} />
            {labourItems.map((li, idx) => (
              <View key={idx} style={styles.labourItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.navy} />
                <Text style={styles.labourItemText}>{li}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Review result */}
        {(isApproved || isRejected) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review</Text>
            <View style={styles.divider} />
            <View style={styles.timelineRow}>
              <Ionicons
                name={isRejected ? 'close-circle' : 'checkmark-circle'}
                size={20}
                color={isRejected ? Colors.error : Colors.success}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineMain}>
                  {isRejected ? 'Rejected' : 'Approved'}
                  {item.reviewed_by_name ? ` by ${item.reviewed_by_name}` : ''}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  divider:    { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { height: 1, backgroundColor: Colors.divider },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  task: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  submittedText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.base,
  },
  rowLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  rowValue: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  multilineValue: { textAlign: 'left' },

  labourItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  labourItemText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    flex: 1,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timelineContent: { flex: 1 },
  timelineMain: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
});
