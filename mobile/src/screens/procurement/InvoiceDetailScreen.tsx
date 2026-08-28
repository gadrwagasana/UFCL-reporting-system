import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { useProcurementInvoices, useProcurementPayments, useProcurementInvoiceActions } from '../../hooks/useProcurementInvoices';
import { ProcurementStackParamList } from '../../navigation/types';
import { showToast } from '../../stores/toastStore';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'InvoiceDetail'>;
type RouteType = RouteProp<ProcurementStackParamList, 'InvoiceDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function InvoiceDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { data, isLoading, isError, refetch } = useProcurementInvoices();
  const { data: paymentsData } = useProcurementPayments();
  const { match, decide, createPayment, decidePayment } = useProcurementInvoiceActions();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <LoadingState message="Loading invoice…" fullScreen />;
  if (isError) return <ErrorState message="Could not load invoice" onRetry={refetch} fullScreen />;

  const invoice = data.rows.find((i) => i.id === params.invoiceId);
  if (!invoice) return <ErrorState message="Invoice not found" onRetry={refetch} fullScreen />;

  const invoiceId = invoice.id;
  const payment = (paymentsData?.rows ?? []).find((p) => p.invoice_id === invoiceId);

  async function onMatch() {
    setBusy(true);
    try {
      const res = await match(invoiceId);
      showToast(
        `${res.matched ? 'Matched' : 'Variance detected'} — variance ${res.variancePct.toFixed(1)}%`,
        res.matched ? 'success' : 'error'
      );
      refetch();
    } catch (e: any) {
      Alert.alert('Could not match invoice', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(decision: 'approved' | 'rejected') {
    setBusy(true);
    try {
      await decide(invoiceId, decision, notes.trim() || undefined);
      setNotes('');
      showToast(decision === 'approved' ? 'Invoice approved.' : 'Invoice rejected.');
      refetch();
    } catch (e: any) { Alert.alert('Could not record decision', e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function onCreatePayment() {
    setBusy(true);
    try {
      const res = await createPayment(invoiceId, {});
      if (res.ok) { showToast('Payment initiated.'); refetch(); }
      else Alert.alert('Could not initiate payment', res.error ?? 'Please try again.');
    } catch (e: any) {
      Alert.alert('Could not initiate payment', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onDecidePayment(decision: 'approved' | 'rejected') {
    if (!payment) return;
    setBusy(true);
    try {
      await decidePayment(payment.id, decision, notes.trim() || undefined);
      setNotes('');
      showToast(decision === 'approved' ? 'Payment approved.' : 'Payment rejected.');
      refetch();
    } catch (e: any) {
      Alert.alert('Could not record payment decision', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={invoice.invoice_number} dark onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.title}>{invoice.supplier_name}</Text>
            <StatusBadge status={invoice.status} withIcon />
          </View>
          <Text style={styles.meta}>{invoice.po_number}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <View style={styles.divider} />
          <Row label="Invoice Date" value={invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '—'} />
          <View style={styles.rowDivider} />
          <Row label="Amount" value={Number(invoice.invoice_amount).toLocaleString()} />
          {invoice.notes ? (
            <>
              <View style={styles.rowDivider} />
              <Row label="Notes" value={invoice.notes} />
            </>
          ) : null}
        </View>

        {payment ? (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.cardTitle}>Payment</Text>
              <StatusBadge status={payment.status} size="sm" withIcon />
            </View>
            <View style={styles.divider} />
            <Row label="Amount" value={Number(payment.amount).toLocaleString()} />
          </View>
        ) : null}

        {invoice.status === 'pending_match' ? (
          <TouchableOpacity style={styles.actionBtn} disabled={busy} onPress={onMatch}>
            <Text style={styles.actionBtnText}>Run 3-Way Match</Text>
          </TouchableOpacity>
        ) : null}

        {(invoice.status === 'matched' || invoice.status === 'disputed') ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Finance Decision</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <View style={styles.decisionRow}>
              <TouchableOpacity style={[styles.decisionBtn, styles.rejectBtn]} disabled={busy} onPress={() => onDecide('rejected')}>
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.decisionBtn, styles.approveBtn]} disabled={busy} onPress={() => onDecide('approved')}>
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {invoice.status === 'approved' && !payment ? (
          <TouchableOpacity style={styles.actionBtn} disabled={busy} onPress={onCreatePayment}>
            <Text style={styles.actionBtnText}>Initiate Payment</Text>
          </TouchableOpacity>
        ) : null}

        {payment && payment.status === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Decision</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <View style={styles.decisionRow}>
              <TouchableOpacity style={[styles.decisionBtn, styles.rejectBtn]} disabled={busy} onPress={() => onDecidePayment('rejected')}>
                <Text style={styles.rejectBtnText}>Reject Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.decisionBtn, styles.approveBtn]} disabled={busy} onPress={() => onDecidePayment('approved')}>
                <Text style={styles.approveBtnText}>Approve Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  meta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, gap: Spacing.base },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted, flex: 1 },
  rowValue: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  notesInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary, minHeight: 60, textAlignVertical: 'top', marginBottom: Spacing.sm },
  decisionRow: { flexDirection: 'row', gap: Spacing.sm },
  decisionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, paddingVertical: Spacing.sm },
  rejectBtn: { borderWidth: 1, borderColor: Colors.error },
  rejectBtnText: { color: Colors.error, fontWeight: Typography.semibold },
  approveBtn: { backgroundColor: Colors.success },
  approveBtnText: { color: Colors.white, fontWeight: Typography.semibold },
  actionBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: Typography.semibold },
});
