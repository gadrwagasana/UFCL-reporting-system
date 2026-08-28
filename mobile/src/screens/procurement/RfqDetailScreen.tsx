import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { FormInput } from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useProcurementRfqDetail, useProcurementRfqActions } from '../../hooks/useProcurementRfq';
import { useProcurementSuppliers } from '../../hooks/useProcurementSuppliers';
import { useProcurementOrderActions } from '../../hooks/useProcurementOrders';
import { ProcurementStackParamList } from '../../navigation/types';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'RfqDetail'>;
type RouteType = RouteProp<ProcurementStackParamList, 'RfqDetail'>;

export function RfqDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data, isLoading, isError, refetch } = useProcurementRfqDetail(params.rfqId);
  const { data: suppliersData } = useProcurementSuppliers();
  const { sendToSuppliers, selectQuotation, submitQuotation } = useProcurementRfqActions();
  const { generate } = useProcurementOrderActions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Stabilization Phase 5 (F-1) — records a phone/email quotation received
  // outside the supplier portal; mirrors desktop's RFQ detail overlay form.
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDays, setQuoteDays] = useState('');
  const [quoteTerms, setQuoteTerms] = useState('');

  const invitedIds = useMemo(() => new Set((data?.suppliers ?? []).map((s) => s.supplier_id)), [data]);
  const availableSuppliers = (suppliersData?.rows ?? []).filter((s) => !invitedIds.has(s.id) && !s.blacklisted);
  const quotableSuppliers = (data?.suppliers ?? []).filter((s) => !s.blacklisted);

  if (isLoading || !data) return <LoadingState message="Loading RFQ…" fullScreen />;
  if (isError) return <ErrorState message="Could not load RFQ" onRetry={refetch} fullScreen />;

  const { rfq, suppliers, quotations } = data;
  const selected = quotations.find((q) => q.status === 'selected');

  async function invite(supplierId: number) {
    setBusy(true);
    try { await sendToSuppliers(rfq.id, [supplierId]); setPickerOpen(false); showToast('Supplier invited.'); refetch(); }
    catch (e: any) { Alert.alert('Could not invite supplier', e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  }

  function onSelect(quotationId: number) {
    Alert.alert('Select this quotation?', 'This marks it as the winning quote for the RFQ.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Select', onPress: async () => {
          setBusy(true);
          try { await selectQuotation(quotationId, rfq.id); showToast('Quotation selected.'); refetch(); }
          catch (e: any) { Alert.alert('Could not select quotation', e?.message ?? 'Please try again.'); }
          finally { setBusy(false); }
        },
      },
    ]);
  }

  async function onSubmitQuotation() {
    if (!quoteSupplierId) { Alert.alert('Required', 'Select a supplier.'); return; }
    const amount = parseFloat(quoteAmount);
    if (!quoteAmount || Number.isNaN(amount) || amount <= 0) { Alert.alert('Required', 'Enter a valid quoted amount.'); return; }
    setBusy(true);
    try {
      await submitQuotation(rfq.id, Number(quoteSupplierId), {
        quoted_amount: amount,
        delivery_days: quoteDays ? Number(quoteDays) : undefined,
        terms: quoteTerms.trim() || undefined,
      });
      setQuoteFormOpen(false);
      setQuoteSupplierId(''); setQuoteAmount(''); setQuoteDays(''); setQuoteTerms('');
      showToast('Quotation recorded.');
      refetch();
    } catch (e: any) {
      Alert.alert('Could not record quotation', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onGeneratePo() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await generate(rfq.requisition_id, selected.id);
      if (res.id) {
        showToast('Purchase order generated.');
        navigation.navigate('PurchaseOrderDetail', { poId: res.id });
      } else {
        Alert.alert('Could not generate PO', res.error ?? 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Could not generate PO', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={rfq.rfq_number ?? `RFQ #${rfq.id}`} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.title}>{rfq.title}</Text>
            <StatusBadge status={rfq.status} withIcon />
          </View>
          {rfq.requisition_number ? <Text style={styles.meta}>From {rfq.requisition_number}</Text> : null}
          {rfq.due_date ? <Text style={styles.meta}>Due {new Date(rfq.due_date).toLocaleDateString()}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Invited Suppliers ({suppliers.length})</Text>
            <TouchableOpacity onPress={() => setPickerOpen((v) => !v)}>
              <Ionicons name={pickerOpen ? 'close' : 'add-circle-outline'} size={20} color={Colors.navy} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          {suppliers.map((s) => (
            <View key={s.id} style={styles.supplierRow}>
              <View style={styles.supplierNameRow}>
                <Text style={styles.supplierName}>{s.supplier_name}</Text>
                {s.blacklisted ? <View style={styles.blacklistPill}><Text style={styles.blacklistPillText}>Blacklisted</Text></View> : null}
              </View>
              <StatusBadge status={s.status} size="sm" withIcon />
            </View>
          ))}
          {suppliers.length === 0 ? <Text style={styles.emptyText}>No suppliers invited yet.</Text> : null}

          {pickerOpen ? (
            <View style={styles.pickerBox}>
              {availableSuppliers.length === 0 ? (
                <Text style={styles.emptyText}>No more suppliers to invite.</Text>
              ) : availableSuppliers.map((s) => (
                <TouchableOpacity key={s.id} style={styles.pickerRow} disabled={busy} onPress={() => invite(s.id)}>
                  <Text style={styles.pickerRowText}>{s.name}</Text>
                  <Ionicons name="add" size={16} color={Colors.navy} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Record Quotation</Text>
            <TouchableOpacity onPress={() => setQuoteFormOpen((v) => !v)}>
              <Ionicons name={quoteFormOpen ? 'close' : 'add-circle-outline'} size={20} color={Colors.navy} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          {quoteFormOpen ? (
            <View style={{ gap: Spacing.xs }}>
              <FormSelect
                label="Supplier"
                value={quoteSupplierId}
                options={quotableSuppliers.map((s) => ({ label: s.supplier_name ?? `Supplier #${s.supplier_id}`, value: String(s.supplier_id) }))}
                placeholder="Select supplier"
                onChange={(v) => setQuoteSupplierId(String(v))}
                required
              />
              <FormInput
                label="Quoted Amount"
                value={quoteAmount}
                onChangeText={setQuoteAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                required
              />
              <FormInput
                label="Delivery Days"
                value={quoteDays}
                onChangeText={setQuoteDays}
                keyboardType="number-pad"
                placeholder="Optional"
              />
              <FormInput
                label="Terms"
                value={quoteTerms}
                onChangeText={setQuoteTerms}
                placeholder="Optional"
              />
              <TouchableOpacity style={styles.selectBtn} disabled={busy} onPress={onSubmitQuotation}>
                <Text style={styles.selectBtnText}>Record Quotation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.emptyText}>Record a quotation received by phone or email.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quotation Comparison ({quotations.length})</Text>
          <View style={styles.divider} />
          {quotations.length === 0 ? (
            <Text style={styles.emptyText}>No quotations received yet.</Text>
          ) : quotations.map((q) => (
            <View key={q.id} style={[styles.quoteRow, q.status === 'selected' && styles.quoteRowSelected]}>
              <View style={styles.quoteHeader}>
                <Text style={styles.supplierName}>{q.supplier_name}{q.preferred ? ' ★' : ''}</Text>
                <StatusBadge status={q.status} size="sm" withIcon />
              </View>
              <View style={styles.quoteMetaRow}>
                <Text style={styles.quoteAmount}>{Number(q.quoted_amount).toLocaleString()}</Text>
                {q.delivery_days != null ? <Text style={styles.meta}>{q.delivery_days} days delivery</Text> : null}
                {q.rating != null ? <Text style={styles.meta}>Rating {q.rating}</Text> : null}
              </View>
              {q.blacklisted ? (
                <View style={styles.warningInline}>
                  <Ionicons name="alert-circle" size={13} color={Colors.error} />
                  <Text style={styles.warningInlineText}>Blacklisted — cannot be selected</Text>
                </View>
              ) : q.status === 'received' && !selected ? (
                <TouchableOpacity style={styles.selectBtn} disabled={busy} onPress={() => onSelect(q.id)}>
                  <Text style={styles.selectBtnText}>Select This Quote</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>

        {selected && selected.blacklisted ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={18} color={Colors.error} />
            <Text style={styles.warningCardText}>This supplier is blacklisted and cannot participate in procurement. Purchase order generation is disabled.</Text>
          </View>
        ) : null}
        {selected && !selected.blacklisted ? (
          <TouchableOpacity style={styles.generateBtn} disabled={busy} onPress={onGeneratePo}>
            <Text style={styles.generateBtnText}>Generate Purchase Order</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, flex: 1 },
  meta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, fontStyle: 'italic' },
  supplierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  supplierNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
  supplierName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  blacklistPill: { backgroundColor: Colors.errorBg, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  blacklistPillText: { fontSize: 10, color: Colors.error, fontWeight: Typography.medium },
  warningInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  warningInlineText: { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm },
  warningCardText: { flex: 1, fontSize: Typography.sm, color: Colors.error, fontWeight: Typography.medium },
  pickerBox: { marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.sm, gap: Spacing.xs },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  pickerRowText: { fontSize: Typography.sm, color: Colors.textPrimary },
  quoteRow: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 4 },
  quoteRowSelected: { backgroundColor: Colors.successBg, borderRadius: Radius.md, paddingHorizontal: Spacing.sm },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteMetaRow: { flexDirection: 'row', gap: Spacing.base, alignItems: 'center' },
  quoteAmount: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  selectBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginTop: 4 },
  selectBtnText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.semibold },
  generateBtn: { backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  generateBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
