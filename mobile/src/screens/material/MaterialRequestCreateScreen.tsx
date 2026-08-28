import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }        from '../../components/AppHeader';
import { OfflineBanner }    from '../../components/OfflineBanner';
import { FormInput }        from '../../components/FormInput';
import { FormSelect, SelectOption } from '../../components/FormSelect';
import { DatePickerField }  from '../../components/DatePickerField';
import { useMaterialRequests, useMaterialRequestCreate } from '../../hooks/useMaterialRequests';
import { useOfflineStore }  from '../../stores/offlineStore';
import { useAuthStore }     from '../../stores/authStore';
import { EP }               from '../../api/endpoints';
import { MaterialRequestsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow, Layout } from '../../theme';

type NavProp = NativeStackNavigationProp<MaterialRequestsStackParamList, 'MaterialRequestCreate'>;

// Matches the desktop create form's priority set exactly (normal/high/
// urgent) — previously mismatched with a mobile-only 'critical' value that
// neither the desktop badge nor the urgent-notification logic recognized.
const PRIORITY_OPTIONS: SelectOption[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'High',   value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

export function MaterialRequestCreateScreen() {
  const navigation    = useNavigation<NavProp>();
  // UI/UX redesign — reuses the already-fetched materialRequestsList items
  // (which includes available stock, same source desktop's create form
  // reads from) instead of the generic stock-items endpoint that has no
  // stock figure.
  const { data: listData, isLoading: itemsLoading } = useMaterialRequests();
  const { createRequest } = useMaterialRequestCreate();
  const isOnline      = useOfflineStore((s) => s.isOnline);
  const enqueue       = useOfflineStore((s) => s.enqueue);
  const user           = useAuthStore((s) => s.user);
  const isRestricted   = !!listData?.user_workshop_id;

  const [itemId,    setItemId]    = useState<number | null>(null);
  const [qty,       setQty]       = useState('');
  const [reason,    setReason]    = useState('');
  const [priority,  setPriority]  = useState<'normal' | 'high' | 'urgent'>('normal');
  const [neededBy,  setNeededBy]  = useState<string | null>(null);
  const [attachRef, setAttachRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const items = listData?.items ?? [];
  const itemOptions: SelectOption[] = items.map((i) => ({
    label: i.uom ? `${i.name} (${i.uom})` : i.name,
    value: i.id,
  }));
  const selectedItem = items.find((i) => i.id === itemId);
  const requestingWorkshop = isRestricted
    ? (listData?.workshops ?? []).find((w) => String(w.id) === String(listData?.user_workshop_id))?.name ?? 'Your workshop'
    : null;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!itemId) e.item = 'Please select an item';
    const n = Number(qty);
    if (!qty.trim() || isNaN(n) || n <= 0) e.qty = 'Enter a quantity greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const trimmedReason = reason.trim();
      const trimmedRef = attachRef.trim();
      const payload = {
        item_id:       itemId!,
        requested_qty: Number(qty),
        reason:        trimmedRef ? `${trimmedReason}${trimmedReason ? ' — ' : ''}Ref: ${trimmedRef}` : (trimmedReason || undefined),
        priority,
        needed_by:     neededBy || undefined,
      };

      if (!isOnline) {
        await enqueue({
          endpoint: EP.MATERIAL_CREATE,
          method:   'POST',
          body:     payload as Record<string, unknown>,
          context:  'material-request',
        });
        Alert.alert(
          'Saved Offline',
          'Your request has been saved and will be submitted automatically when you reconnect.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }

      await createRequest(payload);
      navigation.goBack();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Could not submit request. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="New Material Request" dark onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                Offline — request will be queued and synced when connected.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Request Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Request #</Text>
                <Text style={styles.infoValue}>Assigned on submit</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Request Date</Text>
                <Text style={styles.infoValue}>{new Date().toLocaleDateString()}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Requesting Workshop</Text>
                <Text style={styles.infoValue}>{requestingWorkshop ?? 'Select below'}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Requested By</Text>
                <Text style={styles.infoValue}>{user?.name ?? '—'}</Text>
              </View>
            </View>

            <FormSelect
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={priority}
              onChange={(v) => setPriority(v as typeof priority)}
            />

            <DatePickerField
              label="Needed By (optional)"
              value={neededBy}
              onChange={setNeededBy}
              minDate={new Date()}
            />

            <FormInput
              label="Purpose / Business Justification (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this needed?"
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Requested Items</Text>

            {itemsLoading ? (
              <ActivityIndicator color={Colors.navy} style={styles.itemsLoading} />
            ) : (
              <FormSelect
                label="Item"
                options={itemOptions}
                value={itemId}
                onChange={(v) => { setItemId(Number(v)); setErrors((e) => ({ ...e, item: '' })); }}
                placeholder="Select item…"
                required
                error={errors.item}
              />
            )}
            {selectedItem ? (
              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Available Stock</Text>
                <Text style={styles.stockValue}>{selectedItem.total_stock ?? 0} {selectedItem.uom}</Text>
              </View>
            ) : null}

            <FormInput
              label="Quantity Requested"
              value={qty}
              onChangeText={(v) => { setQty(v); setErrors((e) => ({ ...e, qty: '' })); }}
              keyboardType="numeric"
              placeholder="0"
              required
              error={errors.qty}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attachments (optional)</Text>
            <FormInput
              label="Reference"
              value={attachRef}
              onChangeText={setAttachRef}
              placeholder="e.g. a document/photo file name or ticket #"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : (
                <Text style={styles.submitBtnText}>
                  {isOnline ? 'Submit Request' : 'Save Offline'}
                </Text>
              )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  flex:   { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  offlineBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  offlineBannerText: {
    fontSize: Typography.sm,
    color: Colors.warning,
    fontWeight: Typography.medium,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemsLoading: {
    paddingVertical: Spacing.base,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  infoCell: { minWidth: '40%' },
  infoLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  infoValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: 2 },
  stockRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  stockLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  stockValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  multiline: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },

  submitBtn: {
    height: Layout.buttonHeight,
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
