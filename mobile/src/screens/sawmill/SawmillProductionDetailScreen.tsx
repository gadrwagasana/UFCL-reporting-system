import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { ReasonModal } from '../../components/ReasonModal';
import { useSawmillDelete } from '../../hooks/useSawmill';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineStore } from '../../stores/offlineStore';
import { MachinePendingApproval } from '../../types/api';
import { SawmillStackScreenProps, SawmillStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = SawmillStackScreenProps<'SawmillProductionDetail'>;
type NavProp = NativeStackNavigationProp<SawmillStackParamList, 'SawmillProductionDetail'>;

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
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<Props['route']>();
  const { entry }  = route.params;
  const { can }    = useAuth();
  const canWrite   = can('sawmill.write');
  const { isOnline } = useOfflineStore();
  const { deleteEntry } = useSawmillDelete();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalTimber =
    (Number(entry.timber_kiln_dried ?? 0) +
     Number(entry.timber_cca_treated ?? 0) +
     Number(entry.timber_untreated ?? 0));

  const hasTimber = totalTimber > 0;

  async function handleDelete(reason: string) {
    setDeleteLoading(true);
    try {
      const result = await deleteEntry(entry.id, reason);
      if (result && 'pendingApproval' in result && (result as MachinePendingApproval).pendingApproval) {
        Alert.alert('Submitted for Review', (result as MachinePendingApproval).message);
      }
      setDeleteOpen(false);
      navigation.goBack();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Production Record"
        dark
        onBack={() => navigation.goBack()}
        actions={canWrite ? [{ icon: 'create-outline', label: 'Edit entry', onPress: () => navigation.navigate('SawmillProductionCreate', { entry }) }] : []}
      />

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

        {/* Sawmill Timber Entry enhancement — sizes produced + volume recovery */}
        {(entry.timberSizes?.length || (entry.expectedVolumeM3 ?? 0) > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Volume &amp; Recovery</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{(entry.expectedVolumeM3 ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Expected (m³)</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{(entry.actualVolumeM3 ?? 0).toFixed(3)}</Text>
                <Text style={styles.statLabel}>Actual (m³)</Text>
              </View>
              {(entry.expectedVolumeM3 ?? 0) > 0 && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statValue}>{Math.round(((entry.actualVolumeM3 ?? 0) / (entry.expectedVolumeM3 ?? 1)) * 100)}%</Text>
                    <Text style={styles.statLabel}>Recovery</Text>
                  </View>
                </>
              )}
            </View>

            {!!entry.timberSizes?.length && (
              <View style={styles.breakdown}>
                {entry.timberSizes.map((s, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.rowLabel}>{s.widthMm}×{s.thicknessMm}×{s.lengthM}m ×{s.quantity}</Text>
                    <Text style={styles.rowValue}>{s.volumeM3.toFixed(3)} m³</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Input / Downtime */}
        {((entry.logs_received ?? 0) > 0 || (entry.downtime_hours ?? 0) > 0 || entry.start_time || entry.end_time) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Operations</Text>
            <DetailRow label="Intake Logs"     value={entry.logs_received} />
            <DetailRow label="Log Diameter"    value={entry.log_diameter_cm ? `${entry.log_diameter_cm} cm` : undefined} />
            <DetailRow label="Start Time"      value={entry.start_time} />
            <DetailRow label="End Time"        value={entry.end_time} />
            <DetailRow label="Downtime"        value={entry.downtime_hours ? `${entry.downtime_hours}h` : undefined} />
            <DetailRow label="Downtime Reason" value={entry.downtime_reason} />
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

        {canWrite && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              if (!isOnline) { Alert.alert('Online Required', 'Deleting a production entry requires an active connection.'); return; }
              setDeleteOpen(true);
            }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={styles.deleteBtnText}>Delete Entry</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      <ReasonModal
        visible={deleteOpen}
        title="Delete Production Entry"
        message={`Move the ${entry.date} production entry to Trash? This also reverses any Finished Timber Inventory it posted.`}
        confirmLabel="Delete"
        loading={deleteLoading}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
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

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
  },
  deleteBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.error },
});
