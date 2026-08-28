import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { StatusBadge }   from '../../components/StatusBadge';
import { useFinanceStockCountDetail, useFinanceStockCountActions } from '../../hooks/useFinance';
import { FinanceStockCountLine } from '../../types/api';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp   = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceStockCountDetail'>;
type RouteProps = RouteProp<FinanceCenterStackParamList, 'FinanceStockCountDetail'>;

// Finance Enterprise — physical count entry. Editable only while the
// session is draft/counting (matches the backend's own status guard);
// submitting for review requires every line to be counted, exactly as
// desktop enforces.
export function FinanceStockCountDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteProps>();
  const { data, isLoading, isError, refetch } = useFinanceStockCountDetail(params.sessionId);
  const { enterCount, submitForReview } = useFinanceStockCountActions();
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data?.lines) {
      const init: Record<number, string> = {};
      data.lines.forEach((l) => { init[l.id] = l.physical_qty != null ? String(l.physical_qty) : ''; });
      setValues(init);
    }
  }, [data?.lines]);

  if (isLoading) return <LoadingState message="Loading stock count…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load stock count" onRetry={refetch} fullScreen />;

  const { session, lines } = data;
  const canEdit = session.status === 'draft' || session.status === 'counting';
  const allCounted = lines.every((l) => values[l.id] != null && values[l.id] !== '');

  async function handleSave(lineId: number) {
    const raw = values[lineId];
    if (raw == null || raw === '') return;
    setSaving(lineId);
    try {
      const r = await enterCount(params.sessionId, lineId, Number(raw));
      if (!r.ok) Alert.alert('Error', r.error || 'Could not save count.');
    } catch {
      Alert.alert('Error', 'Could not save count. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    try {
      const r = await submitForReview(params.sessionId);
      if (!r.ok) { Alert.alert('Error', r.error || 'Could not submit for review.'); return; }
      Alert.alert('Submitted', 'Stock count submitted for review. A manager-tier approval is required before any resulting adjustment takes effect.');
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not submit for review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title={`Count #${session.id}`} dark onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>{session.workshop_name || 'Company-wide'}{session.category ? ` · ${session.category}` : ''}</Text>
          <StatusBadge status={session.status} size="sm" />
        </View>
        <FlatList
          data={lines}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: FinanceStockCountLine }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
                <Text style={styles.itemMeta}>System: {item.system_qty_snapshot} {item.uom}</Text>
              </View>
              {canEdit ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="numeric"
                    value={values[item.id] ?? ''}
                    onChangeText={(v) => setValues((s) => ({ ...s, [item.id]: v }))}
                    onBlur={() => handleSave(item.id)}
                    placeholder="Count"
                    placeholderTextColor={Colors.textMuted}
                  />
                  {saving === item.id ? <ActivityIndicator size="small" color={Colors.navy} /> : null}
                </View>
              ) : (
                <Text style={styles.qtyStatic}>{item.physical_qty ?? '—'}</Text>
              )}
            </View>
          )}
        />
        {canEdit ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, !allCounted && styles.submitBtnDisabled]}
              onPress={handleSubmitForReview}
              disabled={!allCounted || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.submitBtnText}>{allCounted ? 'Submit for Review' : 'Count every item to submit'}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              {session.status === 'pending_review'
                ? 'Submitted for review — submitting the resulting adjustments happens on desktop.'
                : `This count is ${session.status}.`}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerText: { fontSize: Typography.sm, color: Colors.textSecondary },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.sm,
  },
  itemName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  itemMeta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  qtyInput: {
    width: 72, height: 40, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    textAlign: 'center', fontSize: Typography.base, color: Colors.textPrimary,
  },
  qtyStatic: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  footer: { padding: Spacing.base, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.divider },
  footerNote: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },
  submitBtn: {
    backgroundColor: Colors.green, borderRadius: Radius.md, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
