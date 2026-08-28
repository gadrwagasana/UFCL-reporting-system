import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, Alert } from 'react-native';
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
import { Button } from '../../components/Button';
import { ApprovalTimeline } from '../../components/ApprovalTimeline';
import { useProcurementPoDetail, useProcurementOrderActions } from '../../hooks/useProcurementOrders';
import { useProcurementInvoiceActions } from '../../hooks/useProcurementInvoices';
import { useAuth } from '../../hooks/useAuth';
import { ProcurementStackParamList } from '../../navigation/types';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'PurchaseOrderDetail'>;
type RouteType = RouteProp<ProcurementStackParamList, 'PurchaseOrderDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function PurchaseOrderDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { role } = useAuth();
  const { data, isLoading, isError, refetch } = useProcurementPoDetail(params.poId);
  const { create: createInvoice } = useProcurementInvoiceActions();
  const { closeWithShortage, decideShortage } = useProcurementOrderActions();
  const [invoiceForm, setInvoiceForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [shortageForm, setShortageForm] = useState(false);
  const [shortageReason, setShortageReason] = useState('');
  const [shortageSupplierExp, setShortageSupplierExp] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <LoadingState message="Loading purchase order…" fullScreen />;
  if (isError) return <ErrorState message="Could not load purchase order" onRetry={refetch} fullScreen />;

  const { po, items, fulfillment, steps } = data;
  const canReceive = ['issued', 'acknowledged', 'partially_received'].includes(po.status);
  const blacklisted = !!po.supplier_blacklisted;
  // Procurement Exception Management Phase 3 — "Waiting for Delivery" vs
  // "Supplier Will Not Deliver", distinguished via status/copy, not a new
  // visual language (mirrors desktop's openPoDetailOverlay exactly).
  const canCloseShortage = po.status === 'partially_received' && fulfillment.outstandingQty > 0;
  const currentStep = (steps ?? []).find((s) => s.status === 'pending');
  const canAct = po.status === 'shortage_pending_approval' && !!currentStep && (currentStep.assigned_role === role || role === 'admin');

  async function onCloseWithShortage() {
    if (!shortageReason.trim()) return Alert.alert('A business reason is required');
    setBusy(true);
    try {
      const res = await closeWithShortage(po.id, shortageReason.trim(), shortageSupplierExp.trim() || undefined);
      if (!res.ok) { Alert.alert('Could not request closure', res.error ?? 'Please try again.'); return; }
      showToast(`Shortage closure requested — ${(res.stages ?? []).join(' → ')} approval pending.`);
      setShortageForm(false); setShortageReason(''); setShortageSupplierExp('');
      refetch();
    } catch (e: any) {
      Alert.alert('Could not request closure', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onDecideShortage(decision: 'approved' | 'rejected') {
    setBusy(true);
    try {
      const res = await decideShortage(po.id, decision, decisionNotes.trim() || undefined);
      if (!res.ok) { Alert.alert('Could not record decision', res.error ?? 'Please try again.'); return; }
      setDecisionNotes('');
      refetch();
    } catch (e: any) {
      Alert.alert('Could not record decision', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateInvoice() {
    if (blacklisted) return Alert.alert('This supplier is blacklisted and cannot participate in procurement.');
    if (!invoiceNumber.trim()) return Alert.alert('Invoice number is required');
    const amount = Number(invoiceAmount) || Number(po.total_amount) + Number(po.tax_amount);
    setBusy(true);
    try {
      const res = await createInvoice(po.id, { invoice_number: invoiceNumber.trim(), invoice_amount: amount });
      if (res.id) {
        showToast('Invoice created.');
        navigation.navigate('InvoiceDetail', { invoiceId: res.id });
      } else {
        Alert.alert('Could not create invoice', res.error ?? 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Could not create invoice', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={po.po_number ?? `PO #${po.id}`} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.title}>{po.supplier_name}</Text>
            <StatusBadge status={po.status} withIcon />
          </View>
          {po.supplier_phone || po.supplier_email ? (
            <Text style={styles.meta}>{[po.supplier_phone, po.supplier_email].filter(Boolean).join(' · ')}</Text>
          ) : null}
          {blacklisted ? (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={16} color={Colors.error} />
              <Text style={styles.warningCardText}>This supplier is blacklisted and cannot participate in further procurement — goods receipt and invoicing are disabled.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fulfillment</Text>
          <View style={styles.divider} />
          <Row label="Ordered" value={String(fulfillment.ordered)} />
          <View style={styles.rowDivider} />
          <Row label="Received" value={String(fulfillment.received)} />
          <View style={styles.rowDivider} />
          <Row label="Outstanding" value={String(fulfillment.outstandingQty)} />
          <View style={styles.rowDivider} />
          <Row label="Fulfillment %" value={`${fulfillment.fulfillmentPct}%`} />
          {fulfillment.outstandingQty > 0 && po.status === 'partially_received' ? (
            <Text style={[styles.shortageNote, { color: Colors.warning }]}>Waiting for delivery — {fulfillment.outstandingQty} unit(s) still expected.</Text>
          ) : null}
          {['shortage_pending_approval', 'closed_with_shortage'].includes(po.status) ? (
            <Text style={[styles.shortageNote, { color: Colors.error }]}>Supplier will not deliver the remainder.</Text>
          ) : null}
        </View>

        {po.shortage_reason ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shortage Information</Text>
            <View style={styles.divider} />
            <Text style={styles.itemMeta}><Text style={{ fontWeight: Typography.semibold }}>Reason: </Text>{po.shortage_reason}</Text>
            {po.shortage_supplier_explanation ? (
              <Text style={[styles.itemMeta, { marginTop: 4 }]}><Text style={{ fontWeight: Typography.semibold }}>Supplier Explanation: </Text>{po.shortage_supplier_explanation}</Text>
            ) : null}
            <Text style={[styles.meta, { marginTop: 6 }]}>
              Requested {po.shortage_requested_at ? new Date(po.shortage_requested_at).toLocaleString() : '—'}
              {po.shortage_closed_at ? ` · Closed ${new Date(po.shortage_closed_at).toLocaleString()}` : ''}
            </Text>
          </View>
        ) : null}

        {steps && steps.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shortage Approval Timeline</Text>
            <View style={styles.divider} />
            <ApprovalTimeline steps={steps} />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Details</Text>
          <View style={styles.divider} />
          <Row label="Requisition" value={po.requisition_number ?? '—'} />
          <View style={styles.rowDivider} />
          <Row label="Issue Date" value={po.issue_date ? new Date(po.issue_date).toLocaleDateString() : '—'} />
          <View style={styles.rowDivider} />
          <Row label="Expected Delivery" value={po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '—'} />
          <View style={styles.rowDivider} />
          <Row label="Total Amount" value={Number(po.total_amount).toLocaleString()} />
          <View style={styles.rowDivider} />
          <Row label="Tax" value={Number(po.tax_amount).toLocaleString()} />
          {po.terms ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Terms" value={po.terms} />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Line Items ({items.length})</Text>
          <View style={styles.divider} />
          {items.map((it, i) => (
            <View key={it.id} style={[styles.itemRow, i > 0 && styles.rowDivider]}>
              <Text style={styles.itemDesc}>{it.description}</Text>
              <Text style={styles.itemMeta}>{it.quantity} × {Number(it.unit_price).toLocaleString()}{it.tax_rate ? ` (+${it.tax_rate}% tax)` : ''}</Text>
            </View>
          ))}
        </View>

        {canAct ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Decision — {currentStep!.assigned_role}</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor={Colors.textMuted}
              value={decisionNotes}
              onChangeText={setDecisionNotes}
              multiline
            />
            <View style={styles.decisionRow}>
              <Button label="Reject" icon="close" variant="outline" color={Colors.error} disabled={busy} onPress={() => onDecideShortage('rejected')} style={{ flex: 1 }} />
              <Button label="Approve" icon="checkmark" color={Colors.success} disabled={busy} onPress={() => onDecideShortage('approved')} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}

        {canCloseShortage ? (
          shortageForm ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Close With Shortage</Text>
              <View style={styles.divider} />
              <Text style={[styles.itemMeta, { color: Colors.error, marginBottom: Spacing.sm }]}>
                {fulfillment.outstandingQty} unit(s) will be recorded as never delivered, pending approval. Goods Receipt records are never modified.
              </Text>
              <TextInput style={styles.input} placeholder="Business Reason *" placeholderTextColor={Colors.textMuted} value={shortageReason} onChangeText={setShortageReason} />
              <TextInput style={styles.input} placeholder="Supplier Explanation (optional)" placeholderTextColor={Colors.textMuted} value={shortageSupplierExp} onChangeText={setShortageSupplierExp} />
              <Button label={busy ? 'Requesting…' : 'Request Closure'} variant="danger" disabled={busy} onPress={onCloseWithShortage} fullWidth />
            </View>
          ) : (
            <Button label="Close with Shortage" variant="outline" color={Colors.error} onPress={() => setShortageForm(true)} fullWidth />
          )
        ) : null}

        {canReceive ? (
          <Button
            label="Record Goods Receipt"
            color={Colors.navy}
            disabled={blacklisted}
            onPress={() => navigation.navigate('GoodsReceiptCreate', { poId: po.id })}
            fullWidth
          />
        ) : null}

        {po.status === 'received' && !blacklisted ? (
          invoiceForm ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Raise Invoice</Text>
              <View style={styles.divider} />
              <TextInput style={styles.input} placeholder="Invoice Number" placeholderTextColor={Colors.textMuted} value={invoiceNumber} onChangeText={setInvoiceNumber} />
              <TextInput
                style={styles.input}
                placeholder={`Amount (defaults to ${(Number(po.total_amount) + Number(po.tax_amount)).toLocaleString()})`}
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={invoiceAmount}
                onChangeText={setInvoiceAmount}
              />
              <Button label={busy ? 'Saving…' : 'Create Invoice'} color={Colors.navy} disabled={busy} onPress={onCreateInvoice} fullWidth />
            </View>
          ) : (
            <Button label="Raise Invoice" color={Colors.navy} onPress={() => setInvoiceForm(true)} fullWidth />
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { height: 1, backgroundColor: Colors.divider },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, flex: 1 },
  meta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  warningCardText: { flex: 1, fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.medium },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, gap: Spacing.base },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  itemRow: { paddingVertical: Spacing.sm, gap: 2 },
  itemDesc: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  itemMeta: { fontSize: Typography.xs, color: Colors.textMuted },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.card, marginBottom: Spacing.sm },
  shortageNote: { fontSize: Typography.xs, fontWeight: Typography.medium, marginTop: Spacing.sm },
  decisionRow: { flexDirection: 'row', gap: Spacing.sm },
});
