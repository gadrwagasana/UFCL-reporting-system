import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { useProcurementPoDetail, useProcurementOrderActions } from '../../hooks/useProcurementOrders';
import { ProcurementStackParamList } from '../../navigation/types';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'GoodsReceiptCreate'>;
type RouteType = RouteProp<ProcurementStackParamList, 'GoodsReceiptCreate'>;

interface DraftLine { quantity_received: string; quantity_rejected: string; rejection_reason: string }

export function GoodsReceiptCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data, isLoading, isError, refetch } = useProcurementPoDetail(params.poId);
  const { recordReceipt } = useProcurementOrderActions();
  const [lines, setLines] = useState<Record<number, DraftLine>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading || !data) return <LoadingState message="Loading order…" fullScreen />;
  if (isError) return <ErrorState message="Could not load purchase order" onRetry={refetch} fullScreen />;

  const { po, items } = data;
  const blacklisted = !!po.supplier_blacklisted;

  function lineFor(id: number): DraftLine {
    return lines[id] ?? { quantity_received: '', quantity_rejected: '0', rejection_reason: '' };
  }
  function updateLine(id: number, patch: Partial<DraftLine>) {
    setLines((prev) => ({ ...prev, [id]: { ...lineFor(id), ...patch } }));
  }

  async function onSave() {
    const payloadItems = items
      .map((it) => {
        const line = lineFor(it.id);
        const qty = Number(line.quantity_received) || 0;
        if (qty <= 0 && !(Number(line.quantity_rejected) > 0)) return null;
        return {
          po_item_id: it.id,
          quantity_received: qty,
          quantity_rejected: Number(line.quantity_rejected) || 0,
          rejection_reason: line.rejection_reason.trim() || undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (!payloadItems.length) return Alert.alert('Enter received or rejected quantity for at least one item');
    if (blacklisted) return Alert.alert('This supplier is blacklisted and cannot participate in procurement.');

    setSaving(true);
    try {
      const res = await recordReceipt(params.poId, { items: payloadItems, notes: notes.trim() || undefined });
      if (res.ok) {
        showToast('Goods receipt recorded.');
        // Navigation-consistency fix (Phase 2A): open the new receipt's
        // detail view directly instead of returning to the previous screen.
        if (res.id) navigation.replace('GoodsReceiptDetail', { receiptId: res.id });
        else navigation.goBack();
      } else {
        Alert.alert('Could not record receipt', res.error ?? 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Could not record receipt', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Record Goods Receipt" dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {po.supplier_name ? <Text style={styles.supplierName}>{po.supplier_name}</Text> : null}
        {blacklisted ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={18} color={Colors.error} />
            <Text style={styles.warningCardText}>This supplier is blacklisted and cannot participate in procurement.</Text>
          </View>
        ) : null}
        {items.map((it) => {
          const line = lineFor(it.id);
          return (
            <View key={it.id} style={styles.itemCard}>
              <Text style={styles.itemDesc}>{it.description}</Text>
              <Text style={styles.itemOrdered}>Ordered: {it.quantity}</Text>
              <View style={styles.fieldsRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Received</Text>
                  <TextInput style={styles.input} keyboardType="numeric" editable={!blacklisted} value={line.quantity_received} onChangeText={(v) => updateLine(it.id, { quantity_received: v })} placeholder="0" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Rejected</Text>
                  <TextInput style={styles.input} keyboardType="numeric" editable={!blacklisted} value={line.quantity_rejected} onChangeText={(v) => updateLine(it.id, { quantity_rejected: v })} placeholder="0" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
              {Number(line.quantity_rejected) > 0 ? (
                <TextInput
                  style={styles.input}
                  placeholder="Rejection reason"
                  placeholderTextColor={Colors.textMuted}
                  editable={!blacklisted}
                  value={line.rejection_reason}
                  onChangeText={(v) => updateLine(it.id, { rejection_reason: v })}
                />
              ) : null}
            </View>
          );
        })}

        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} multiline editable={!blacklisted} value={notes} onChangeText={setNotes} placeholder="Condition notes, delivery reference, etc." placeholderTextColor={Colors.textMuted} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, (saving || blacklisted) && { opacity: 0.6 }]} onPress={onSave} disabled={saving || blacklisted}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Record Receipt'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  supplierName: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  warningCardText: { flex: 1, fontSize: Typography.sm, color: Colors.error, fontWeight: Typography.medium },
  itemCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  itemDesc: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  itemOrdered: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.xs },
  fieldsRow: { flexDirection: 'row', gap: Spacing.sm },
  fieldHalf: { flex: 1 },
  field: { marginBottom: Spacing.sm },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card, marginBottom: Spacing.xs },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
