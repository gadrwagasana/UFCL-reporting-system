import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { AppHeader }    from '../../components/AppHeader';
import { FormInput }    from '../../components/FormInput';
import { usePolesQualityCheck } from '../../hooks/usePoles';
import { useOfflineStore }       from '../../stores/offlineStore';
import { PolesQCStackScreenProps } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = PolesQCStackScreenProps<'PolesQCDetail'>;

export function PolesQualityCheckScreen({ navigation, route }: Props) {
  const { delivery }      = route.params;
  const [approvedQty,     setApprovedQty]     = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [submitting,      setSubmitting]      = useState(false);

  const { submitQC } = usePolesQualityCheck(delivery.id);
  const { isOnline } = useOfflineStore();

  const impliedReject = delivery.delivered_qty - (Number(approvedQty) || 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!approvedQty || isNaN(Number(approvedQty)))       e.approvedQty = 'Enter approved quantity';
    else if (Number(approvedQty) < 0)                     e.approvedQty = 'Cannot be negative';
    else if (Number(approvedQty) > delivery.delivered_qty) e.approvedQty = `Cannot exceed delivered qty (${delivery.delivered_qty})`;
    return e;
  }

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Quality check approvals affect stock levels and must be submitted while connected.');
      return;
    }
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await submitQC({
        approved_qty: Number(approvedQty),
        ...(rejectionReason.trim() && { rejection_reason: rejectionReason.trim() }),
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'QC submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Quality Check" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{delivery.delivered_qty}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
          </View>
          {delivery.supplier_name && <Text style={styles.meta}>{delivery.supplier_name}</Text>}
          <Text style={styles.meta}>{delivery.delivery_date}</Text>
          {delivery.delivery_note_ref && <Text style={styles.meta}>Ref: {delivery.delivery_note_ref}</Text>}
        </View>

        {!isOnline && (
          <View style={styles.offlineAlert}>
            <Ionicons name="wifi-outline" size={16} color={Colors.error} />
            <Text style={styles.offlineText}>
              Go online to submit quality checks. This action affects stock levels and cannot be queued offline.
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
            hint={`Delivered: ${delivery.delivered_qty} poles`}
          />

          {approvedQty !== '' && !isNaN(Number(approvedQty)) && Number(approvedQty) >= 0 && (
            <View style={styles.impliedRow}>
              <View style={styles.impliedStat}>
                <Text style={[styles.impliedValue, { color: Colors.success }]}>{Number(approvedQty)}</Text>
                <Text style={styles.impliedLabel}>Approved</Text>
              </View>
              <View style={styles.impliedStat}>
                <Text style={[styles.impliedValue, impliedReject > 0 && { color: Colors.error }]}>{impliedReject}</Text>
                <Text style={styles.impliedLabel}>Rejected (supplier)</Text>
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
            : <Text style={styles.submitText}>Submit Quality Check</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  statsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  stat:      { alignItems: 'center' },
  statValue: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  meta:      { fontSize: Typography.sm, color: Colors.textSecondary },

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
