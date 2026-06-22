import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { AppHeader }      from '../../components/AppHeader';
import { OfflineBanner }  from '../../components/OfflineBanner';
import { useDeliveryStatusUpdate } from '../../hooks/useDeliveries';
import { DeliveryStackScreenProps } from '../../navigation/types';
import { DeliveryStatus }           from '../../types/api';
import { useOfflineStore }          from '../../stores/offlineStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Only forward transitions are valid from each state
const ALLOWED_STATUSES: Record<string, DeliveryStatus[]> = {
  'Pending':    ['Assigned', 'Failed'],
  'Assigned':   ['In Transit', 'Failed'],
  'In Transit': ['Failed'],
};

type Props = DeliveryStackScreenProps<'DeliveryStatus'>;

export function DeliveryStatusScreen({ route, navigation }: Props) {
  const { order }           = route.params;
  const { updateStatus }    = useDeliveryStatusUpdate();
  const isOnline            = useOfflineStore((s) => s.isOnline);
  const [selected, setSelected] = useState<DeliveryStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const options = ALLOWED_STATUSES[order.status] ?? [];

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Offline', 'Status updates require a connection.');
      return;
    }
    if (!selected) return;

    setSubmitting(true);
    try {
      await updateStatus(order.id, selected);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update status.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Update Status" dark onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Current status</Text>
          <Text style={styles.currentValue}>{order.status}</Text>
          <Text style={styles.orderRef}>{order.order_number}</Text>
        </View>

        <Text style={styles.sectionLabel}>Set new status</Text>

        {options.length === 0 && (
          <View style={styles.noOptions}>
            <Text style={styles.noOptionsText}>No forward transitions available for this status.</Text>
          </View>
        )}

        {options.map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.option, selected === status && styles.optionSelected]}
            onPress={() => setSelected(status)}
            activeOpacity={0.75}
          >
            <View style={[styles.radio, selected === status && styles.radioSelected]}>
              {selected === status && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={[styles.optionText, selected === status && styles.optionTextSelected]}>{status}</Text>
            </View>
            {status === 'Failed' && (
              <Ionicons name="warning-outline" size={16} color={Colors.error} style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>
        ))}

        {!isOnline && (
          <View style={styles.warnBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
            <Text style={styles.warnText}>You are offline. Connect to submit.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (!selected || submitting || !isOnline) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!selected || submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Update Status</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  currentCard:  { backgroundColor: Colors.navy + '1A', borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  currentLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  currentValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.navy },
  orderRef:     { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  sectionLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.xs },

  option:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  optionSelected: { borderColor: Colors.navy, backgroundColor: Colors.navy + '0D' },
  optionText:     { fontSize: Typography.base, color: Colors.textPrimary },
  optionTextSelected: { fontWeight: Typography.semibold, color: Colors.navy },

  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.navy },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.navy },

  noOptions:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base },
  noOptionsText: { color: Colors.textMuted, fontSize: Typography.sm },

  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warning + '1A', borderRadius: Radius.md, padding: Spacing.sm },
  warnText:   { fontSize: Typography.xs, color: Colors.warning },

  submitBtn:      { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  submitDisabled: { opacity: 0.4 },
  submitText:     { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
});
