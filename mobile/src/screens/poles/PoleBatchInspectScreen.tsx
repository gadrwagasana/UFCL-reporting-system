import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { FormInput }    from '../../components/FormInput';
import { usePoleProductionInspect } from '../../hooks/usePoles';
import { useOfflineStore }       from '../../stores/offlineStore';
import { PolesProductionStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Pole Production Phase 1 — Quality Inspection for a single production
// output line, mirroring PolesQualityCheckScreen's own accept/reject UI.
// Accepted quantity posts to real Finished Pole Inventory; rejected quantity
// creates a rejection_holds row, giving access to the existing Rework/
// Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal resolution paths
// (already generic — reachable from the desktop Resolution engine, same as
// Sawmill/Nyanza; not duplicated here).

type Props = PolesProductionStackScreenProps<'PoleBatchInspect'>;

export function PoleBatchInspectScreen({ navigation, route }: Props) {
  const { output } = route.params;
  const [approvedQty, setApprovedQty]         = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [errors, setErrors]                   = useState<Record<string, string>>({});
  const [submitting, setSubmitting]           = useState(false);

  const { inspect }   = usePoleProductionInspect();
  const { isOnline }  = useOfflineStore();

  const label = `${output.type}${output.sub_type ? ' ' + output.sub_type : ''} ${output.size}`;
  const impliedReject = output.quantity - (Number(approvedQty) || 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!approvedQty || isNaN(Number(approvedQty)))     e.approvedQty = 'Enter approved quantity';
    else if (Number(approvedQty) < 0)                   e.approvedQty = 'Cannot be negative';
    else if (Number(approvedQty) > output.quantity)      e.approvedQty = `Cannot exceed output qty (${output.quantity})`;
    return e;
  }

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Quality inspections affect stock levels and must be submitted while connected.');
      return;
    }
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await inspect(output.id, {
        approved_qty: Number(approvedQty),
        ...(rejectionReason.trim() && { rejection_reason: rejectionReason.trim() }),
      });
      const parts: string[] = [];
      if (result.approvedPosted) parts.push(`${approvedQty} accepted → posted to Finished Pole Inventory`);
      if (result.rejectionHoldId) parts.push(`${impliedReject} rejected → pending resolution`);
      Alert.alert('Inspection Complete', parts.join('. ') || 'Inspection recorded.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Inspection failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Pole Quality Inspection" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <Text style={styles.productLabel}>{label}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{output.quantity}</Text>
              <Text style={styles.statLabel}>Produced</Text>
            </View>
          </View>
        </View>

        {!isOnline && (
          <View style={styles.offlineAlert}>
            <Ionicons name="wifi-outline" size={16} color={Colors.error} />
            <Text style={styles.offlineText}>
              Go online to submit inspections. This action affects stock levels and cannot be queued offline.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <FormInput
            label="Approved Quantity"
            value={approvedQty}
            onChangeText={setApprovedQty}
            keyboardType="numeric"
            required
            error={errors.approvedQty}
            hint={`Produced: ${output.quantity} poles`}
          />

          {approvedQty !== '' && !isNaN(Number(approvedQty)) && Number(approvedQty) >= 0 && (
            <View style={styles.impliedRow}>
              <View style={styles.impliedStat}>
                <Text style={[styles.impliedValue, { color: Colors.success }]}>{Number(approvedQty)}</Text>
                <Text style={styles.impliedLabel}>Accepted</Text>
              </View>
              <View style={styles.impliedStat}>
                <Text style={[styles.impliedValue, impliedReject > 0 && { color: Colors.error }]}>{impliedReject}</Text>
                <Text style={styles.impliedLabel}>Rejected</Text>
              </View>
            </View>
          )}

          {impliedReject > 0 && (
            <FormInput
              label="Rejection Reason"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={2}
              hint="Describe the reason for rejected poles"
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Complete Inspection</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  productLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  statsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  stat:      { alignItems: 'center' },
  statValue: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  offlineAlert: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm,
  },
  offlineText: { flex: 1, fontSize: Typography.sm, color: Colors.error, lineHeight: 18 },

  section:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  impliedRow:  { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm },
  impliedStat: { alignItems: 'center' },
  impliedValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  impliedLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  submitBtn:         { backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm },
  submitBtnDisabled: { opacity: 0.4 },
  submitText:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
