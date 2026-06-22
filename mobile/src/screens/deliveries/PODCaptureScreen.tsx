import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { AppHeader }      from '../../components/AppHeader';
import { OfflineBanner }  from '../../components/OfflineBanner';
import { FormInput }      from '../../components/FormInput';
import { usePODCreate }   from '../../hooks/useDeliveries';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { useOfflineStore }          from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Props = DeliveryStackScreenProps<'PODCapture'>;

export function PODCaptureScreen({ route, navigation }: Props) {
  const { order }          = route.params;
  const { recordPOD }      = usePODCreate();
  const isOnline           = useOfflineStore((s) => s.isOnline);
  const [qtyAccepted, setQtyAccepted]   = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const dispatched    = order.qty_dispatched ?? 0;
  const accepted      = parseInt(qtyAccepted, 10) || 0;
  const rejected      = dispatched > 0 ? dispatched - accepted : 0;
  const hasRejections = rejected > 0 && qtyAccepted !== '';

  function validate() {
    const e: Record<string, string> = {};
    if (!qtyAccepted) {
      e.qtyAccepted = 'Quantity accepted is required';
    } else {
      const n = parseInt(qtyAccepted, 10);
      if (isNaN(n) || n < 0) e.qtyAccepted = 'Must be 0 or more';
      else if (dispatched > 0 && n > dispatched) e.qtyAccepted = `Cannot exceed ${dispatched} dispatched`;
    }
    if (hasRejections && !rejectionReason.trim()) {
      e.rejectionReason = 'Please provide a reason for the rejected quantity';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Offline', 'POD capture requires an internet connection.');
      return;
    }
    if (!validate()) return;

    Alert.alert(
      'Confirm POD',
      `Record ${accepted} units accepted${hasRejections ? ` and ${rejected} units rejected` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              await recordPOD(order.id, {
                qty_accepted:     accepted,
                rejection_reason: hasRejections ? rejectionReason.trim() : undefined,
              });
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not record POD.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Record POD" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoOrderNum}>{order.order_number}</Text>
          {order.customer_name && (
            <Text style={styles.infoCustomer}>{order.customer_name}</Text>
          )}
          <Text style={styles.infoDispatched}>{dispatched} units dispatched</Text>
        </View>

        {/* API limitation notice */}
        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.info} />
          <Text style={styles.noticeText}>Signature and photo capture not available via mobile API.</Text>
        </View>

        <FormInput
          label="Quantity Accepted"
          value={qtyAccepted}
          onChangeText={setQtyAccepted}
          keyboardType="numeric"
          placeholder={`Max ${dispatched}`}
          error={errors.qtyAccepted}
          required
        />

        {/* Live rejected calc */}
        {qtyAccepted !== '' && dispatched > 0 && (
          <View style={[styles.calcRow, rejected > 0 && styles.calcRowWarn]}>
            <Text style={[styles.calcLabel, rejected > 0 && { color: Colors.error }]}>
              Rejected: {rejected < 0 ? '—' : rejected}
            </Text>
          </View>
        )}

        {hasRejections && (
          <FormInput
            label="Rejection Reason"
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Describe reason for rejection"
            multiline
            error={errors.rejectionReason}
            required
          />
        )}

        {!isOnline && (
          <View style={styles.warnBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
            <Text style={styles.warnText}>You are offline. Connect to submit POD.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Record POD</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  infoCard:        { backgroundColor: Colors.navy + '1A', borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  infoOrderNum:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.navy },
  infoCustomer:    { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  infoDispatched:  { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4 },

  noticeBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, backgroundColor: Colors.info + '1A', borderRadius: Radius.md, padding: Spacing.sm },
  noticeText:   { flex: 1, fontSize: Typography.xs, color: Colors.info },

  calcRow:     { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, ...Shadow.sm },
  calcRowWarn: { backgroundColor: Colors.error + '0D' },
  calcLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },

  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warning + '1A', borderRadius: Radius.md, padding: Spacing.sm },
  warnText:   { fontSize: Typography.xs, color: Colors.warning },

  submitBtn:      { backgroundColor: Colors.success, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  submitDisabled: { opacity: 0.4 },
  submitText:     { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
